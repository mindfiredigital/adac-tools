import { marked } from 'marked';
import { DocFile } from '../types/index.js';

export class HtmlRenderer {
  async render(files: DocFile[]): Promise<DocFile[]> {
    const renderedFiles = await Promise.all(
      files.map(async (file) => {
        const htmlContent = await marked.parse(file.content);
        const nameWithoutExt = file.name.replace(/\.md$/, '');
        return {
          ...file,
          name: `${nameWithoutExt}.html`,
          content: htmlContent,
        };
      })
    );

    return renderedFiles;
  }
}
