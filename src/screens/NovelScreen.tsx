import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import type { EpisodeInfo } from '../types';
import { loadScenarioText, loadStoryResources, type StoryResources } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { initialNovelState, step, type Position, type ScenarioCommand } from '../novel/engine';
import { parseScenario, type ScenarioError } from '../novel/parser';
import { findCharacter, validateScenario } from '../novel/validate';

interface Props {
  storyId: string;
  episode: EpisodeInfo;
  onExit: () => void;
}

/** 1文字を表示する間隔（ミリ秒） */
const CHAR_INTERVAL_MS = 40;

const POSITIONS: Position[] = ['left', 'center', 'right'];

interface Loaded {
  commands: ScenarioCommand[];
  resources: StoryResources;
  /** シナリオや設定の問題（再生は続けられる） */
  problems: string[];
}

/** シナリオと設定を読み込んでから再生画面を表示する */
export default function NovelScreen({ storyId, episode, onExit }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadScenarioText(storyId, episode.file), loadStoryResources(storyId)])
      .then(([text, resources]) => {
        const parsed = parseScenario(text);
        const scenarioErrors: ScenarioError[] = [
          ...parsed.errors,
          ...validateScenario(parsed.commands, resources.characters, resources.assets),
        ].sort((a, b) => a.line - b.line);
        setLoaded({
          commands: parsed.commands,
          resources,
          problems: [...resources.errors, ...scenarioErrors.map((e) => `${episode.file} ${e.line}行目：${e.message}`)],
        });
      })
      .catch((e: Error) => setFatal(e.message));
  }, [storyId, episode.file]);

  if (fatal) {
    return (
      <div className="novel-screen novel-fatal">
        <p>シナリオを読み込めませんでした。</p>
        <p className="error-box">{fatal}</p>
        <button className="btn btn-primary" onClick={onExit}>
          作品一覧へ戻る
        </button>
      </div>
    );
  }
  if (!loaded) return <div className="novel-screen" />;
  return <NovelPlayer storyId={storyId} {...loaded} onExit={onExit} />;
}

function NovelPlayer({ storyId, commands, resources, problems, onExit }: Loaded & { storyId: string; onExit: () => void }) {
  const [state, setState] = useState(() => step(commands, initialNovelState));
  const [showProblems, setShowProblems] = useState(true);

  // 一文字ずつ表示（サロゲートペアや絵文字が割れないよう Array.from で分割）
  const chars = useMemo(() => Array.from(state.text), [state.text]);
  const [shown, setShown] = useState(0);
  const typing = shown < chars.length;
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShown(0);
    if (chars.length === 0) return;
    const timer = setInterval(() => {
      setShown((n) => {
        if (n + 1 >= chars.length) clearInterval(timer);
        return n + 1;
      });
    }, CHAR_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [chars]);

  // 長文のときは表示中の行が見えるよう自動でスクロール
  useEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  useEffect(() => {
    if (state.ended) onExit();
  }, [state.ended, onExit]);

  const handleTap = () => {
    if (typing) setShown(chars.length);
    else setState((s) => step(commands, s));
  };

  const { characters, assets } = resources;
  const backgroundFile = state.background ? assets.backgrounds?.[state.background] : undefined;
  const stillFile = state.still ? assets.stills?.[state.still] : undefined;

  return (
    <div className="novel-screen" onClick={handleTap}>
      <div className="novel-background">
        {backgroundFile && (
          <SafeImage key={backgroundFile} src={storyFileUrl(storyId, `backgrounds/${backgroundFile}`)} alt="" />
        )}
      </div>

      {/* スチル表示中は立ち絵を隠す */}
      {state.still === null ? (
        <div className="novel-characters">
          {POSITIONS.map((pos) => {
            const name = state.characters[pos];
            const info = name ? findCharacter(characters, name) : undefined;
            if (!info) return null;
            return (
              <SafeImage
                key={`${pos}-${info.id}`}
                className={`novel-character pos-${pos}`}
                style={{
                  height: `${info.height ?? 85}%`,
                  bottom: `${-(info.offsetY ?? 0)}%`,
                  marginLeft: `${info.offsetX ?? 0}%`,
                }}
                src={storyFileUrl(storyId, `characters/${info.image}`)}
                alt={info.name}
              />
            );
          })}
        </div>
      ) : (
        <div className="novel-still">
          {stillFile && <SafeImage key={stillFile} src={storyFileUrl(storyId, `stills/${stillFile}`)} alt="" />}
        </div>
      )}

      <button
        className="novel-exit"
        aria-label="作品一覧へ戻る"
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
      >
        ×
      </button>

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
          {!typing && chars.length > 0 && <span className="message-next">▼</span>}
        </div>
      </div>
    </div>
  );
}

/** 画像が見つからなくてもクラッシュせず、何も表示しない img */
function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      {...props}
      draggable={false}
      onError={() => {
        console.warn(`画像を読み込めませんでした: ${props.src}`);
        setFailed(true);
      }}
    />
  );
}
