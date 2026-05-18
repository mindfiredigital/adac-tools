import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeConfigDrawer } from './node-config-drawer';
import { describe, it, expect, vi } from 'vitest';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
}));

describe('NodeConfigDrawer', () => {
  const defaultProps = {
    nodeId: 'node-1',
    nodeLabel: 'My EC2',
    nodeServiceType: 'ec2',
    provider: 'aws' as const,
    config: {},
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders correctly', () => {
    render(<NodeConfigDrawer {...defaultProps} />);

    expect(screen.getByText('My EC2')).toBeInTheDocument();
    expect(screen.getByText(/EC2 • node-1/i)).toBeInTheDocument();
    expect(screen.getByText('Cost Estimation')).toBeInTheDocument();
    expect(screen.getByText('Compliance Frameworks')).toBeInTheDocument();
  });

  it('handles onClose when clicking backdrop or X', () => {
    const onClose = vi.fn();
    render(<NodeConfigDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('x-icon'));
    expect(onClose).toHaveBeenCalled();

    // Backdrop call
    const backdrop = screen.getByText('', { selector: '.bg-black\\/40' });
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('handles selecting a cost tier', async () => {
    const onSave = vi.fn();
    render(<NodeConfigDrawer {...defaultProps} onSave={onSave} />);

    fireEvent.click(screen.getByText('Select a tier...'));

    await waitFor(() => {
      const tierOption = screen.getByText('t3.micro').closest('button');
      if (tierOption) fireEvent.click(tierOption);
    });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'node-1',
        expect.objectContaining({
          cost: expect.objectContaining({
            tier: 't3.micro',
            monthlyCost: 7.59,
          }),
        })
      );
    });
  });

  it('handles custom cost input for unknown service', async () => {
    const onSave = vi.fn();
    render(
      <NodeConfigDrawer
        {...defaultProps}
        nodeServiceType="unknown-svc"
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByText('Select a tier...'));
    await waitFor(() => {
      const customOption = screen.getByText('Custom').closest('button');
      if (customOption) fireEvent.click(customOption);
    });

    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '123.45' } });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'node-1',
        expect.objectContaining({
          cost: expect.objectContaining({
            tier: 'Custom',
            customCost: 123.45,
            monthlyCost: 123.45,
          }),
        })
      );
    });
  });

  it('handles compliance toggle', async () => {
    const onSave = vi.fn();
    render(<NodeConfigDrawer {...defaultProps} onSave={onSave} />);

    const pciBtn = screen.getByText('PCI-DSS').closest('button');
    if (pciBtn) fireEvent.click(pciBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'node-1',
        expect.objectContaining({
          compliance: ['pci-dss'],
        })
      );
    });

    // Toggle off
    if (pciBtn) fireEvent.click(pciBtn);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        'node-1',
        expect.not.objectContaining({
          compliance: expect.anything(),
        })
      );
    });
  });

  it('handles invalid compliance framework ID', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = { compliance: ['invalid-fw'] as any };
    render(<NodeConfigDrawer {...defaultProps} config={config} />);
    // This just hits the null branch in the rendering logic.
  });
});
