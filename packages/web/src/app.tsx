import { useState } from 'react';
import { Sidebar } from './components/sidebar';
import Flow from './components/flow';
import { Home } from './components/home';
import { Uploader } from './components/uploader';

export type Provider = 'aws' | 'gcp' | 'azure';

function App() {
  const [view, setView] = useState<'home' | 'ui' | 'upload'>('home');
  const [provider, setProvider] = useState<Provider>('aws');

  if (view === 'home') {
    return <Home onSelect={setView} />;
  }

  if (view === 'upload') {
    return <Uploader onBack={() => setView('home')} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#121212] overflow-hidden text-white">
      <Sidebar provider={provider} setProvider={setProvider} />
      <Flow onBack={() => setView('home')} provider={provider} />
    </div>
  );
}

export default App;
