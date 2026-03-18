import { render, screen, fireEvent } from '@testing-library/react';
import Flow from './flow';
import { describe, it, expect, vi } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';

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
    }: {
      children: React.ReactNode;
      onDrop: React.DragEventHandler;
      onDragOver: React.DragEventHandler;
    }) => (
      <div data-testid="react-flow" onDrop={onDrop} onDragOver={onDragOver}>
        {children}
      </div>
    ),
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
  };
});

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

  it('renders correctly with toolbar', () => {
    render(
      <ReactFlowProvider>
        <Flow {...defaultProps} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.getByText('YAML')).toBeInTheDocument();
    expect(screen.getByText('Export Diagram')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles exit click', () => {
    render(
      <ReactFlowProvider>
        <Flow {...defaultProps} />
      </ReactFlowProvider>
    );

    fireEvent.click(screen.getByText('Exit'));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('triggers YAML download', () => {
    render(
      <ReactFlowProvider>
        <Flow {...defaultProps} />
      </ReactFlowProvider>
    );

    // Mock document.createElement and click
    const link = {
      href: '',
      download: '',
      click: vi.fn(),
      setAttribute: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(
      link as unknown as HTMLAnchorElement
    );
    vi.spyOn(document.body, 'appendChild').mockImplementation(
      () => null as unknown as Node
    );
    vi.spyOn(document.body, 'removeChild').mockImplementation(
      () => null as unknown as Node
    );

    fireEvent.click(screen.getByText('YAML'));

    expect(link.download).toBe('design.yaml');
    expect(link.click).toHaveBeenCalled();
  });
});
