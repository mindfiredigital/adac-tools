import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { DollarSign, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

const CustomNode = ({ data }: NodeProps) => {
  // Not using setNodes because the delete button layout was changed

  const hasCost = !!(data.costConfig as Record<string, unknown>)?.tier;
  const monthlyCost = (data.costConfig as Record<string, unknown>)
    ?.monthlyCost as number | undefined;
  const complianceFrameworks = (data.complianceFrameworks as string[]) || [];
  const hasCompliance = complianceFrameworks.length > 0;
  const complianceStatus = data.complianceStatus as
    | 'pass'
    | 'fail'
    | 'unchecked'
    | undefined;

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

      {/* ─── Cost Badge ──── */}
      {hasCost && monthlyCost !== undefined && monthlyCost > 0 && (
        <div
          className="absolute -top-2.5 -left-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/90 text-white shadow-lg z-40 pointer-events-none select-none"
          title={`$${monthlyCost.toFixed(2)}/mo`}
        >
          <DollarSign size={8} />
          {monthlyCost.toFixed(0)}
        </div>
      )}

      {/* ─── Compliance Badge ──── */}
      {hasCompliance && (
        <div
          className={`absolute -bottom-2.5 -left-2.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-lg z-40 pointer-events-none select-none ${
            complianceStatus === 'pass'
              ? 'bg-emerald-500/90 text-white'
              : complianceStatus === 'fail'
                ? 'bg-red-500/90 text-white'
                : 'bg-blue-500/80 text-white'
          }`}
          title={
            complianceStatus === 'pass'
              ? 'All compliant'
              : complianceStatus === 'fail'
                ? 'Violations found'
                : `${complianceFrameworks.length} framework(s)`
          }
        >
          {complianceStatus === 'pass' ? (
            <ShieldCheck size={8} />
          ) : complianceStatus === 'fail' ? (
            <ShieldAlert size={8} />
          ) : (
            <Shield size={8} />
          )}
          {complianceFrameworks.length}
        </div>
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
