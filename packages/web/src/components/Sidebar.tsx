import React, { useEffect, useState } from 'react';

type Icon = {
  name: string;
  path: string;
};

type Category = {
  category: string;
  icons: Icon[];
};

export const Sidebar = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/icons.json')
      .then((res) => res.json())
      .then((data) => setCategories(data));
  }, []);

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
        <p className="text-xs text-gray-500 mt-1 font-medium">
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
                    className="aspect-square flex flex-col items-center justify-center p-1 bg-[#252526] rounded-lg hover:bg-[#2d2d2d] cursor-grab transition-all hover:scale-105 border border-[#333] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 active:cursor-grabbing group/item"
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
                    <span className="text-[9px] text-center text-gray-400 group-hover/item:text-white leading-tight line-clamp-2 break-words w-full">
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
