import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import type { CharacterInfo } from '../types';
import { loadStoryResources, type StoryResources } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { initialNovelState, step, type Position } from '../novel/engine';
import { getDemoScenario } from '../novel/demoScenario';

interface Props {
  storyId: string;
  onExit: () => void;
}

/** 1文字を表示する間隔（ミリ秒） */
const CHAR_INTERVAL_MS = 40;

const POSITIONS: Position[] = ['left', 'center', 'right'];

export default function NovelScreen({ storyId, onExit }: Props) {
  const [resources, setResources] = useState<StoryResources | null>(null);
  const commands = useMemo(() => getDemoScenario(storyId), [storyId]);
  const [state, setState] = useState(() => step(commands, initialNovelState));

  // 一文字ずつ表示（サロゲートペアや絵文字が割れないよう Array.from で分割）
  const chars = useMemo(() => Array.from(state.text), [state.text]);
  const [shown, setShown] = useState(0);
  const typing = shown < chars.length;
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStoryResources(storyId).then(setResources);
  }, [storyId]);

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
    if (!resources) return;
    if (typing) setShown(chars.length);
    else setState((s) => step(commands, s));
  };

  const findCharacter = (name: string): CharacterInfo | undefined =>
    resources?.characters.find((c) => c.name === name || c.id === name);

  const backgroundFile = state.background ? resources?.assets.backgrounds?.[state.background] : undefined;

  return (
    <div className="novel-screen" onClick={handleTap}>
      <div className="novel-background">
        {backgroundFile && (
          <SafeImage key={backgroundFile} src={storyFileUrl(storyId, `backgrounds/${backgroundFile}`)} alt="" />
        )}
      </div>

      <div className="novel-characters">
        {POSITIONS.map((pos) => {
          const name = state.characters[pos];
          const info = name ? findCharacter(name) : undefined;
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

      {resources && resources.errors.length > 0 && (
        <div className="novel-errors">
          {resources.errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
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
