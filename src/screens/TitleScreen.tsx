import { useEffect, useState } from 'react';
import { prefetchStoryList } from '../lib/stories';
import SettingsPanel from './SettingsPanel';

interface Props {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  // スタートが押される前に、作品一覧の読み込みを始めておく
  useEffect(prefetchStoryList, []);

  return (
    <div className="title-screen">
      <div className="title-logo">
        <p className="title-sub">Web小説 試し読みノベル</p>
        <h1 className="title-main">ノベルコラボ</h1>
      </div>
      <div className="title-buttons">
        <button className="btn btn-primary" onClick={onStart}>
          スタート
        </button>
        <button className="btn btn-text" onClick={() => setShowSettings(true)}>
          設定
        </button>
      </div>
      <p className="title-footer">タップで物語を読み進めよう</p>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
