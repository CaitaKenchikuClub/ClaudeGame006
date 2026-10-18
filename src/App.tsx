import { useCallback, useState } from 'react';
import TitleScreen from './screens/TitleScreen';
import StoryListScreen from './screens/StoryListScreen';
import NovelScreen from './screens/NovelScreen';
import type { EpisodeInfo } from './types';

// 画面遷移は URL を変えずに状態で切り替える。
// GitHub Pages でリロードしても 404 にならない。
type Screen = { name: 'title' } | { name: 'list' } | { name: 'novel'; storyId: string; episode: EpisodeInfo };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const goList = useCallback(() => setScreen({ name: 'list' }), []);

  return (
    <div className="app-frame">
      <div className="game-screen">
        {screen.name === 'title' && <TitleScreen onStart={goList} />}
        {screen.name === 'list' && (
          <StoryListScreen
            onBack={() => setScreen({ name: 'title' })}
            onSelect={(story) => {
              // 作品詳細画面（Phase 4）ができるまでは、最初のエピソードをそのまま再生する
              const first = [...story.episodes].sort((a, b) => a.order - b.order)[0];
              if (first) setScreen({ name: 'novel', storyId: story.id, episode: first });
            }}
          />
        )}
        {screen.name === 'novel' && <NovelScreen storyId={screen.storyId} episode={screen.episode} onExit={goList} />}
      </div>
    </div>
  );
}
