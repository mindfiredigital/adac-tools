import {
  Handle,
  Position,
  type NodeProps,
  NodeResizer,
  useReactFlow,
} from '@xyflow/react';
import { memo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const CustomNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes } = useReactFlow();

  const onDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
    },
    [id, setNodes]
  );

  return (
    <div
      className={`px-3 py-3 shadow-2xl rounded-xl bg-[#252526] border ${
        selected
          ? data.provider === 'gcp'
            ? 'border-blue-500'
            : 'border-orange-500'
          : 'border-[#3e3e42]'
      } hover:border-orange-500/50 transition-all duration-300 min-w-[120px] w-full h-full flex flex-col items-center justify-center gap-2 group relative`}
    >
      <NodeResizer
        color={data.provider === 'gcp' ? '#4285F4' : '#ec7211'}
        isVisible={selected}
        minWidth={100}
        minHeight={100}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#555] !w-3 !h-3 !-top-1.5 !border-none group-hover:!bg-orange-500 transition-colors"
      />

      {selected && (
        <button
          onClick={onDelete}
          className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg z-50 transition-transform hover:scale-110 active:scale-95"
          title="Delete Node"
        >
          <Trash2 size={12} />
        </button>
      )}

      <div className="flex flex-col items-center gap-2 flex-grow justify-center w-full">
        <div className="p-2.5 bg-black/30 rounded-lg border border-transparent group-hover:border-white/5 transition-colors">
          {data.icon ? (
            <img
              src={data.icon as string}
              alt="icon"
              className="w-10 h-10 object-contain drop-shadow-lg"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-700/50 rounded flex items-center justify-center text-xs">
              ?
            </div>
          )}
        </div>

        <div className="text-[11px] leading-tight text-center font-medium text-gray-300 max-w-[140px] px-1 group-hover:text-white transition-colors">
          {data.label as string}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#555] !w-3 !h-3 !-bottom-1.5 !border-none group-hover:!bg-orange-500 transition-colors"
      />
    </div>
  );
};

export default memo(CustomNode);
