import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

const CustomNode = ({ data }: NodeProps) => {
  return (
    <div className="px-3 py-3 shadow-2xl rounded-xl bg-[#252526] border border-[#3e3e42] hover:border-orange-500 transition-all duration-300 min-w-[120px] flex flex-col items-center gap-2 group relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#555] !w-3 !h-3 !-top-1.5 !border-none group-hover:!bg-orange-500 transition-colors"
      />

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

      <div className="text-[11px] leading-tight text-center font-medium text-gray-300 max-w-[140px] px-1 pb-1 group-hover:text-white transition-colors">
        {data.label as string}
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
