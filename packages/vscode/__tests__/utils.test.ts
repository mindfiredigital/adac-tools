/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { isAdacDocument } from '../src/utils/adac-utils';

describe('adac-utils', () => {
  it('identifies ADAC documents correctly', () => {
    const doc1: any = { languageId: 'yaml', fileName: 'test.adac.yaml' };
    const doc2: any = { languageId: 'yaml', fileName: 'test.yaml' };
    const doc3: any = { languageId: 'json', fileName: 'test.adac.yaml' };

    expect(isAdacDocument(doc1)).toBe(true);
    expect(isAdacDocument(doc2)).toBe(false);
    expect(isAdacDocument(doc3)).toBe(true); // Because it ends with .adac.yaml
  });
});
