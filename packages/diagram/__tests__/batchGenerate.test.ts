import { main } from '../src/utils/batchGenerate';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateDiagram } from '../src/core/generate';

jest.mock('fs-extra');
jest.mock('../src/core/generate');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGenerateDiagram = generateDiagram as jest.Mock;

describe('Batch Generate', () => {
  const originalCwd = process.cwd();
  const mockCwd = '/mock/cwd';

  beforeAll(() => {
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockFs.ensureDir as any).mockResolvedValue(undefined);
    (mockFs.writeFile as any).mockResolvedValue(undefined);
  });

  it('should process all YAML files and generate reports', async () => {
    (mockFs.readdir as any).mockResolvedValue([
      'test1.yaml',
      'test2.adac.yaml',
      'ignore.txt',
    ]);
    mockGenerateDiagram.mockResolvedValue(undefined);

    await main();

    // Check directory creation
    expect(mockFs.ensureDir).toHaveBeenCalledWith(
      path.resolve(mockCwd, 'output_diagrams')
    );

    // Check file processing
    expect(mockGenerateDiagram).toHaveBeenCalledTimes(4); // 2 files * 2 engines
    
    // Check parameters for test1.yaml ELK
    expect(mockGenerateDiagram).toHaveBeenCalledWith(
      path.resolve(mockCwd, 'yamls/test1.yaml'),
      path.resolve(mockCwd, 'output_diagrams/test1_elk.svg'),
      'elk'
    );

    // Check parameters for test2.adac.yaml Dagre
    expect(mockGenerateDiagram).toHaveBeenCalledWith(
      path.resolve(mockCwd, 'yamls/test2.adac.yaml'),
      path.resolve(mockCwd, 'output_diagrams/test2_dagre.svg'),
      'dagre'
    );

    // Should ignore .txt
    expect(mockGenerateDiagram).not.toHaveBeenCalledWith(
      expect.stringContaining('ignore.txt'),
      expect.anything(),
      expect.anything()
    );

    // Check HTML generation
    expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.resolve(mockCwd, 'output_diagrams/index.html'),
        expect.stringContaining('<!DOCTYPE html>')
    );
    
    const html = (mockFs.writeFile as any).mock.calls[0][1] as string;
    expect(html).toContain('test1.yaml');
    expect(html).toContain('status-success');
    expect(html).toContain('test1_elk.svg');
    expect(html).toContain('test2_dagre.svg');
  });

  it('should handle generation failures', async () => {
    (mockFs.readdir as any).mockResolvedValue(['fail.yaml']);
    
    // Fail only for ELK
    mockGenerateDiagram.mockImplementation((input, output, engine) => {
        if (engine === 'elk') {
            return Promise.reject(new Error('ELK Error'));
        }
        return Promise.resolve();
    });

    await main();

    const html = (mockFs.writeFile as any).mock.calls[0][1] as string;
    
    // ELK should fail
    expect(html).toContain('status-failure');
    expect(html).toContain('ELK Error');
    expect(html).not.toContain('<img src="fail_elk.svg"');
    
    // Dagre should succeed
    expect(html).toContain('<img src="fail_dagre.svg"');
  });

  it('should handle thrown non-Error objects correctly', async () => {
     (mockFs.readdir as any).mockResolvedValue(['weird.yaml']);
     mockGenerateDiagram.mockRejectedValue('String Error');

     await main();

     const html = (mockFs.writeFile as any).mock.calls[0][1] as string;
     expect(html).toContain('String Error');
     expect(html).toContain('status-failure');
  });
});
