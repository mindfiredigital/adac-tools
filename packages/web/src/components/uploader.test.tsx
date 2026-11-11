import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Uploader } from './uploader';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDiagramBrowser } from '../helper/diagram-generator';
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

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

vi.mock('../helper/diagram-generator', () => ({
  generateDiagramBrowser: vi.fn(),
}));

describe('Uploader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders correctly', () => {
    const onBack = vi.fn();
    render(<Uploader onBack={onBack} />);

    expect(screen.getByText('Upload YAML Definition')).toBeInTheDocument();
    expect(screen.getByText(/Back to Home/)).toBeInTheDocument();
  });

  it('handles file upload and generation', async () => {
    const mockFile = new File(['content: test'], 'test.yaml', {
      type: 'text/yaml',
    });
    const onBack = vi.fn();

    // Mock file.text()
    mockFile.text = vi.fn().mockResolvedValue('content: test');

    if (USE_BACKEND) {
      // Mock fetch for generation
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ svg: '<svg id="test-svg">test</svg>' }),
        })
      );
    } else {
      vi.mocked(generateDiagramBrowser).mockResolvedValue({
        svg: '<svg id="test-svg">test</svg>',
        logs: [],
        duration: 0,
      });
    }

    const { container } = render(<Uploader onBack={onBack} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [mockFile] } });

    expect(screen.getByText('test.yaml')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Generate Diagram'));

    await waitFor(() => {
      expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
    });

    // Handle download
    const createObjectURLMock = vi.fn().mockReturnValue('mock-url');
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    fireEvent.click(screen.getByText('Download SVG'));
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it('handles generation failure', async () => {
    const mockFile = new File(['content: test'], 'test.yaml', {
      type: 'text/yaml',
    });
    mockFile.text = vi.fn().mockResolvedValue('content: test');

    if (USE_BACKEND) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid schema' }),
        })
      );
    } else {
      vi.mocked(generateDiagramBrowser).mockRejectedValue(
        new Error('Invalid schema')
      );
    }

    render(<Uploader onBack={vi.fn()} />);
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [mockFile] } });

    fireEvent.click(screen.getByText('Generate Diagram'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid schema/i)).toBeInTheDocument();
    });
  });

  describe('layout engine warning', () => {
    const SHOWN =
      'Layout engine "custom" ignores declarative layout properties: layoutOptions (gap).';
    const WARNING = `${SHOWN} Use --layout elk or set layoutOptions.engine: elk.`;

    function mockGeneration(logs: string[]) {
      const result = {
        svg: '<svg id="test-svg">test</svg>',
        logs,
        duration: 0,
      };
      if (USE_BACKEND) {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(result),
          })
        );
      } else {
        vi.mocked(generateDiagramBrowser).mockResolvedValue(result);
      }
    }

    async function generate() {
      const file = new File(['content: test'], 'test.yaml', {
        type: 'text/yaml',
      });
      file.text = vi.fn().mockResolvedValue('content: test');
      render(<Uploader onBack={vi.fn()} />);
      const input = document.querySelector('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByText('Generate Diagram'));
      await waitFor(() => {
        expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
      });
    }

    it('shows a dismissible banner when the engine ignores layout properties', async () => {
      mockGeneration([`[2026-01-01T00:00:00.000Z] Warning: ${WARNING}`]);
      await generate();

      expect(screen.getByRole('alert')).toHaveTextContent(SHOWN);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      // the diagram stays
      expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
    });

    it('shows no banner without a warning', async () => {
      mockGeneration(['[2026-01-01T00:00:00.000Z] Generation complete in 5ms']);
      await generate();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('lets the file choose its engine instead of forcing elk', async () => {
      mockGeneration([]);
      await generate();
      if (!USE_BACKEND) {
        expect(generateDiagramBrowser).toHaveBeenLastCalledWith(
          'content: test'
        );
      }
    });
  });
});
