import { useEffect, useState } from 'react';
import type { StoryInfo } from '../types';
import { loadStories } from '../lib/stories';
import { storyFileUrl } from '../lib/paths';

interface Props {
  onBack: () => void;
  onSelect: (story: StoryInfo) => void;
}

export default function StoryListScreen({ onBack, onSelect }: Props) {
  const [stories, setStories] = useState<StoryInfo[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadStories()
      .then((r) => {
        setStories(r.stories);
        setErrors(r.errors);
      })
      .catch((e: Error) => {
        setStories([]);
        setErrors([e.message]);
      });
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
        {errors.map((msg) => (
          <p key={msg} className="error-box">
            {msg}
          </p>
        ))}
        {stories === null && <p className="loading">読み込み中…</p>}
        {stories?.map((s) => (
          <button key={s.id} className="story-card" onClick={() => onSelect(s)}>
            <img
              className="story-cover"
              src={storyFileUrl(s.id, s.cover)}
              alt={`${s.title} 表紙`}
              onError={(e) => e.currentTarget.classList.add('missing')}
            />
            <span className="story-meta">
              <span className="story-title">{s.title}</span>
              <span className="story-author">{s.author}</span>
              <span className="story-genre">{s.genre}</span>
              <span className="story-summary">{s.summary}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
