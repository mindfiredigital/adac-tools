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
import React, { useRef, useCallback, useState } from 'react';
import jsYaml from 'js-yaml';
import { Download, FileCode, Loader, ArrowLeft } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';

const nodeTypes = {
  customNode: CustomNode,
};

let id = 0;
const getId = () => `n_${id++}_${Date.now()}`;

// Helper to convert React Flow state to ADAC YAML
const generateYaml = (nodes: Node[], edges: Edge[]) => {
    // Basic structure based on test_dagre.yaml
    const yamlObj: any = {
        version: "0.1",
        metadata: {
            name: "Designed Diagram",
            description: "Generated from ADAC UI",
            created: new Date().toISOString().split('T')[0]
        },
        applications: [],
        infrastructure: {
            clouds: [
                {
                    id: "aws-production",
                    provider: "aws",
                    region: "us-east-1",
                    services: [] // To be populated
                }
            ]
        },
        connections: []
    };

    // Map Nodes to Services
    // We assume all nodes dropped are services for now
    nodes.forEach(node => {
        // We need to resolve the local icon path back to something the server or CLI understands if needed
        // For now, let's keep the path as is, or strip the web specific parts
        // The server expects "path" to exist on FS.
        // Frontend path: /assets/Architecture-Service-Icons_07312025/Arch_Analytics/48/Amazon-Athena_48.png
        // Server path: src/assets/Architecture-Service-Icons_07312025/Arch_Analytics/48/Amazon-Athena_48.png
        // We can reconstruct the relative path.
        
        let iconPath = node.data.icon as string;
        if (iconPath && iconPath.startsWith('/assets/')) {
            // Convert to relative path expected by server (CLI usually runs from root)
            // If CLI runs from root: public/assets/... or src/assets/...
            // The renderer checks fs.existsSync(path). 
            // If we run `npm start` (server), `process.cwd()` is usually project root.
            // So `public/assets/...` should work if we deployed assets there.
            // Or `src/assets/...` if we want to point to source.
            // Let's use `public` prefix which mirrors the frontend asset structure on disk.
            iconPath = 'frontend/public' + iconPath; 
        }

        const service = {
            id: node.id,
            service: "custom-service", // generic type
            name: node.data.label as string,
            description: "UI Node",
            properties: {
                 iconPath: iconPath
            }
        };
        yamlObj.infrastructure.clouds[0].services.push(service);
    });

    // Map Edges to Connections
    edges.forEach((edge, idx) => {
        const conn = {
            id: `conn-${idx}`,
            from: edge.source,
            to: edge.target,
            type: "generic-link",
            description: "Link"
        };
        yamlObj.connections.push(conn);
    });

    return jsYaml.dump(yamlObj);
};

interface EditorProps {
    onBack: () => void;
}

const Flow = ({ onBack }: EditorProps) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  
  const [generating, setGenerating] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#ec7211', strokeWidth: 2 } }, eds)),
    [setEdges],
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
        data: { label: label || 'New Node', icon: icon },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const handleDownloadYaml = () => {
      const yamlStr = generateYaml(nodes, edges);
      const blob = new Blob([yamlStr], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'design.yaml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleGenerateDiagram = async () => {
      setGenerating(true);
      try {
        const yamlStr = generateYaml(nodes, edges);
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: yamlStr,
                layout: 'elk'
            })
        });

        if (!response.ok) throw new Error('Generation failed');
        const result = await response.json();
        
        // Auto download
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
                <button 
                    onClick={handleDownloadYaml}
                    className="bg-[#252526] hover:bg-[#333] text-white p-2 rounded-lg border border-[#444] shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <FileCode size={16} className="text-blue-400" /> YAML
                </button>
                <button 
                    onClick={handleGenerateDiagram}
                    disabled={generating}
                    className="bg-[#ec7211] hover:bg-[#d6650d] text-white p-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {generating ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                    {generating ? 'Processing...' : 'Export Diagram'}
                </button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                fitView
                className="bg-[#18181b]"
            >
                <Controls className="bg-[#252526] border-[#333] fill-gray-400 text-gray-400" />
                <MiniMap className="bg-[#252526] border-[#333]" nodeColor="#ec7211" maskColor="rgba(0,0,0,0.6)" />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#333" />
            </ReactFlow>

             {/* Drag Instruction Overlay (fades out) */}
            {nodes.length === 0 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                    <div className="bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-white/10 text-center animate-pulse">
                         <p className="text-xl font-medium text-gray-300">Drag components here to start</p>
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
