import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SERVICE_RULES, SERVICE_RULES_SHA256 } from '@/content/legal/terms';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import { rulesExcerpt } from '@/content/legal/rules';

const SOURCE_PATH = 'src/content/legal/source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md';

describe('Service Rules source', () => {
  it('is the file the owner supplied, byte for byte', () => {
    const bytes = readFileSync(SOURCE_PATH);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(SERVICE_RULES_SHA256);
    expect(SERVICE_RULES.markdown).toBe(bytes.toString('utf8'));
  });

  it('every clause another document quotes exists in the Rules', () => {
    const refs = LEGAL_DOCUMENTS.flatMap((d) => d.sections.flatMap((s) => s.blocks.flatMap((b) => (b.type === 'rules' ? b.refs : []))));
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(rulesExcerpt(ref).blocks.length, ref).toBeGreaterThan(0);
  });

  it('a clause runs to the next clause and keeps its lists', () => {
    const c = rulesExcerpt('9.7');
    expect(c.blocks.map((b) => b.type)).toEqual(['paragraph', 'list', 'paragraph']);
    expect(rulesExcerpt('6').label).toBe('Section 6. Fees');
    expect(() => rulesExcerpt('4.99')).toThrow();
  });
});
