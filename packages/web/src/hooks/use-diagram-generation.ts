import { useCallback, useRef, useState } from 'react';
import type { GenerationResult } from '@mindfiredigital/adac-core';
import { generateDiagramBrowser } from '../helper/diagram-generator';
import { layoutEngineWarnings } from '../helper/generation-warnings';

const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

/** Generates through the backend when configured, otherwise in the browser. */
async function requestDiagram(text: string): Promise<GenerationResult> {
  if (!USE_BACKEND) return generateDiagramBrowser(text);
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // no layout: the file's own engine applies, ELK when it names none
    body: JSON.stringify({ content: text }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to generate diagram');
  }
  return response.json();
}

export interface DiagramGeneration {
  loading: boolean;
  svg: string | null;
  error: string | null;
  warnings: string[];
  /** Generates a diagram from `file`; a result for an invalidated request is dropped. */
  generate: (file: File) => Promise<void>;
  /** Drops the current result and any generation still in flight. */
  reset: () => void;
  dismissWarnings: () => void;
}

/**
 * Request lifecycle of a diagram generation. Each `generate` call gets an
 * identity; `reset` (or a newer `generate`) invalidates it, so a slow earlier
 * generation can never overwrite the state of a newer one.
 */
export function useDiagramGeneration(): DiagramGeneration {
  const [loading, setLoading] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const activeRequest = useRef(0);

  const reset = useCallback(() => {
    activeRequest.current += 1;
    setLoading(false);
    setError(null);
    setWarnings([]);
    setSvg(null);
  }, []);

  const generate = useCallback(async (file: File) => {
    const request = ++activeRequest.current;
    const isCurrent = () => request === activeRequest.current;

    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const results = await requestDiagram(await file.text());
      if (!isCurrent()) return;
      setSvg(results.svg);
      setWarnings(layoutEngineWarnings(results.logs));
    } catch (e: unknown) {
      if (!isCurrent()) return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const dismissWarnings = useCallback(() => setWarnings([]), []);

  return { loading, svg, error, warnings, generate, reset, dismissWarnings };
}
