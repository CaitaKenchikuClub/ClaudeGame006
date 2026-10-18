import type { EpisodeInfo, StoryInfo } from '../types';
import { sortedEpisodes } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { getResumeIndex, isCompleted } from '../lib/progress';

interface Props {
  story: StoryInfo;
  onBack: () => void;
  /** resume が true なら続きから再生する */
  onPlay: (episode: EpisodeInfo, resume: boolean) => void;
}

export default function StoryDetailScreen({ story, onBack, onPlay }: Props) {
  const episodes = sortedEpisodes(story);

  return (
    <div className="list-screen">
      <header className="screen-header">
        <button className="btn-back" onClick={onBack} aria-label="作品一覧へ戻る">
          ‹
        </button>
        <h2>作品詳細</h2>
      </header>

      <div className="list-body">
        <div className="detail-head">
          <img
            className="detail-cover"
            src={storyFileUrl(story.id, story.cover)}
            alt={`${story.title} 表紙`}
            onError={(e) => e.currentTarget.classList.add('missing')}
          />
          <div className="detail-meta">
            <h3 className="detail-title">{story.title}</h3>
            <p className="story-author">作者：{story.author}</p>
            <span className="story-genre">{story.genre}</span>
          </div>
        </div>

        <section>
          <h4 className="section-title">あらすじ</h4>
          <p className="detail-synopsis">{story.synopsis}</p>
        </section>

        <section>
          <h4 className="section-title">エピソード</h4>
          {episodes.length === 0 && <p className="loading">エピソードがありません</p>}
          <div className="episode-list">
            {episodes.map((ep) => {
              const canResume = getResumeIndex(story.id, ep.id) !== undefined;
              return (
                <div key={ep.id} className="episode-item">
                  <div className="episode-head">
                    <span>{ep.title}</span>
                    {isCompleted(story.id, ep.id) && <span className="badge">読了</span>}
                  </div>
                  <div className="episode-actions">
                    {canResume && (
                      <button className="btn-small primary" onClick={() => onPlay(ep, true)}>
                        続きから
                      </button>
                    )}
                    <button className={`btn-small${canResume ? '' : ' primary'}`} onClick={() => onPlay(ep, false)}>
                      {canResume ? '最初から' : '▶ 読む'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <OriginalLink url={story.originalUrl} label="原作を読む" />
      </div>
    </div>
  );
}

/** 原作掲載サイトへのリンク（新しいタブで開く） */
export function OriginalLink({ url, label }: { url: string; label: string }) {
  if (!url) return null;
  return (
    <a className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer">
      {label} ↗
    </a>
  );
}
