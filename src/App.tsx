import { useState } from 'react';
import TitleScreen from './screens/TitleScreen';
import StoryListScreen from './screens/StoryListScreen';

// 画面遷移は URL を変えずに状態で切り替える。
// GitHub Pages でリロードしても 404 にならない。
type Screen = { name: 'title' } | { name: 'list' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });

  return (
    <div className="app-frame">
      <div className="game-screen">
        {screen.name === 'title' && <TitleScreen onStart={() => setScreen({ name: 'list' })} />}
        {screen.name === 'list' && <StoryListScreen onBack={() => setScreen({ name: 'title' })} />}
      </div>
    </div>
  );
}
