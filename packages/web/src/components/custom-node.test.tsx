import { render, screen, fireEvent } from '@testing-library/react';
import CustomNode from './custom-node';
import { describe, it, expect, vi } from 'vitest';
import { type NodeProps } from '@xyflow/react';

// Mock React Flow hooks
const mockSetNodes = vi.fn();
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      setNodes: mockSetNodes,
    }),
    Handle: ({ type, position }: { type: string; position: string }) => (
      <div data-testid={`handle-${type}-${position}`} />
    ),
    NodeResizer: () => <div data-testid="node-resizer" />,
  };
});

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Trash2: () => <div data-testid="trash-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  ShieldCheck: () => <div data-testid="shield-check-icon" />,
  ShieldAlert: () => <div data-testid="shield-alert-icon" />,
}));

describe('CustomNode', () => {
  const defaultProps = {
    id: 'node-1',
    data: { label: 'Test Node', icon: '/test.svg', provider: 'aws' },
    selected: false,
    zIndex: 1,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    dragging: false,
    type: 'customNode',
    dragHandle: '.drag-handle',
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };

  it('renders label and icon', () => {
    render(<CustomNode {...(defaultProps as unknown as NodeProps)} />);
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByAltText('icon')).toHaveAttribute('src', '/test.svg');
  });

  it('shows delete button when selected', () => {
    const { rerender } = render(
      <CustomNode {...(defaultProps as unknown as NodeProps)} />
    );
    expect(screen.queryByTitle('Delete Node')).not.toBeInTheDocument();

    rerender(
      <CustomNode {...(defaultProps as unknown as NodeProps)} selected={true} />
    );
    expect(screen.getByTitle('Delete Node')).toBeInTheDocument();
  });

  it('calls setNodes when delete button is clicked', () => {
    render(
      <CustomNode {...(defaultProps as unknown as NodeProps)} selected={true} />
    );
    fireEvent.click(screen.getByTitle('Delete Node'));

    // Check if the functional update filter correctly identifies the node to remove
    const setNodesArg = mockSetNodes.mock.calls[0][0];
    const nodes = [{ id: 'node-1' }, { id: 'node-2' }];
    const filteredNodes = setNodesArg(nodes);
    expect(filteredNodes).toEqual([{ id: 'node-2' }]);
  });

  it('applies correct border color based on provider', () => {
    const { container, rerender } = render(
      <CustomNode {...(defaultProps as unknown as NodeProps)} selected={true} />
    );
    // AWS color (orange)
    expect(container.firstChild).toHaveClass('border-orange-500');

    rerender(
      <CustomNode
        {...(defaultProps as unknown as NodeProps)}
        selected={true}
        data={{ ...defaultProps.data, provider: 'gcp' }}
      />
    );
    // GCP color (blue)
    expect(container.firstChild).toHaveClass('border-blue-500');

    rerender(
      <CustomNode
        {...(defaultProps as unknown as NodeProps)}
        selected={true}
        data={{ ...defaultProps.data, provider: 'azure' }}
      />
    );
    // Azure color (blue)
    expect(container.firstChild).toHaveClass('border-[#0078D4]');
  });

  it('shows cost badge when hasCost is true', () => {
    const props = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        costConfig: { tier: 't3.micro', monthlyCost: 15.5 },
      },
    };
    render(<CustomNode {...(props as unknown as NodeProps)} />);
    expect(screen.getByTitle('$15.50/mo')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument(); // 15.5 rounded up to 16
  });

  it('shows compliance badge with different statuses', () => {
    const { rerender } = render(
      <CustomNode
        {...(defaultProps as unknown as NodeProps)}
        data={{
          ...defaultProps.data,
          complianceFrameworks: ['pci-dss'],
          complianceStatus: 'pass',
        }}
      />
    );
    expect(screen.getByTitle('All compliant')).toBeInTheDocument();

    rerender(
      <CustomNode
        {...(defaultProps as unknown as NodeProps)}
        data={{
          ...defaultProps.data,
          complianceFrameworks: ['pci-dss'],
          complianceStatus: 'fail',
        }}
      />
    );
    expect(screen.getByTitle('Violations found')).toBeInTheDocument();

    rerender(
      <CustomNode
        {...(defaultProps as unknown as NodeProps)}
        data={{
          ...defaultProps.data,
          complianceFrameworks: ['pci-dss'],
          complianceStatus: 'unchecked',
        }}
      />
    );
    expect(screen.getByTitle('1 framework(s)')).toBeInTheDocument();
  });
});
