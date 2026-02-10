import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import Flow from './components/Flow';
import { Home } from './components/Home';
import { Uploader } from './components/Uploader';

function App() {
  const [view, setView] = useState<'home' | 'ui' | 'upload'>('home');

  if (view === 'home') {
      return <Home onSelect={setView} />;
  }

  if (view === 'upload') {
      return <Uploader onBack={() => setView('home')} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] overflow-hidden text-white">
      <Sidebar />
      <Flow onBack={() => setView('home')} />
    </div>
  )
}

export default App
