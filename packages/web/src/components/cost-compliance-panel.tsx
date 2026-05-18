import {
  DollarSign,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Loader,
} from 'lucide-react';
import { useState } from 'react';
import type { Provider } from '../app';

/* ─── Types for compliance results from server ────────────────────────────── */
export interface ViolationResult {
  id: string;
  resourceId: string;
  framework: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  remediation: {
    id: string;
    description: string;
    actionableSteps: string[];
    references: string[];
  };
}

export interface ComplianceServiceResult {
  framework: string;
  isCompliant: boolean;
  violations: ViolationResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface ComplianceCheckResponse {
  byService: Record<string, ComplianceServiceResult[]>;
  results: ComplianceServiceResult[];
  remediationPlan: {
    id: string;
    resourceId: string;
    frameworks: string[];
    steps: string[];
    severity: string;
  }[];
}

/* ─── Cost item type ──────────────────────────────────────────────────────── */
export interface CostItem {
  nodeId: string;
  label: string;
  tier: string;
  monthlyCost: number;
}

/* ─── Panel Props ─────────────────────────────────────────────────────────── */
interface CostCompliancePanelProps {
  mode: 'cost' | 'compliance';
  provider: Provider;
  costItems: CostItem[];
  complianceResults: ComplianceCheckResponse | null;
  isCheckingCompliance: boolean;
  onRunComplianceCheck: () => void;
  onClose: () => void;
}

export const CostCompliancePanel = ({
  mode,
  provider,
  costItems,
  complianceResults,
  isCheckingCompliance,
  onRunComplianceCheck,
  onClose,
}: CostCompliancePanelProps) => {
  const accentColor = provider === 'aws' ? '#ec7211' : '#4285F4';
  const totalCost = costItems.reduce((sum, item) => sum + item.monthlyCost, 0);

  return (
    <div className="absolute top-16 right-4 z-30 w-[380px] max-h-[calc(100vh-120px)] bg-[#1a1a1d]/95 backdrop-blur-xl border border-[#333] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-panel-in">
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-[#333] flex items-center justify-between shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
        }}
      >
        <div className="flex items-center gap-2.5">
          {mode === 'cost' ? (
            <DollarSign size={18} className="text-emerald-400" />
          ) : (
            <Shield size={18} className="text-blue-400" />
          )}
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {mode === 'cost' ? 'Cost Summary' : 'Compliance Check'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#333] transition-colors text-gray-400 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {mode === 'cost' ? (
          <CostView
            costItems={costItems}
            totalCost={totalCost}
            accentColor={accentColor}
          />
        ) : (
          <ComplianceView
            results={complianceResults}
            isChecking={isCheckingCompliance}
            onRunCheck={onRunComplianceCheck}
            accentColor={accentColor}
          />
        )}
      </div>

      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-panel-in {
          animation: panelIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

/* ─── Cost View ───────────────────────────────────────────────────────────── */
function CostView({
  costItems,
  totalCost,
  accentColor,
}: {
  costItems: CostItem[];
  totalCost: number;
  accentColor: string;
}) {
  if (costItems.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No costs configured yet.</p>
        <p className="text-[11px] text-gray-600 mt-1">
          Click on a node to configure its pricing tier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total card */}
      <div
        className="rounded-xl p-4 border"
        style={{
          background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}20)`,
          borderColor: `${accentColor}30`,
        }}
      >
        <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">
          Total Monthly Estimate
        </div>
        <div className="text-3xl font-black text-white">
          ${totalCost.toFixed(2)}
          <span className="text-sm font-normal text-gray-500 ml-1">/month</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          ${(totalCost * 12).toFixed(2)}/year • {costItems.length} service
          {costItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Per-service breakdown */}
      <div className="space-y-1.5">
        {costItems
          .sort((a, b) => b.monthlyCost - a.monthlyCost)
          .map((item) => {
            const pct =
              totalCost > 0 ? (item.monthlyCost / totalCost) * 100 : 0;
            return (
              <div
                key={item.nodeId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#252526] border border-[#333] hover:border-[#444] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-gray-500">{item.tier}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-emerald-400">
                    ${item.monthlyCost.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-600">
                    {pct.toFixed(0)}%
                  </div>
                </div>
                {/* Mini bar */}
                <div className="w-12 h-1.5 bg-[#333] rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: accentColor }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ─── Compliance View ─────────────────────────────────────────────────────── */
function ComplianceView({
  results,
  isChecking,
  onRunCheck,
  accentColor,
}: {
  results: ComplianceCheckResponse | null;
  isChecking: boolean;
  onRunCheck: () => void;
  accentColor: string;
}) {
  return (
    <div className="space-y-4">
      {/* Run check button */}
      <button
        onClick={onRunCheck}
        disabled={isChecking}
        className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
        style={{
          background: isChecking ? '#333' : accentColor,
          color: isChecking ? '#888' : '#fff',
        }}
      >
        {isChecking ? (
          <>
            <Loader size={14} className="animate-spin" /> Checking…
          </>
        ) : (
          <>
            <ShieldCheck size={14} /> Run Compliance Check
          </>
        )}
      </button>

      {/* Results */}
      {results && <ComplianceResults data={results} />}

      {!results && !isChecking && (
        <div className="text-center py-8">
          <Shield size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Assign compliance frameworks to nodes, then run the check.
          </p>
        </div>
      )}
    </div>
  );
}

function ComplianceResults({ data }: { data: ComplianceCheckResponse }) {
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const serviceEntries = Object.entries(data.byService);

  // Compute overall stats
  const totalViolations = data.results.reduce(
    (sum, r) => sum + r.summary.total,
    0
  );
  const totalCritical = data.results.reduce(
    (sum, r) => sum + r.summary.critical,
    0
  );
  const totalHigh = data.results.reduce((sum, r) => sum + r.summary.high, 0);
  const allCompliant = data.results.every((r) => r.isCompliant);

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div
        className={`rounded-xl p-4 border ${
          allCompliant
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          {allCompliant ? (
            <ShieldCheck size={18} className="text-emerald-400" />
          ) : (
            <ShieldAlert size={18} className="text-red-400" />
          )}
          <span
            className={`text-sm font-bold ${
              allCompliant ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {allCompliant
              ? 'All Compliant'
              : `${totalViolations} Violation${totalViolations !== 1 ? 's' : ''} Found`}
          </span>
        </div>
        {!allCompliant && (
          <div className="flex gap-3 mt-2 text-[10px]">
            {totalCritical > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">
                {totalCritical} Critical
              </span>
            )}
            {totalHigh > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-bold">
                {totalHigh} High
              </span>
            )}
          </div>
        )}
      </div>

      {/* Per-service results */}
      {serviceEntries.length > 0 ? (
        <div className="space-y-1.5">
          {serviceEntries.map(([serviceId, serviceResults]) => {
            const isExpanded = expandedService === serviceId;
            const hasViolations = serviceResults.some((r) => !r.isCompliant);
            const violationCount = serviceResults.reduce(
              (sum, r) => sum + r.summary.total,
              0
            );

            return (
              <div
                key={serviceId}
                className="rounded-lg border border-[#333] overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#252526] hover:bg-[#2a2a2d] transition-colors text-left"
                  onClick={() =>
                    setExpandedService(isExpanded ? null : serviceId)
                  }
                >
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={12} className="text-gray-500" />
                  )}
                  {hasViolations ? (
                    <AlertTriangle size={12} className="text-amber-400" />
                  ) : (
                    <ShieldCheck size={12} className="text-emerald-400" />
                  )}
                  <span className="text-xs font-semibold text-white flex-1 truncate">
                    {serviceId}
                  </span>
                  {hasViolations && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">
                      {violationCount}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2 bg-[#1e1e1e]">
                    {serviceResults.map((result) => (
                      <div key={result.framework}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {result.isCompliant ? (
                            <ShieldCheck
                              size={10}
                              className="text-emerald-400"
                            />
                          ) : (
                            <ShieldAlert size={10} className="text-red-400" />
                          )}
                          <span className="text-[10px] font-bold text-gray-300 uppercase">
                            {result.framework}
                          </span>
                        </div>
                        {result.violations.map((v) => (
                          <div
                            key={v.id + v.framework}
                            className="ml-4 mb-1.5 p-2 rounded bg-[#252526] border border-[#333]"
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <SeverityBadge severity={v.severity} />
                              <span className="text-[10px] text-gray-300">
                                {v.message}
                              </span>
                            </div>
                            {v.remediation?.actionableSteps?.length > 0 && (
                              <div className="text-[9px] text-gray-500 mt-1 pl-2 border-l border-emerald-500/30">
                                {v.remediation.actionableSteps.map(
                                  (step, i) => (
                                    <div key={i}>💡 {step}</div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {result.isCompliant && (
                          <p className="ml-4 text-[10px] text-emerald-500/70 italic">
                            ✓ Fully compliant
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-xs text-gray-500 py-4">
          No services with compliance frameworks assigned.
        </p>
      )}

      {/* Remediation Plan */}
      {data.remediationPlan.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Remediation Plan
          </h4>
          <div className="space-y-2">
            {data.remediationPlan.map((item) => (
              <div
                key={item.id + item.resourceId}
                className="p-3 rounded-lg bg-[#252526] border border-[#333]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge
                    severity={
                      item.severity as 'low' | 'medium' | 'high' | 'critical'
                    }
                  />
                  <span className="text-[10px] font-semibold text-white">
                    {item.resourceId}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    {item.frameworks.map((fw) => (
                      <span
                        key={fw}
                        className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase font-bold"
                      >
                        {fw}
                      </span>
                    ))}
                  </div>
                </div>
                {item.steps.map((step, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-gray-400 mt-1 flex gap-1.5"
                  >
                    <span className="text-emerald-500">→</span> {step}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300',
    high: 'bg-orange-500/20 text-orange-300',
    medium: 'bg-amber-500/20 text-amber-300',
    low: 'bg-blue-500/20 text-blue-300',
  };

  return (
    <span
      className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
        colors[severity] || colors.low
      }`}
    >
      {severity}
    </span>
  );
}
