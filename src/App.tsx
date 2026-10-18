import { useCallback, useState } from 'react';
import TitleScreen from './screens/TitleScreen';
import StoryListScreen from './screens/StoryListScreen';
import StoryDetailScreen from './screens/StoryDetailScreen';
import NovelScreen from './screens/NovelScreen';
import CompleteScreen from './screens/CompleteScreen';
import type { EpisodeInfo, StoryInfo } from './types';

// 画面遷移は URL を変えずに状態で切り替える。
// GitHub Pages でリロードしても 404 にならない。
type Screen =
  | { name: 'title' }
  | { name: 'list' }
  | { name: 'detail'; story: StoryInfo }
  | { name: 'novel'; story: StoryInfo; episode: EpisodeInfo }
  | { name: 'complete'; story: StoryInfo; episode: EpisodeInfo };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const goList = useCallback(() => setScreen({ name: 'list' }), []);
  const play = (story: StoryInfo, episode: EpisodeInfo) => setScreen({ name: 'novel', story, episode });

  return (
    <div className="app-frame">
      <div className="game-screen">
        {screen.name === 'title' && <TitleScreen onStart={goList} />}
        {screen.name === 'list' && (
          <StoryListScreen
            onBack={() => setScreen({ name: 'title' })}
            onSelect={(story) => setScreen({ name: 'detail', story })}
          />
        )}
        {screen.name === 'detail' && (
          <StoryDetailScreen story={screen.story} onBack={goList} onPlay={(ep) => play(screen.story, ep)} />
        )}
        {screen.name === 'novel' && (
          <NovelScreen
            // エピソードが変わったら画面を作り直す（次のエピソードへ進むとき用）
            key={`${screen.story.id}/${screen.episode.id}`}
            storyId={screen.story.id}
            episode={screen.episode}
            onExit={() => setScreen({ name: 'detail', story: screen.story })}
            onComplete={() => setScreen({ name: 'complete', story: screen.story, episode: screen.episode })}
          />
        )}
        {screen.name === 'complete' && (
          <CompleteScreen
            story={screen.story}
            episode={screen.episode}
            onPlay={(ep) => play(screen.story, ep)}
            onDetail={() => setScreen({ name: 'detail', story: screen.story })}
            onList={goList}
          />
        )}
      </div>
    </div>
  );
}
