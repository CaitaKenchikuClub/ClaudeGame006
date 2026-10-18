import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import type { EpisodeInfo } from '../types';
import { loadScenarioText, loadStoryResources, type StoryResources } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { collectEpisodeFiles, prefetchAudio, preloadImages } from '../lib/preload';
import { autoWaitMs, CHAR_INTERVAL_MS, useSettings } from '../lib/settings';
import { clearResume, getResumeIndex, markCompleted, saveResumeIndex } from '../lib/progress';
import { playBgm, playSe, resumeAudio, stopBgm } from '../audio/audioManager';
import { initialNovelState, restore, step, type Position, type ScenarioCommand } from '../novel/engine';
import { parseScenario, type ScenarioError } from '../novel/parser';
import { characterImage, findCharacter, validateScenario } from '../novel/validate';
import SettingsPanel from './SettingsPanel';
import BacklogPanel, { type LogEntry } from './BacklogPanel';

interface Props {
  storyId: string;
  episode: EpisodeInfo;
  /** true なら前回の続きから再生する */
  resume?: boolean;
  /** 途中で×ボタンを押したとき */
  onExit: () => void;
  /** 最後まで読んだとき */
  onComplete: () => void;
}

const POSITIONS: Position[] = ['left', 'center', 'right'];

interface Loaded {
  commands: ScenarioCommand[];
  resources: StoryResources;
  /** シナリオや設定の問題（再生は続けられる） */
  problems: string[];
}

