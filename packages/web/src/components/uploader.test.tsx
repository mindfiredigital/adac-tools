import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { Uploader } from './uploader';
import { generateDiagramBrowser } from '../helper/diagram-generator';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// A spy, not a replacement: the real helper still runs. It only lets a test
// await the promise of a generation that is already in flight.
vi.mock('../helper/diagram-generator', async (importActual) => {
  const actual =
    await importActual<typeof import('../helper/diagram-generator')>();
  return {
    ...actual,
    generateDiagramBrowser: vi.fn(actual.generateDiagramBrowser),
  };
});

// The browser path runs the real helper and generator. Only external I/O is
// stubbed: `fetch`, which serves the backend and the icon files.
const notFound = { ok: false, status: 404, text: () => Promise.resolve('') };

const diagramYaml = (layoutOptions = '') => `version: '0.2'
metadata: { name: Upload Test, created: '2026-01-01' }
${layoutOptions}
infrastructure:
  clouds:
    - id: aws-main
      provider: aws
      region: us-east-1
      services:
        - { id: web, service: ec2 }
        - { id: db, service: ec2 }
connections:
  - { id: c1, from: web, to: db, type: api-call }
`;

const PLAIN_YAML = diagramYaml();
// the file picks an engine that ignores the declared gap
const CUSTOM_ENGINE_YAML = diagramYaml(
  'layoutOptions: { engine: custom, gap: 1 }'
);
const INVALID_YAML = 'a: [unclosed';

function yamlFile(content: string) {
  const file = new File([content], 'test.yaml', { type: 'text/yaml' });
  file.text = vi.fn().mockResolvedValue(content);
  return file;
}

/** Backend mode answers generation with `body`; browser mode needs no stub. */
function stubBackend(body: object, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })
  );
}

