import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * In the browser the icon maps are fetched from /mappings/<provider>-icons.json.
 * A dev server answers a missing file with index.html (status 200), which must
 * not make the whole diagram fail with "Unexpected token '<'".
 */
describe('browser icon maps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const config = {
    version: '0.2',
    metadata: { name: 'Browser', created: '2026-01-01' },
    infrastructure: {
      clouds: [
        {
          id: 'aws',
          provider: 'aws',
          region: 'us-east-1',
          services: [{ id: 'fn', service: 'lambda' }],
        },
      ],
    },
  };

  const loadInBrowser = async (fetchImpl: typeof fetch) => {
    vi.resetModules();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    vi.stubGlobal('fetch', fetchImpl);
    return (await import('../src/elk-builder.js')) as typeof import('../src/elk-builder.js');
  };

  it('still builds the graph when a mapping file is served as index.html', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
    );
    const { buildElkGraph } = await loadInBrowser(
      fetchMock as unknown as typeof fetch
    );
    const graph = await buildElkGraph(config as never);
    expect(graph.id).toBe('root');
    expect(fetchMock).toHaveBeenCalledWith('/mappings/aws-icons.json');
  });

  it('reads a mapping file that exists', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ lambda: 'lambda.png' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const { buildElkGraph } = await loadInBrowser(
      fetchMock as unknown as typeof fetch
    );
    await expect(buildElkGraph(config as never)).resolves.toBeDefined();
  });

  it('never reads the working folder or the running file, which a browser does not have', async () => {
    // the Node search context is __dirname and process.cwd(); in a browser
    // neither exists, so the browser path must not build it at all
    const cwd = vi.spyOn(process, 'cwd');
    try {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ lambda: 'lambda.png' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      );
      const icons = (await (async () => {
        vi.resetModules();
        vi.stubGlobal('window', {});
        vi.stubGlobal('document', {});
        vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
        return import('../src/icon-packages.js');
      })()) as typeof import('../src/icon-packages.js');

      const warnings: string[] = [];
      const sets = await icons.loadIconSets(['aws'], (m) => warnings.push(m));
      expect(sets.aws.map).toEqual({ lambda: 'lambda.png' });
      // in the browser the path is the mapping's own, as is
      await expect(
        icons.resolveProviderAssetPath('aws', 'lambda.png', (m) =>
          warnings.push(m)
        )
      ).resolves.toBe('lambda.png');
      expect(warnings).toEqual([]);
      expect(cwd).not.toHaveBeenCalled();
    } finally {
      cwd.mockRestore();
    }
  });
});
