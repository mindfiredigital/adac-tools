import { describe, it, expect } from 'vitest';
import { generatePlaceholderSvg } from '../scripts/icon-setup';

describe('Azure Icon Setup - generatePlaceholderSvg', () => {
  it('should generate valid SVG markup', () => {
    const svg = generatePlaceholderSvg('Virtual Machines', '#0078D4');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('should include the correct color for fill', () => {
    const color = '#FF3621';
    const svg = generatePlaceholderSvg('Azure Databricks', color);
    expect(svg).toContain(`fill="${color}"`);
  });

  it('should include the correct color for stroke', () => {
    const color = '#0078D4';
    const svg = generatePlaceholderSvg('Azure Monitor', color);
    expect(svg).toContain(`stroke="${color}"`);
  });

  it('should generate a 2-letter abbreviation from service name', () => {
    const svg = generatePlaceholderSvg('Virtual Machines', '#0078D4');
    expect(svg).toContain('>VM<');
  });

  it('should handle single-word service names', () => {
    const svg = generatePlaceholderSvg('Sentinel', '#0078D4');
    expect(svg).toContain('>S<');
  });

  it('should handle multi-word service names by taking first two words', () => {
    const svg = generatePlaceholderSvg('Azure Kubernetes Service', '#326CE5');
    // Takes first 2 words: "Azure" -> "A", "Kubernetes" -> "K"
    expect(svg).toContain('>AK<');
  });

  it('should handle hyphenated service names', () => {
    const svg = generatePlaceholderSvg('Front-Door', '#0078D4');
    // Splits on hyphens: "Front" -> "F", "Door" -> "D"
    expect(svg).toContain('>FD<');
  });

  it('should handle underscore-separated service names', () => {
    const svg = generatePlaceholderSvg('blob_storage', '#0078D4');
    expect(svg).toContain('>BS<');
  });

  it('should include the viewBox attribute', () => {
    const svg = generatePlaceholderSvg('Test', '#000000');
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  it('should set correct width and height', () => {
    const svg = generatePlaceholderSvg('Test', '#000000');
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });

  it('should use Segoe UI font family', () => {
    const svg = generatePlaceholderSvg('Test', '#000000');
    expect(svg).toContain('Segoe UI');
  });

  it('should include rounded rectangle background with opacity', () => {
    const svg = generatePlaceholderSvg('Test', '#0078D4');
    expect(svg).toContain('rx="8"');
    expect(svg).toContain('opacity="0.15"');
  });

  it('should include border rectangle with stroke', () => {
    const svg = generatePlaceholderSvg('Test', '#0078D4');
    expect(svg).toContain('stroke-width="2"');
  });

  it('should handle empty string gracefully', () => {
    const svg = generatePlaceholderSvg('', '#0078D4');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('should handle different Azure brand colors', () => {
    const colors = ['#0078D4', '#FF6D00', '#D82C20', '#10A37F', '#68217A'];
    for (const color of colors) {
      const svg = generatePlaceholderSvg('Test Service', color);
      expect(svg).toContain(color);
    }
  });
});