describe('Uploader', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(notFound));
    vi.mocked(generateDiagramBrowser).mockClear();
  });

  it('renders correctly', () => {
    const onBack = vi.fn();
    render(<Uploader onBack={onBack} />);

    expect(screen.getByText('Upload YAML Definition')).toBeInTheDocument();
    expect(screen.getByText(/Back to Home/)).toBeInTheDocument();
  });

  it('handles file upload and generation', async () => {
    const onBack = vi.fn();

    if (USE_BACKEND) {
      stubBackend({ svg: '<svg id="test-svg">test</svg>' });
    }

    const { container } = render(<Uploader onBack={onBack} />);
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [yamlFile(PLAIN_YAML)] } });

    expect(screen.getByText('test.yaml')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Generate Diagram'));

    await waitFor(
      () => {
        expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
      },
      { timeout: 20000 }
    );

    // Handle download
    const createObjectURLMock = vi.fn().mockReturnValue('mock-url');
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    fireEvent.click(screen.getByText('Download SVG'));
    expect(createObjectURLMock).toHaveBeenCalled();
  }, 30000);

  it('handles generation failure', async () => {
    if (USE_BACKEND) {
      stubBackend({ error: 'Invalid schema' }, false);
    }

    render(<Uploader onBack={vi.fn()} />);
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [yamlFile(USE_BACKEND ? PLAIN_YAML : INVALID_YAML)] },
    });

    fireEvent.click(screen.getByText('Generate Diagram'));

    // the backend reports a schema error; the browser path fails to parse
    await waitFor(() => {
      expect(
        screen.getByText(
          USE_BACKEND ? /Invalid schema/i : /Failed to parse YAML/i
        )
      ).toBeInTheDocument();
    });
  });

  describe('switching files during a generation', () => {
    function deferredFile(content: string) {
      let settle!: { resolve: () => void; reject: (e: Error) => void };
      const file = new File([content], 'first.yaml', { type: 'text/yaml' });
      file.text = vi.fn(
        () =>
          new Promise<string>((resolve, reject) => {
            settle = { resolve: () => resolve(content), reject };
          })
      );
      return { file, settle: () => settle };
    }

    const pick = (file: File) =>
      fireEvent.change(document.querySelector('input[type="file"]')!, {
        target: { files: [file] },
      });

    it('ignores an error from the previous file', async () => {
      const first = deferredFile(PLAIN_YAML);
      render(<Uploader onBack={vi.fn()} />);
      pick(first.file);
      fireEvent.click(screen.getByText('Generate Diagram'));

      pick(yamlFile(PLAIN_YAML));
      expect(screen.getByText('Generate Diagram')).toBeEnabled();

      await act(async () => {
        first.settle().reject(new Error('stale failure'));
      });
      expect(screen.queryByText(/stale failure/)).not.toBeInTheDocument();
      expect(screen.getByText('Generate Diagram')).toBeEnabled();
    });

    it('does not show the diagram or warnings of the previous file', async () => {
      // the backend answers with a diagram and a warning; the browser path
      // produces both from the real generator
      if (USE_BACKEND) {
        stubBackend({
          svg: '<svg id="stale-svg">stale</svg>',
          logs: [
            '[2026-01-01T00:00:00.000Z] Warning: Layout engine "custom" ignores declarative layout properties: layoutOptions (gap).',
          ],
          duration: 0,
        });
      }
      const first = deferredFile(CUSTOM_ENGINE_YAML);
      render(<Uploader onBack={vi.fn()} />);
      pick(first.file);
      fireEvent.click(screen.getByText('Generate Diagram'));

      pick(yamlFile(PLAIN_YAML));
      await act(async () => {
        first.settle().resolve();
      });
      // the request the first file started, awaited until it has finished
      const started = USE_BACKEND
        ? vi.mocked(fetch)
        : vi.mocked(generateDiagramBrowser);
      await waitFor(() => expect(started).toHaveBeenCalledTimes(1));
      await act(async () => {
        const request = USE_BACKEND
          ? vi
              .mocked(fetch)
              .mock.results[0].value.then((r: Response) => r.json())
          : vi.mocked(generateDiagramBrowser).mock.results[0].value;
        const result = await request;
        // it really was a successful, warning-carrying response
        expect(result.svg).toContain('<svg');
        expect((result.logs as string[]).join(' ')).toMatch(
          /ignores declarative layout properties/
        );
      });
      // let the component's continuation of that request run
      await act(async () => {});

      expect(screen.queryByText('Generated Diagram')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    }, 30000);
  });

  describe('layout engine warning', () => {
    const SHOWN =
      'Layout engine "custom" ignores declarative layout properties: layoutOptions (gap).';

    async function generate(content: string) {
      if (USE_BACKEND) {
        // what the backend returns for each fixture
        const warned = content === CUSTOM_ENGINE_YAML;
        stubBackend({
          svg: '<svg id="test-svg">test</svg>',
          logs: warned
            ? [
                `[2026-01-01T00:00:00.000Z] Warning: ${SHOWN} Use --layout elk or set layoutOptions.engine: elk.`,
              ]
            : ['[2026-01-01T00:00:00.000Z] Generation complete in 5ms'],
          duration: 0,
        });
      }
      render(<Uploader onBack={vi.fn()} />);
      const input = document.querySelector('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [yamlFile(content)] } });
      fireEvent.click(screen.getByText('Generate Diagram'));
      await waitFor(
        () => {
          expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
        },
        { timeout: 20000 }
      );
    }

    it('shows a dismissible banner when the engine ignores layout properties', async () => {
      await generate(CUSTOM_ENGINE_YAML);

      expect(screen.getByRole('status')).toHaveTextContent(SHOWN);
      // the CLI hint is left out of the browser banner
      expect(screen.getByRole('status')).not.toHaveTextContent('--layout elk');

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss warning' }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // the diagram stays
      expect(screen.getByText('Generated Diagram')).toBeInTheDocument();
    }, 30000);

    // A forced elk engine would hide the warning above, so seeing it proves the
    // file's own engine is used.
    it('lets the file choose its engine instead of forcing elk', async () => {
      await generate(CUSTOM_ENGINE_YAML);
      expect(screen.getByRole('status')).toBeInTheDocument();
    }, 30000);

    it('shows no banner without a warning', async () => {
      await generate(PLAIN_YAML);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    }, 30000);
  });
});
