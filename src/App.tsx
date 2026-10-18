import { useCallback, useState } from 'react';
import TitleScreen from './screens/TitleScreen';
import StoryListScreen from './screens/StoryListScreen';
import NovelScreen from './screens/NovelScreen';

// 画面遷移は URL を変えずに状態で切り替える。
// GitHub Pages でリロードしても 404 にならない。
type Screen = { name: 'title' } | { name: 'list' } | { name: 'novel'; storyId: string };

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
            onSelect={(storyId) => setScreen({ name: 'novel', storyId })}
          />
        )}
        {screen.name === 'novel' && <NovelScreen storyId={screen.storyId} onExit={goList} />}
      </div>
    </div>
  );
}