/** シナリオと設定を読み込んでから再生画面を表示する */
export default function NovelScreen({ storyId, episode, resume, onExit, onComplete }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [text, resources] = await Promise.all([loadScenarioText(storyId, episode.file), loadStoryResources(storyId)]);
      const parsed = parseScenario(text);
      const scenarioErrors: ScenarioError[] = [
        ...parsed.errors,
        ...validateScenario(parsed.commands, resources.characters, resources.assets),
      ].sort((a, b) => a.line - b.line);

      // 場面が切り替わった瞬間に画像が表示されるよう、使う画像を先にすべて読み込む
      const files = collectEpisodeFiles(storyId, parsed.commands, resources.characters, resources.assets);
      prefetchAudio(files.audio);
      setProgress({ done: 0, total: files.images.length });
      await preloadImages(files.images, (done) => !cancelled && setProgress({ done, total: files.images.length }));

      if (cancelled) return;
      setLoaded({
        commands: parsed.commands,
        resources,
        problems: [...resources.errors, ...scenarioErrors.map((e) => `${episode.file} ${e.line}行目：${e.message}`)],
      });
    })().catch((e: Error) => !cancelled && setFatal(e.message));
    return () => {
      cancelled = true;
    };
  }, [storyId, episode.file]);

  if (fatal) {
    return (
      <div className="novel-screen novel-fatal">
        <p>シナリオを読み込めませんでした。</p>
        <p className="error-box">{fatal}</p>
        <button className="btn btn-primary" onClick={onExit}>
          戻る
        </button>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="novel-screen novel-loading">
        <p>読み込み中…</p>
        {progress && progress.total > 0 && (
          <div className="loading-bar">
            <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
      </div>
    );
  }
  return (
    <NovelPlayer
      {...loaded}
      storyId={storyId}
      episodeId={episode.id}
      resume={resume}
      onExit={onExit}
      onComplete={onComplete}
    />
  );
}

function NovelPlayer({
  storyId,
  episodeId,
  resume,
  commands,
  resources,
  problems,
  onExit,
  onComplete,
}: Loaded & Pick<Props, 'storyId' | 'resume' | 'onExit' | 'onComplete'> & { episodeId: string }) {
  const settings = useSettings();
  const [state, setState] = useState(() => {
    const index = resume ? getResumeIndex(storyId, episodeId) : undefined;
    return index !== undefined ? restore(commands, index) : step(commands, initialNovelState);
  });
  const [auto, setAuto] = useState(false);
  const [panel, setPanel] = useState<'log' | 'settings' | null>(null);
  const [showProblems, setShowProblems] = useState(true);
  const { characters, assets } = resources;

  // 一文字ずつ表示（サロゲートペアや絵文字が割れないよう Array.from で分割）
  const chars = useMemo(() => Array.from(state.text), [state.text]);
  const [shown, setShown] = useState(0);
  const typing = shown < chars.length;
  const textRef = useRef<HTMLDivElement>(null);
  const interval = CHAR_INTERVAL_MS[settings.textSpeed];

  useEffect(() => {
    if (interval === 0 || chars.length === 0) {
      setShown(chars.length);
      return;
    }
    setShown(0);
    const timer = setInterval(() => {
      setShown((n) => {
        if (n + 1 >= chars.length) clearInterval(timer);
        return n + 1;
      });
    }, interval);
    return () => clearInterval(timer);
    // 文章が変わったときだけ表示し直す（途中で速度を変えても最初からやり直さない）
  }, [chars]);

  // 長文のときは表示中の行が見えるよう自動でスクロール
  useEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  // BGM（場面をまたいで流れ続け、エピソードを抜けると止まる）
  const bgmFile = state.bgm ? assets.bgm?.[state.bgm] : undefined;
  useEffect(() => {
    playBgm(bgmFile ? storyFileUrl(storyId, `audio/${bgmFile}`) : null);
  }, [bgmFile, storyId]);
  useEffect(() => stopBgm, []);

  // 効果音
  useEffect(() => {
    for (const name of state.se) {
      const file = assets.se?.[name];
      if (file) playSe(storyFileUrl(storyId, `audio/${file}`));
    }
  }, [state.se, assets, storyId]);

  // 途中再開の位置を保存し、最後まで読んだら読了として記録する
  useEffect(() => {
    if (state.ended) {
      clearResume(storyId, episodeId);
      markCompleted(storyId, episodeId);
      onComplete();
    } else {
      saveResumeIndex(storyId, episodeId, state.index);
    }
  }, [state, storyId, episodeId, onComplete]);

  const advance = () => setState((s) => step(commands, s));

  // オート再生：全文表示後、文章の長さに応じて待ってから次へ
  useEffect(() => {
    if (!auto || typing || panel || state.ended) return;
    const timer = setTimeout(advance, autoWaitMs(settings.autoSpeed, chars.length));
    return () => clearTimeout(timer);
  }, [auto, typing, panel, state, settings.autoSpeed]);

  const handleTap = () => {
    resumeAudio();
    if (typing) setShown(chars.length);
    else advance();
  };

  const backlog: LogEntry[] = useMemo(
    () =>
      commands
        .slice(0, state.index)
        .flatMap((c) => (c.type === 'text' ? [{ speaker: c.speaker, text: c.text }] : [])),
    [commands, state.index],
  );

  const backgroundFile = state.background ? assets.backgrounds?.[state.background] : undefined;
  const stillFile = state.still ? assets.stills?.[state.still] : undefined;

  return (
    <div className="novel-screen" onClick={handleTap}>
      <div className="novel-background">
        {backgroundFile && (
          <SafeImage src={storyFileUrl(storyId, `backgrounds/${backgroundFile}`)} alt="" />
        )}
      </div>

      {/* スチル表示中は立ち絵を隠す */}
      {state.still === null ? (
        <div className="novel-characters">
          {POSITIONS.map((pos) => {
            const name = state.characters[pos];
            const info = name ? findCharacter(characters, name) : undefined;
            if (!info) return null;
            const image = characterImage(info, state.expressions[info.name] ?? state.expressions[info.id]);
            return (
              <SafeImage
                key={`${pos}-${info.id}`}
                className={`novel-character pos-${pos}`}
                style={{
                  height: `${info.height ?? 85}%`,
                  bottom: `${-(info.offsetY ?? 0)}%`,
                  marginLeft: `${info.offsetX ?? 0}%`,
                }}
                src={storyFileUrl(storyId, `characters/${image}`)}
                alt={info.name}
              />
            );
          })}
        </div>
      ) : (
        <div className="novel-still">
          {stillFile && <SafeImage src={storyFileUrl(storyId, `stills/${stillFile}`)} alt="" />}
        </div>
      )}

      <div className="novel-toolbar">
        <ToolButton active={auto} onClick={() => setAuto((a) => !a)}>
          オート
        </ToolButton>
        <ToolButton onClick={() => setPanel('log')}>ログ</ToolButton>
        <ToolButton onClick={() => setPanel('settings')}>設定</ToolButton>
        <ToolButton onClick={onExit} label="作品詳細へ戻る">
          ×
        </ToolButton>
      </div>

      {problems.length > 0 && (
        <div
          className="novel-errors"
          onClick={(e) => {
            e.stopPropagation();
            setShowProblems((v) => !v);
          }}
        >
          <p className="novel-errors-title">
            ⚠ シナリオ・設定に {problems.length} 件の問題があります（タップで{showProblems ? '閉じる' : '開く'}）
          </p>
          {showProblems && (
            <ul>
              {problems.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="message-window">
        {state.speaker && <div className="message-name">{state.speaker}</div>}
        <div className="message-text" ref={textRef}>
          {chars.slice(0, shown).join('')}
          {!typing && chars.length > 0 && <span className="message-next">{auto ? 'AUTO' : '▼'}</span>}
        </div>
      </div>

      {panel === 'log' && <BacklogPanel entries={backlog} onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsPanel onClose={() => setPanel(null)} />}
    </div>
  );
}

/** ゲーム画面右上の小さなボタン（押しても文章は進まない） */
function ToolButton({
  children,
  onClick,
  active,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  label?: string;
}) {
  return (
    <button
      className={`tool-button${active ? ' active' : ''}`}
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** 画像が見つからなくてもクラッシュせず、何も表示しない img */
function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  // 読み込めなかった画像の URL を覚えておく（別の画像に替わったらまた表示する）
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === props.src) return null;
  return (
    <img
      {...props}
      draggable={false}
      onError={() => {
        console.warn(`画像を読み込めませんでした: ${props.src}`);
        setFailedSrc(props.src ?? null);
      }}
    />
  );
}
