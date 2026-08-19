import { describe, expect, it } from 'vitest';
import catalog from '../../src/data/dst-data.json';

describe('baseline DST catalog contract', () => {
  it('retains the complete registered catalog and existing archetypes', () => {
    expect(catalog.patterns).toHaveLength(154);
    expect(catalog.flows).toHaveLength(15);
    expect(Object.keys(catalog.archetypes)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    ]);
    expect(Object.keys(catalog.registry)).toContain('ds-blocks/dst-wrapper');
    expect(Object.keys(catalog.registry)).toContain('ds-blocks/c-btn');
  });
});
