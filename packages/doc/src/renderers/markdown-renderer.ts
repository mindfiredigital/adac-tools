import { DocFile } from '../types/index.js';

export class MarkdownRenderer {
  render(files: DocFile[]): DocFile[] {
    // Markdown renderer could apply additional markdown-specific formatting
    // For now, it passes the content through directly, since generators output markdown
    return files.map(file => ({
      ...file,
      name: file.name.endsWith('.md') ? file.name : `${file.name}.md`
    }));
  }
}
