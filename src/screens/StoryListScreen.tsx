import { useEffect, useState } from 'react';
import type { StoryInfo } from '../types';
import { loadCatalog, loadStoryInfo } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { isCompleted } from '../lib/progress';

interface Props {
  onBack: () => void;
  onSelect: (story: StoryInfo) => void;
}

export default function StoryListScreen({ onBack, onSelect }: Props) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** 作品ID → 読み込んだ info.json（失敗したら Error） */
  const [infos, setInfos] = useState<Record<string, StoryInfo | Error>>({});
  /** 表紙画像は、すべての作品の文字情報が揃ってから読み込む */
  const [coversReady, setCoversReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 作品数が分かった時点で枠を並べ、読み込めた作品から順に中身を表示する
    loadCatalog()
      .then((list) => {
        if (cancelled) return;
        setIds(list);
        const set = (id: string, v: StoryInfo | Error) => !cancelled && setInfos((m) => ({ ...m, [id]: v }));
        return Promise.allSettled(
          list.map((id) => loadStoryInfo(id).then((info) => set(id, info), (e: Error) => set(id, e))),
        ).then(() => !cancelled && setCoversReady(true));
      })
      .catch((e: Error) => !cancelled && setCatalogError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button className="btn-back" onClick={onBack} aria-label="タイトルへ戻る">
          ‹
        </button>
        <h2>作品一覧</h2>
      </header>

      <div className="list-body">
        {catalogError && <p className="error-box">{catalogError}</p>}
        {ids === null && !catalogError && <p className="loading">Now Loading…</p>}
        {ids?.map((id) => {
          const s = infos[id];
          if (s instanceof Error) {
            return (
              <p key={id} className="error-box">
                {id}: {s.message}
              </p>
            );
          }
          if (!s) return <LoadingCard key={id} />;
          return (
            <button key={id} className="story-card" onClick={() => onSelect(s)}>
              <Cover src={coversReady ? storyFileUrl(s.id, s.cover) : undefined} alt={`${s.title} 表紙`} />
              <span className="story-meta">
                <span className="story-title">{s.title}</span>
                <span className="story-author">{s.author}</span>
                <span className="story-tags">
                  <span className="story-genre">{s.genre}</span>
                  <ReadCount story={s} />
                </span>
                <span className="story-summary">{s.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** まだ info.json が届いていない作品の枠 */
function LoadingCard() {
  return (
    <div className="story-card" aria-busy="true">
      <Cover />
      <span className="story-meta">
        <span className="skeleton-line" style={{ width: '70%' }} />
        <span className="skeleton-line" style={{ width: '40%' }} />
        <span className="skeleton-line" style={{ width: '90%' }} />
      </span>
    </div>
  );
}

/** 表紙。読み込み中は「Now Loading」を出し、読み込めたらふわっと表示する。src がなければ読み込みを始めない */
function Cover({ src, alt = '' }: { src?: string; alt?: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  return (
    <span className="story-cover">
      {state === 'loading' && <span className="now-loading">Now Loading</span>}
      {src && state !== 'failed' && (
        <img
          className={state === 'loaded' ? 'loaded' : undefined}
          src={src}
          alt={alt}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
    </span>
  );
}

/** 「読了 1/2」のような表示。1話も読んでいなければ何も出さない */
function ReadCount({ story }: { story: StoryInfo }) {
  const total = story.episodes?.length ?? 0;
  const read = (story.episodes ?? []).filter((ep) => isCompleted(story.id, ep.id)).length;
  if (read === 0) return null;
  return (
    <span className="badge">
      読了 {read}/{total}
    </span>
  );
}
