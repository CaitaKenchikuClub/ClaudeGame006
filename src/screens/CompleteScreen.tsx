import type { EpisodeInfo, StoryInfo } from '../types';
import { sortedEpisodes } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';
import { OriginalLink } from './StoryDetailScreen';

interface Props {
  story: StoryInfo;
  episode: EpisodeInfo;
  onPlay: (episode: EpisodeInfo) => void;
  onDetail: () => void;
  onList: () => void;
}

/** エピソード読了画面 */
export default function CompleteScreen({ story, episode, onPlay, onDetail, onList }: Props) {
  const episodes = sortedEpisodes(story);
  const next = episodes[episodes.findIndex((ep) => ep.id === episode.id) + 1];
  const hasOthers = episodes.length > 1;

  return (
    <div className="complete-screen">
      <img
        className="complete-cover"
        src={storyFileUrl(story.id, story.cover)}
        alt=""
        onError={(e) => e.currentTarget.classList.add('missing')}
      />
      <p className="complete-label">読了</p>
      <h2 className="complete-title">{episode.title}</h2>
      <p className="complete-story">
        {story.title}／{story.author}
      </p>
      <p className="complete-message">
        最後まで読んでいただき、
        <br />
        ありがとうございました。
      </p>

      <div className="complete-actions">
        <OriginalLink url={story.originalUrl} label="原作の続きを読む" />
        {next && (
          <button className="btn btn-outline" onClick={() => onPlay(next)}>
            次のエピソード：{next.title}
          </button>
        )}
        {hasOthers && (
          <button className="btn btn-outline" onClick={onDetail}>
            エピソード一覧
          </button>
        )}
        <button className="btn btn-text" onClick={onList}>
          作品一覧に戻る
        </button>
      </div>
    </div>
  );
}
