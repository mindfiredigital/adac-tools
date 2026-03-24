import React, { useEffect, useState } from 'react';
import { Cloud, Server } from 'lucide-react';
import type { Provider } from '../app';

type Icon = {
  name: string;
  path: string;
};

type Category = {
  category: string;
  icons: Icon[];
};

interface SidebarProps {
  provider: Provider;
  setProvider: (provider: Provider) => void;
}

export const Sidebar = ({ provider, setProvider }: SidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const iconFile = provider === 'aws' ? '/icons.json' : '/gcp-icons.json';
    fetch(iconFile)
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error('Failed to fetch icons:', err));
  }, [provider]);

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    iconPath: string,
    label: string
  ) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/icon', iconPath);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-80 h-full bg-[#1e1e1e] border-r border-[#333] flex flex-col overflow-hidden text-neutral-300 font-sans shadow-xl z-10">
      <div className="p-5 border-b border-[#333] backdrop-blur-md bg-[#1e1e1e]/90 sticky top-0 z-20">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-pink-500">
          ADAC Components
        </h2>

        {/* Provider Switch */}
        <div className="flex bg-[#2d2d2d] p-1 rounded-lg mt-4 border border-[#444]">
          <button
            onClick={() => setProvider('aws')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${
              provider === 'aws'
                ? 'bg-[#ec7211] text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Cloud size={14} /> AWS
          </button>
          <button
            onClick={() => setProvider('gcp')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${
              provider === 'gcp'
                ? 'bg-[#4285F4] text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-[#333]'
            }`}
          >
            <Server size={14} /> GCP
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3 font-medium">
          Drag components to the board
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {categories.map((cat) => (
          <div key={cat.category} className="group">
            <h3 className="text-xs font-bold mb-3 text-gray-500 uppercase tracking-widest pl-1 group-hover:text-orange-400 transition-colors">
              {cat.category.replace('Arch_', '').replace(/-/g, ' ')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {cat.icons.map((icon) => {
                const label = icon.name
                  .replace(/^Arch_/, '')
                  .replace(/_48\.png$/, '')
                  .replace(/_/g, ' ');
                return (
                  <div
                    key={icon.name}
                    className={`aspect-square flex flex-col items-center justify-center p-1 bg-[#252526] rounded-lg hover:bg-[#2d2d2d] cursor-grab transition-all hover:scale-105 border border-[#333] ${
                      provider === 'aws'
                        ? 'hover:border-orange-500/50 hover:shadow-orange-500/10'
                        : 'hover:border-blue-500/50 hover:shadow-blue-500/10'
                    } hover:shadow-lg active:cursor-grabbing group/item`}
                    onDragStart={(event) =>
                      onDragStart(event, 'customNode', icon.path, label)
                    }
                    draggable
                    title={label}
                  >
                    <img
                      src={icon.path}
                      alt={label}
                      className="w-8 h-8 mb-1 pointer-events-none object-contain"
                    />
                    <span className="text-[9px] text-center text-gray-400 group-hover/item:text-white leading-tight line-clamp-2 break-words w-full px-0.5">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
