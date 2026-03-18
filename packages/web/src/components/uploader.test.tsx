import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Uploader } from './uploader';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Loader: () => <div data-testid="loader-icon" />,
  Download: () => <div data-testid="download-icon" />,
}));

describe('Uploader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders correctly', () => {
    const onBack = vi.fn();
    render(<Uploader onBack={onBack} />);

    expect(screen.getByText('Upload YAML Definition')).toBeInTheDocument();
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
  });

  it('handles file upload and generation', async () => {
    const mockFile = new File(['content: test'], 'test.yaml', {
      type: 'text/yaml',
    });
    const onBack = vi.fn();

    // Mock file.text() just in case
    mockFile.text = vi.fn().mockResolvedValue('content: test');

    // Mock fetch for generation
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ svg: '<svg id="test-svg">test</svg>' }),
      })
    );

    const { container } = render(<Uploader onBack={onBack} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [mockFile] } });

    expect(screen.getByText('test.yaml')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Generate Diagram'));

    await waitFor(() => {
      expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-right-icon')).toBeInTheDocument();
    });
  });
});
