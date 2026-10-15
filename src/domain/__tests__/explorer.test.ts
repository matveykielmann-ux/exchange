import { describe, expect, it } from 'vitest';
import { explorerTxUrl, hasExplorer } from '../explorer';

describe('explorerTxUrl', () => {
  it('links valid hashes on supported networks', () => {
    const btc = 'a'.repeat(64);
    expect(explorerTxUrl(btc, 'bitcoin')).toBe(`https://mempool.space/tx/${btc}`);
    const eth = `0x${'ab'.repeat(32)}`;
    expect(explorerTxUrl(eth, 'ethereum')).toBe(`https://etherscan.io/tx/${eth}`);
    expect(explorerTxUrl(eth, 'base')).toBe(`https://basescan.org/tx/${eth}`);
    const tron = 'b'.repeat(64);
    expect(explorerTxUrl(tron, 'tron')).toBe(`https://tronscan.org/#/transaction/${tron}`);
  });

  it('returns null for missing, invalid, or unsupported cases', () => {
    expect(explorerTxUrl(null, 'bitcoin')).toBeNull();
    expect(explorerTxUrl('', 'ethereum')).toBeNull();
    expect(explorerTxUrl('not-a-hash', 'bitcoin')).toBeNull();
    expect(explorerTxUrl('a'.repeat(64), 'ethereum')).toBeNull(); // missing 0x
    expect(hasExplorer('bitcoin')).toBe(true);
  });
});
