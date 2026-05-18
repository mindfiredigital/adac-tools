import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  type Connection,
  type Edge,
  useReactFlow,
  BackgroundVariant,
  type Node,
} from '@xyflow/react';
import React, { useRef, useCallback, useState, useMemo } from 'react';
import jsYaml from 'js-yaml';
import {
  Download,
  FileCode,
  Loader,
  ArrowLeft,
  Trash2,
  DollarSign,
  Shield,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import CustomNode from './custom-node';
import { NodeConfigDrawer, type NodeConfigData } from './node-config-drawer';
import {
  CostCompliancePanel,
  type CostItem,
  type ComplianceCheckResponse,
} from './cost-compliance-panel';
import type { Provider } from '../app';

const nodeTypes = {
  customNode: CustomNode,
};

let idCounter = 0;
const getId = () => `node-${idCounter++}`;

/**
 * Map label/icon to a valid ADAC service type.
 */
export const getServiceType = (
  label: string,
  path: string,
  provider: Provider
): string => {
  const l = (label || '').toLowerCase();
  const p = (path || '').toLowerCase();

  if (provider === 'aws') {
    if (l.includes('athena') || p.includes('athena')) return 'athena';
    if (l.includes('s3') || p.includes('s3')) return 's3';
    if (l.includes('lambda') || p.includes('lambda')) return 'lambda';
    if (l.includes('ec2') || p.includes('ec2')) return 'ec2';
    if (l.includes('rds') || p.includes('rds')) return 'rds-mysql';
    if (l.includes('dynamodb') || p.includes('dynamodb')) return 'dynamodb';
    if (l.includes('eventbridge') || p.includes('eventbridge'))
      return 'eventbridge';
    if (l.includes('sqs') || p.includes('sqs')) return 'sqs';
    if (l.includes('sns') || p.includes('sns')) return 'sns';
    if (l.includes('iam') || p.includes('iam')) return 'iam';
    if (l.includes('vpc') || p.includes('vpc')) return 'vpc';
    if (l.includes('api gateway') || p.includes('api-gateway'))
      return 'api-gateway-rest';
    if (l.includes('cloudfront') || p.includes('cloudfront'))
      return 'cloudfront';
    if (l.includes('route 53') || p.includes('route53')) return 'route53';
    if (l.includes('fargate') || p.includes('fargate')) return 'ecs-fargate';
    if (l.includes('glue') || p.includes('glue')) return 'glue';
    if (l.includes('emr') || p.includes('emr')) return 'emr';
    if (l.includes('cognito') || p.includes('cognito')) return 'cognito';
    return 'ec2';
  } else if (provider === 'gcp') {
    if (l.includes('compute engine') || p.includes('computeengine'))
      return 'compute-engine';
    if (l.includes('cloud run') || p.includes('cloudrun')) return 'cloud-run';
    if (l.includes('gke') || p.includes('gke') || l.includes('kubernetes'))
      return 'gke';
    if (l.includes('cloud storage') || p.includes('storage'))
      return 'cloud-storage';
    if (l.includes('bigquery') || p.includes('bigquery')) return 'bigquery';
    if (l.includes('cloud sql') || p.includes('cloudsql')) return 'cloud-sql';
    if (l.includes('vpc') || p.includes('networking')) return 'vpc';
    if (l.includes('functions') || p.includes('functions'))
      return 'cloud-functions';
    if (l.includes('spanner') || p.includes('spanner')) return 'cloud-spanner';
    if (l.includes('bigtable') || p.includes('bigtable')) return 'bigtable';
    if (l.includes('alloydb') || p.includes('alloydb')) return 'alloydb';
    if (l.includes('vertex') || p.includes('vertex')) return 'vertex-ai';
    if (l.includes('pubsub') || p.includes('pub-sub')) return 'pubsub';
    if (l.includes('build') || p.includes('build')) return 'cloud-build';
    return 'compute-engine';
  } else {
    // Azure
    if (l.includes('virtual machine') || p.includes('virtual-machine'))
      return 'virtual-machine';
    if (l.includes('app service') || p.includes('app-service'))
      return 'app-service';
    if (l.includes('function app') || p.includes('function-app'))
      return 'function-app';
    if (l.includes('kubernetes') || p.includes('kubernetes')) return 'aks';
    if (l.includes('storage account') || p.includes('storage'))
      return 'storage-account';
    if (l.includes('sql database') || p.includes('sql')) return 'sql-database';
    if (l.includes('cosmos') || p.includes('cosmos')) return 'cosmos-db';
    if (l.includes('virtual network') || p.includes('vnet')) return 'vnet';
    if (l.includes('load balancer') || p.includes('load-balancer'))
      return 'load-balancer';
    return 'virtual-machine';
  }
};

// Helper to convert React Flow state to ADAC YAML
export const generateYaml = (
  nodes: Node[],
  edges: Edge[],
  provider: Provider
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yamlObj: any = {
    version: '0.1',
    metadata: {
      name: 'Designed Diagram',
      description: 'Generated from ADAC UI',
      created: new Date().toISOString().split('T')[0],
    },
    applications: [],
    infrastructure: {
      clouds: [
        {
          id: `${provider}-production`,
          provider: provider,
          region:
            provider === 'aws'
              ? 'us-east-1'
              : provider === 'gcp'
                ? 'us-central1'
                : 'eastus',
          services: [],
        },
      ],
    },
    connections: [],
  };

  // Track total cost
  let totalMonthlyCost = 0;

  // Map Nodes to Services
  nodes.forEach((node) => {
    let iconPath = node.data.icon as string;
    if (iconPath && iconPath.startsWith('/assets/')) {
      iconPath = 'packages/web/public' + iconPath;
    }

    const serviceType = getServiceType(
      node.data.label as string,
      node.data.icon as string,
      provider
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service: any = {
      id: node.id,
      service: serviceType,
      name: node.data.label as string,
      description: 'UI Node',
      configuration: {
        instance_type: 't3.medium',
      },
      visual: {
        icon: iconPath,
      },
    };

    // Add cost data if configured
    const costConfig = node.data.costConfig as
      | { tier: string; monthlyCost: number }
      | undefined;
    if (costConfig?.tier) {
      service.cost = {
        tier: costConfig.tier,
        monthly_estimate: costConfig.monthlyCost,
        currency: 'USD',
      };
      totalMonthlyCost += costConfig.monthlyCost;
    }

    // Add compliance frameworks if configured
    const complianceFrameworks = node.data.complianceFrameworks as
      | string[]
      | undefined;
    if (complianceFrameworks && complianceFrameworks.length > 0) {
      service.compliance = complianceFrameworks;
    }

    yamlObj.infrastructure.clouds[0].services.push(service);
  });

  // Add top-level cost summary if any service has cost
  if (totalMonthlyCost > 0) {
    yamlObj.cost = {
      total_monthly_estimate: totalMonthlyCost,
      currency: 'USD',
    };
  }

  // Map Edges to Connections
  edges.forEach((edge, idx) => {
    const conn = {
      id: edge.id || `conn-${idx}`,
      from: edge.source,
      to: edge.target,
      type: 'generic-link',
      description: 'Link',
    };
    yamlObj.connections.push(conn);
  });

  return jsYaml.dump(yamlObj);
};

interface EditorProps {
  onBack: () => void;
  provider: Provider;
}

const Flow = ({ onBack, provider }: EditorProps) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, deleteElements } = useReactFlow();

  const [generating, setGenerating] = useState(false);

  // ─── Node Config Drawer State ───────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<
    Record<string, NodeConfigData>
  >({});

  // ─── Panels State ───────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState<'cost' | 'compliance' | null>(
    null
  );
  const [complianceResults, setComplianceResults] =
    useState<ComplianceCheckResponse | null>(null);
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false);

  // Get the selected node
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Compute cost items from nodes
  const costItems: CostItem[] = useMemo(() => {
    return nodes
      .filter((n) => {
        const cfg = n.data.costConfig as
          | { tier: string; monthlyCost: number }
          | undefined;
        return cfg?.tier;
      })
      .map((n) => {
        const cfg = n.data.costConfig as {
          tier: string;
          monthlyCost: number;
        };
        return {
          nodeId: n.id,
          label: n.data.label as string,
          tier: cfg.tier,
          monthlyCost: cfg.monthlyCost,
        };
      });
  }, [nodes]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: {
              stroke:
                provider === 'aws'
                  ? '#ec7211'
                  : provider === 'gcp'
                    ? '#4285F4'
                    : '#0078D4',
              strokeWidth: 2,
            },
          },
          eds
        )
      ),
    [setEdges, provider]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const icon = event.dataTransfer.getData('application/reactflow/icon');
      const label = event.dataTransfer.getData('application/reactflow/label');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: label || 'New Node', icon: icon, provider: provider },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  // ─── Node Click → Open Config Drawer ───────────────────────────────────
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // ─── Save Node Config ──────────────────────────────────────────────────
  const handleSaveNodeConfig = useCallback(
    (nodeId: string, config: NodeConfigData) => {
      setNodeConfigs((prev) => ({ ...prev, [nodeId]: config }));

      // Update the node data so badges render
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: {
              ...n.data,
              costConfig: config.cost
                ? {
                    tier: config.cost.tier,
                    monthlyCost: config.cost.monthlyCost,
                  }
                : undefined,
              complianceFrameworks: config.compliance || [],
            },
          };
        })
      );
    },
    [setNodes]
  );

  // ─── Run Compliance Check ──────────────────────────────────────────────
  const handleRunComplianceCheck = useCallback(async () => {
    setIsCheckingCompliance(true);
    try {
      const yamlStr = generateYaml(nodes, edges, provider);
      const response = await fetch('/api/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: yamlStr }),
      });

      if (!response.ok) throw new Error('Compliance check failed');
      const result: ComplianceCheckResponse = await response.json();
      setComplianceResults(result);

      // Update node compliance statuses
      setNodes((nds) =>
        nds.map((n) => {
          const serviceResults = result.byService[n.id];
          if (!serviceResults) return n;
          const hasViolations = serviceResults.some((r) => !r.isCompliant);
          return {
            ...n,
            data: {
              ...n.data,
              complianceStatus: hasViolations ? 'fail' : 'pass',
            },
          };
        })
      );
    } catch (e) {
      console.error('Compliance check error:', e);
      alert('Failed to run compliance check. Make sure the server is running.');
    } finally {
      setIsCheckingCompliance(false);
    }
  }, [nodes, edges, provider, setNodes]);

  const handleDownloadYaml = () => {
    const yamlStr = generateYaml(nodes, edges, provider);
    const blob = new Blob([yamlStr], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleGenerateDiagram = async () => {
    setGenerating(true);
    try {
      const yamlStr = generateYaml(nodes, edges, provider);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: yamlStr,
          layout: 'elk',
        }),
      });

      if (!response.ok) throw new Error('Generation failed');
      const result = await response.json();

      const blob = new Blob([result.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to generate diagram from current state.');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);
    deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [nodes, edges, deleteElements]);

  // Compute total cost for toolbar badge
  const totalMonthlyCost = costItems.reduce(
    (sum, item) => sum + item.monthlyCost,
    0
  );

  // Count nodes with compliance
  const complianceNodeCount = nodes.filter((n) => {
    const fws = n.data.complianceFrameworks as string[] | undefined;
    return fws && fws.length > 0;
  }).length;

  return (
    <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
      {/* Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={onBack}
          className="bg-[#252526] hover:bg-[#333] text-white p-2 rounded-lg border border-[#444] shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Exit
        </button>
        <div className="w-px h-8 bg-[#444] mx-1"></div>

        {(nodes.some((n) => n.selected) || edges.some((e) => e.selected)) && (
          <button
            onClick={handleDeleteSelected}
            className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded-lg border border-red-500/50 shadow-lg flex items-center gap-2 text-sm font-medium transition-all animate-in fade-in zoom-in duration-200"
          >
            <Trash2 size={16} /> Delete Selected
          </button>
        )}

        {/* Cost Button */}
        <button
          onClick={() => setActivePanel(activePanel === 'cost' ? null : 'cost')}
          className={`p-2 rounded-lg border shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
            activePanel === 'cost'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-[#252526] hover:bg-[#333] border-[#444] text-white'
          }`}
        >
          <DollarSign size={16} className="text-emerald-400" />
          {totalMonthlyCost > 0 && (
            <span className="text-emerald-400 text-xs font-bold">
              ${totalMonthlyCost.toFixed(0)}/mo
            </span>
          )}
          {totalMonthlyCost === 0 && 'Cost'}
        </button>

        {/* Compliance Button */}
        <button
          onClick={() =>
            setActivePanel(activePanel === 'compliance' ? null : 'compliance')
          }
          className={`p-2 rounded-lg border shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
            activePanel === 'compliance'
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
              : 'bg-[#252526] hover:bg-[#333] border-[#444] text-white'
          }`}
        >
          <Shield size={16} className="text-blue-400" />
          {complianceNodeCount > 0 && (
            <span className="text-blue-400 text-xs font-bold">
              {complianceNodeCount}
            </span>
          )}
          {complianceNodeCount === 0 && 'Compliance'}
        </button>

        <div className="w-px h-8 bg-[#444] mx-1"></div>

        <button
          onClick={handleDownloadYaml}
          className="bg-[#252526] hover:bg-[#333] text-white p-2 rounded-lg border border-[#444] shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <FileCode size={16} className="text-blue-400" /> YAML
        </button>
        <button
          onClick={handleGenerateDiagram}
          disabled={generating}
          className={`${
            provider === 'aws'
              ? 'bg-[#ec7211] hover:bg-[#d6650d]'
              : provider === 'gcp'
                ? 'bg-[#4285F4] hover:bg-[#3367d6]'
                : 'bg-[#0078D4] hover:bg-[#005a9e]'
          } text-white p-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {generating ? (
            <Loader size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {generating ? 'Processing...' : 'Export Diagram'}
        </button>
      </div>

      {/* Cost / Compliance Panel */}
      {activePanel && (
        <CostCompliancePanel
          mode={activePanel}
          provider={provider}
          costItems={costItems}
          complianceResults={complianceResults}
          isCheckingCompliance={isCheckingCompliance}
          onRunComplianceCheck={handleRunComplianceCheck}
          onClose={() => setActivePanel(null)}
        />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#18181b]"
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Controls className="bg-[#252526] border-[#333] fill-gray-400 text-gray-400" />
        <MiniMap
          className="bg-[#252526] border-[#333]"
          nodeColor={
            provider === 'aws'
              ? '#ec7211'
              : provider === 'gcp'
                ? '#4285F4'
                : '#0078D4'
          }
          maskColor="rgba(0,0,0,0.6)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={12}
          size={1}
          color="#333"
        />
      </ReactFlow>

      {/* Node Config Drawer */}
      {selectedNode && (
        <NodeConfigDrawer
          nodeId={selectedNode.id}
          nodeLabel={selectedNode.data.label as string}
          nodeServiceType={getServiceType(
            selectedNode.data.label as string,
            selectedNode.data.icon as string,
            provider
          )}
          provider={provider}
          config={nodeConfigs[selectedNode.id] || {}}
          onSave={handleSaveNodeConfig}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* Drag Instruction Overlay */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-white/10 text-center animate-pulse">
            <p className="text-xl font-medium text-gray-300">
              Drag components here to start
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Double-click nodes to configure cost & compliance
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default (props: EditorProps) => (
  <ReactFlowProvider>
    <Flow {...props} />
  </ReactFlowProvider>
);
