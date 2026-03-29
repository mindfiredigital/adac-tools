import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from './sidebar';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Cloud: () => <div data-testid="cloud-icon" />,
  Server: () => <div data-testid="server-icon" />,
}));

const mockIcons = [
  {
    category: 'Compute',
    icons: [{ name: 'EC2', path: '/aws/ec2.svg' }],
  },
];

describe('Sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockIcons),
        })
      )
    );
  });

  it('renders correctly', async () => {
    const setProvider = vi.fn();
    render(<Sidebar provider="aws" setProvider={setProvider} />);

    expect(screen.getByText('ADAC Components')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getByText('GCP')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('EC2')).toBeInTheDocument();
    });
  });

  it('switches provider when clicked', async () => {
    const setProvider = vi.fn();
    const { rerender } = render(
      <Sidebar provider="aws" setProvider={setProvider} />
    );

    fireEvent.click(screen.getByText('GCP'));
    expect(setProvider).toHaveBeenCalledWith('gcp');

    rerender(<Sidebar provider="gcp" setProvider={setProvider} />);
    fireEvent.click(screen.getByText('AWS'));
    expect(setProvider).toHaveBeenCalledWith('aws');
  });

  it('handles drag start', async () => {
    const setProvider = vi.fn();
    render(<Sidebar provider="aws" setProvider={setProvider} />);

    await waitFor(() => {
      const iconItem = screen.getByTitle('EC2');
      const dataTransfer = {
        setData: vi.fn(),
        effectAllowed: '',
      };

      fireEvent.dragStart(iconItem, {
        dataTransfer,
      } as unknown as React.DragEvent);

      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/reactflow/type',
        'customNode'
      );
      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/reactflow/icon',
        '/aws/ec2.svg'
      );
      expect(dataTransfer.setData).toHaveBeenCalledWith(
        'application/reactflow/label',
        'EC2'
      );
    });
  });
});
