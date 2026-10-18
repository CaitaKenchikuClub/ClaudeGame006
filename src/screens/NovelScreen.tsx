import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import type { EpisodeInfo } from '../types';
import { loadScenarioText, loadStoryResources, type StoryResources } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { collectEpisodeFiles, imagesForState, isImageSettled, prefetchAudio, preloadInBackground, waitForImages } from '../lib/preload';
import { autoWaitMs, CHAR_INTERVAL_MS, useSettings } from '../lib/settings';
import { clearResume, getResumeIndex, markCompleted, saveResumeIndex } from '../lib/progress';
import { playBgm, playSe, resumeAudio, stopBgm } from '../audio/audioManager';
import { initialNovelState, restore, step, type NovelState, type Position, type ScenarioCommand } from '../novel/engine';
import { parseScenario, type ScenarioError } from '../novel/parser';
import { displayInState, findCharacter, validateScenario } from '../novel/validate';
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

/** 最初の場面の画像を待つ最大時間。過ぎたら画像が揃わなくても始める */
const FIRST_SCENE_TIMEOUT_MS = 10000;
/** 次の場面の画像を待つ最大時間 */
const NEXT_SCENE_TIMEOUT_MS = 3000;

interface Loaded {
  commands: ScenarioCommand[];
  /** 最初に表示する場面（続きから再開するときは再開位置） */
  initialState: NovelState;
  resources: StoryResources;
  /** シナリオや設定の問題（再生は続けられる） */
  problems: string[];
}

/** シナリオと設定を読み込んでから再生画面を表示する */
export default function NovelScreen({ storyId, episode, resume, onExit, onComplete }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [text, resources] = await Promise.all([loadScenarioText(storyId, episode.file), loadStoryResources(storyId)]);
      const parsed = parseScenario(text);
      const scenarioErrors: ScenarioError[] = [
        ...parsed.errors,
        ...validateScenario(parsed.commands, resources.characters, resources.assets),
      ].sort((a, b) => a.line - b.line);

      // 開始時は最初の場面の画像だけを待ち、残りは再生しながら登場順に裏で読み込む
      const resumeIndex = resume ? getResumeIndex(storyId, episode.id) : undefined;
      const initialState =
        resumeIndex !== undefined ? restore(parsed.commands, resumeIndex) : step(parsed.commands, initialNovelState);
      const context = { storyId, characters: resources.characters, assets: resources.assets };
      const files = collectEpisodeFiles(parsed.commands, context);
      prefetchAudio(files.audio);
      await waitForImages(imagesForState(initialState, context), FIRST_SCENE_TIMEOUT_MS);
      preloadInBackground(files.images);

      if (cancelled) return;
      setLoaded({
        commands: parsed.commands,
        initialState,
        resources,
        problems: [...resources.errors, ...scenarioErrors.map((e) => `${episode.file} ${e.line}行目：${e.message}`)],
      });
    })().catch((e: Error) => !cancelled && setFatal(e.message));
    return () => {
      cancelled = true;
    };
  }, [storyId, episode.id, episode.file, resume]);

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
      </div>
    );
  }
  return (
    <NovelPlayer
      {...loaded}
      storyId={storyId}
      episodeId={episode.id}
      onExit={onExit}
      onComplete={onComplete}
    />
  );
}

function NovelPlayer({
  storyId,
  episodeId,
  initialState,
  commands,
  resources,
  problems,
  onExit,
  onComplete,
}: Loaded & Pick<Props, 'storyId' | 'onExit' | 'onComplete'> & { episodeId: string }) {
  const settings = useSettings();
  const [state, setState] = useState(initialState);
  /** 次の場面の画像を待っている間は true（その間は今の場面を表示したまま） */
  const [waiting, setWaiting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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

  // 長文がウィンドウに収まらないとき：新しい文章は先頭から表示し、
  // 一文字ずつ表示している間だけ、表示中の行が見えるよう下へスクロールする。
  // （途中タップや「一瞬」で全文を出したときは、読み始めの行が隠れないよう動かさない）
  const prevShown = useRef(0);
  useEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTop = 0;
    prevShown.current = -1;
  }, [chars]);
  useEffect(() => {
    const el = textRef.current;
    if (el && shown > 0 && shown === prevShown.current + 1) el.scrollTop = el.scrollHeight;
    prevShown.current = shown;
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

  // 次の場面へ。画像がまだ届いていなければ、今の場面のまま少し待ってから切り替える
  const advance = () => {
    if (waiting) return;
    const next = step(commands, state);
    const pending = imagesForState(next, { storyId, characters, assets }).filter((url) => !isImageSettled(url));
    if (pending.length === 0) {
      setState(next);
      return;
    }
    setWaiting(true);
    waitForImages(pending, NEXT_SCENE_TIMEOUT_MS).then(() => {
      if (!mounted.current) return;
      setWaiting(false);
      setState(next);
    });
  };

  // オート再生：全文表示後、文章の長さに応じて待ってから次へ
  useEffect(() => {
    if (!auto || typing || panel || waiting || state.ended) return;
    const timer = setTimeout(advance, autoWaitMs(settings.autoSpeed, chars.length));
    return () => clearTimeout(timer);
  }, [auto, typing, panel, waiting, state, settings.autoSpeed]);

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
            if (!name || !info) return null;
            const display = displayInState(state, name, info);
            if (!display.image) return null;
            return (
              <SafeImage
                key={`${pos}-${info.id}`}
                className={`novel-character pos-${pos}`}
                style={{
                  height: `${display.height}%`,
                  bottom: `${-display.offsetY}%`,
                  marginLeft: `${display.offsetX}%`,
                }}
                src={storyFileUrl(storyId, `characters/${display.image}`)}
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
          {!typing && chars.length > 0 && (
            <span className={`message-next${waiting ? ' waiting' : ''}`}>{waiting ? '読み込み中' : auto ? 'AUTO' : '▼'}</span>
          )}
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
