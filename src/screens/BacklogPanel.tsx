import { useEffect, useRef } from 'react';

export interface LogEntry {
  speaker: string | null;
  text: string;
}

interface Props {
  entries: LogEntry[];
  onClose: () => void;
}

/** これまでに表示した文章の一覧（新しいものが下） */
export default function BacklogPanel({ entries, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <div className="overlay" onClick={(e) => e.stopPropagation()}>
      <header className="overlay-header">
        <h2>バックログ</h2>
        <button className="btn-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </header>
      <div className="overlay-body backlog" ref={bodyRef}>
        {entries.map((e, i) => (
          <div key={i} className="backlog-entry">
            {e.speaker && <p className="backlog-name">{e.speaker}</p>}
            <p className="backlog-text">{e.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
