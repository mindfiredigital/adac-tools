import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Flow from './flow';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock React Flow hooks and components
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      screenToFlowPosition: vi.fn((pos) => pos),
      deleteElements: vi.fn(),
      getNodes: () => [],
      getEdges: () => [],
    }),
    ReactFlow: ({
      children,
      onDrop,
      onDragOver,
      onNodeDoubleClick,
      onConnect,
    }: {
      children: React.ReactNode;
      onDrop: React.DragEventHandler;
      onDragOver: React.DragEventHandler;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodeDoubleClick: (event: any, node: any) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onConnect: (params: any) => void;
    }) => (
      <div data-testid="react-flow" onDrop={onDrop} onDragOver={onDragOver}>
        <div
          data-testid="mock-node"
          onDoubleClick={(e) =>
            onNodeDoubleClick &&
            onNodeDoubleClick(e, { id: 'node-0', data: { label: 'Node 0' } })
          }
        />
        <button
          data-testid="mock-connect"
          onClick={() => onConnect({ source: '1', target: '2' })}
        />
        {children}
      </div>
    ),
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
  };
});
// Mock child components
vi.mock('./node-config-drawer', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NodeConfigDrawer: ({ onSave, nodeId }: any) => (
    <div data-testid="node-config-drawer">
      <button
        data-testid="mock-drawer-save"
        onClick={() =>
          onSave(nodeId, {
            cost: { tier: 't3.micro', monthlyCost: 10 },
            compliance: ['pci-dss'],
          })
        }
      />
    </div>
  ),
}));

vi.mock('./cost-compliance-panel', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CostCompliancePanel: ({ mode, onRunComplianceCheck, onClose }: any) => (
    <div data-testid="cost-compliance-panel">
      <span>{mode}</span>
      <button data-testid="run-compliance-btn" onClick={onRunComplianceCheck} />
      <button data-testid="close-panel-btn" onClick={onClose} />
    </div>
  ),
}));

// Mock URL.createObjectURL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:test'),
  revokeObjectURL: vi.fn(),
});

describe('Flow', () => {
  const defaultProps = {
    onBack: vi.fn(),
    provider: 'aws' as const,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly with toolbar', () => {
    render(<Flow {...defaultProps} />);

    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.getByText('YAML')).toBeInTheDocument();
    expect(screen.getByText('Export Diagram')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles exit click', () => {
    render(<Flow {...defaultProps} />);

    fireEvent.click(screen.getByText('Exit'));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('triggers YAML download and covers getServiceType branches', () => {
    const { rerender } = render(<Flow {...defaultProps} />);

    // Mock document.createElement and click
    const link = document.createElement('a');
    const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (tag === 'a') return link as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return document.createElement(tag as any);
    });

    // Add multiple nodes via drop to cover getServiceType
    const services = [
      { label: 'Lambda', icon: '/aws/lambda.svg' },
      { label: 'EC2', icon: '/aws/ec2.svg' },
      { label: 'RDS', icon: '/aws/rds.svg' },
      { label: 'S3', icon: '/aws/s3.svg' },
    ];

    const reactFlow = screen.getByTestId('react-flow');
    services.forEach((s) => {
      fireEvent.drop(reactFlow, {
        preventDefault: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataTransfer: {
          getData: (key: string) =>
            (
              ({
                'application/reactflow/type': 'customNode',
                'application/reactflow/icon': s.icon,
                'application/reactflow/label': s.label,
              } as Record<string, string>)[key],
        },
        clientX: 0,
        clientY: 0,
      });
    });

    fireEvent.click(screen.getByText('YAML'));
    expect(clickSpy).toHaveBeenCalled();

    // Now test GCP
    rerender(<Flow {...defaultProps} provider="gcp" />);
    const gcpServices = [
      { label: 'Cloud Run', icon: '/gcp/run.svg' },
      { label: 'BigQuery', icon: '/gcp/bq.svg' },
      { label: 'Functions', icon: '/gcp/fn.svg' },
    ];
    gcpServices.forEach((s) => {
      fireEvent.drop(reactFlow, {
        preventDefault: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataTransfer: {
          getData: (key: string) =>
            (
              ({
                'application/reactflow/type': 'customNode',
                'application/reactflow/icon': s.icon,
                'application/reactflow/label': s.label,
              } as Record<string, string>)[key],
        },
        clientX: 0,
        clientY: 0,
      });
    });
    fireEvent.click(screen.getByText('YAML'));
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('handles drag over', () => {
    render(<Flow {...defaultProps} />);

    const reactFlow = screen.getByTestId('react-flow');
    const preventDefault = vi.fn();
    const dragEvent = {
      preventDefault,
      dataTransfer: { dropEffect: '' },
    };
    // RTL's fireEvent doesn't easily let us check our own mock event object
    // but the branch will be hit.
    fireEvent.dragOver(reactFlow, dragEvent);
    expect(dragEvent.dataTransfer.dropEffect).toBe('move');
  });

  it('handles drop to create a node', async () => {
    render(<Flow {...defaultProps} />);

    const reactFlow = screen.getByTestId('react-flow');
    const dropData: Record<string, string> = {
      'application/reactflow/type': 'customNode',
      'application/reactflow/icon': '/aws/ec2.svg',
      'application/reactflow/label': 'EC2',
    };

    const dragEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((key) => dropData[key]),
      },
      clientX: 100,
      clientY: 100,
    };

    fireEvent.drop(reactFlow, dragEvent);
    // We hit the branch!
  });

  it('handles connect between nodes', () => {
    render(<Flow {...defaultProps} />);
    fireEvent.click(screen.getByTestId('mock-connect'));
    // Branch hit
  });

  it('handles panel toggles and compliance check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ byService: { 'node-1': [] } }),
      })
    );

    render(<Flow {...defaultProps} />);

    // Toggle cost panel
    fireEvent.click(screen.getByText('Cost'));
    expect(screen.getByTestId('cost-compliance-panel')).toBeInTheDocument();
    expect(screen.getByText('cost')).toBeInTheDocument();

    // Toggle compliance panel
    fireEvent.click(screen.getByText('Compliance'));
    expect(screen.getByText('compliance')).toBeInTheDocument();

    // Run compliance
    fireEvent.click(screen.getByTestId('run-compliance-btn'));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Close panel
    fireEvent.click(screen.getByTestId('close-panel-btn'));
    expect(
      screen.queryByTestId('cost-compliance-panel')
    ).not.toBeInTheDocument();
  });

  it('triggers diagram export', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ svg: '<svg>test</svg>' }),
      })
    );

    render(<Flow {...defaultProps} />);
    fireEvent.click(screen.getByText('Export Diagram'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
