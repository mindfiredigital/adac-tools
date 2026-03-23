import { useState, useEffect, useCallback } from 'react';
import { X, DollarSign, Shield, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { getCostTiers, COMPLIANCE_FRAMEWORKS } from '../data/cost-catalog';
import type { CostTier, ComplianceFrameworkId } from '../data/cost-catalog';
import type { Provider } from '../app';

export interface NodeCostData {
  tier: string;
  monthlyCost: number;
  customCost?: number;
}

export interface NodeConfigData {
  cost?: NodeCostData;
  compliance?: ComplianceFrameworkId[];
}

interface NodeConfigDrawerProps {
  nodeId: string;
  nodeLabel: string;
  nodeServiceType: string;
  provider: Provider;
  config: NodeConfigData;
  onSave: (nodeId: string, config: NodeConfigData) => void;
  onClose: () => void;
}

export const NodeConfigDrawer = ({
  nodeId,
  nodeLabel,
  nodeServiceType,
  provider,
  config,
  onSave,
  onClose,
}: NodeConfigDrawerProps) => {
  const [costTier, setCostTier] = useState(config.cost?.tier || '');
  const [customCost, setCustomCost] = useState(config.cost?.customCost ?? 0);
  const [selectedFrameworks, setSelectedFrameworks] = useState<
    ComplianceFrameworkId[]
  >(config.compliance || []);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);

  const tiers = getCostTiers(nodeServiceType, provider);

  const selectedTierData: CostTier | undefined = tiers.find(
    (t) => t.name === costTier
  );
  const displayCost =
    costTier === 'Custom' ? customCost : (selectedTierData?.monthlyCost ?? 0);

  // Auto-save whenever anything changes
  const handleSave = useCallback(() => {
    const newConfig: NodeConfigData = {};

    if (costTier) {
      newConfig.cost = {
        tier: costTier,
        monthlyCost: displayCost,
        ...(costTier === 'Custom' ? { customCost } : {}),
      };
    }

    if (selectedFrameworks.length > 0) {
      newConfig.compliance = selectedFrameworks;
    }

    onSave(nodeId, newConfig);
  }, [nodeId, costTier, displayCost, customCost, selectedFrameworks, onSave]);

  useEffect(() => {
    handleSave();
  }, [handleSave]);

  const toggleFramework = (fw: ComplianceFrameworkId) => {
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );
  };

  const accentColor = provider === 'aws' ? '#ec7211' : '#4285F4';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-[420px] h-full bg-[#1a1a1d] border-l border-[#333] shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-5 border-b border-[#333] backdrop-blur-xl"
          style={{ background: 'rgba(26, 26, 29, 0.95)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${accentColor}22` }}
              >
                <DollarSign size={16} style={{ color: accentColor }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {nodeLabel}
                </h3>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                  {nodeServiceType} • {nodeId}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#333] transition-colors text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* ─── Cost Section ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Cost Estimation
              </h4>
            </div>

            {/* Tier Selector */}
            <div className="relative mb-4">
              <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                Pricing Tier
              </label>
              <button
                onClick={() => setTierDropdownOpen(!tierDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#252526] rounded-lg border border-[#444] hover:border-[#555] transition-colors text-sm text-gray-300"
              >
                <span>{costTier || 'Select a tier...'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${tierDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {tierDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#2a2a2d] border border-[#444] rounded-lg shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                  {tiers.map((tier) => (
                    <button
                      key={tier.name}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#333] transition-colors border-b border-[#333] last:border-0 ${
                        costTier === tier.name
                          ? 'bg-[#333] text-white'
                          : 'text-gray-300'
                      }`}
                      onClick={() => {
                        setCostTier(tier.name);
                        setTierDropdownOpen(false);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{tier.name}</span>
                        <span
                          className="text-xs font-bold"
                          style={{ color: accentColor }}
                        >
                          ${tier.monthlyCost.toFixed(2)}/mo
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {tier.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom cost input */}
            {costTier === 'Custom' && (
              <div className="mb-4">
                <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Monthly Cost (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={customCost}
                    onChange={(e) =>
                      setCustomCost(parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-7 pr-4 py-2.5 bg-[#252526] rounded-lg border border-[#444] text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* Cost Summary Card */}
            {costTier && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
                  borderColor: `${accentColor}30`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider">
                    Estimated Monthly
                  </span>
                  <span className="text-xl font-black text-white">
                    ${displayCost.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {selectedTierData?.description || 'Custom pricing'}
                </p>
              </div>
            )}

            {/* Clear cost */}
            {costTier && (
              <button
                onClick={() => {
                  setCostTier('');
                  setCustomCost(0);
                }}
                className="flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} /> Remove cost
              </button>
            )}
          </section>

          {/* ─── Compliance Section ────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-blue-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Compliance Frameworks
              </h4>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              Select the compliance standards this service must adhere to.
              Violations will be checked automatically.
            </p>

            <div className="space-y-2">
              {COMPLIANCE_FRAMEWORKS.map((fw) => {
                const isSelected = selectedFrameworks.includes(fw.id);
                return (
                  <button
                    key={fw.id}
                    onClick={() => toggleFramework(fw.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/40 text-white'
                        : 'bg-[#252526] border-[#333] text-gray-400 hover:border-[#555] hover:text-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#333] text-gray-600'
                      }`}
                    >
                      {isSelected ? '✓' : <Plus size={10} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block">
                        {fw.name}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-tight block">
                        {fw.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </div>
  );
};
