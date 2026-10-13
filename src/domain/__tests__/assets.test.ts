import { describe, expect, it } from 'vitest';
import { ASSETS, defaultNetwork, isSupportedPair, isValidAddress, networkLabel, parseAssetAmount } from '../assets';

describe('asset catalog', () => {
  it('requires explicit networks for stablecoins', () => {
    expect(ASSETS.USDT.networks.map((n) => n.network)).toEqual(['ethereum', 'tron']);
    expect(ASSETS.USDC.networks.map((n) => n.network)).toEqual(['ethereum', 'solana', 'base']);
    expect(isSupportedPair('USDT', 'solana')).toBe(false);
    expect(isSupportedPair('BTC', 'ethereum')).toBe(false);
    expect(defaultNetwork('ETH')).toBe('ethereum');
    expect(networkLabel('USDT', 'tron')).toBe('Tron (TRC-20)');
  });

  it('parses typed amounts into atomic units per asset', () => {
    expect(parseAssetAmount('0.05', 'ETH')).toEqual({ ok: true, value: 50_000_000_000_000_000n });
    expect(parseAssetAmount('2500', 'USDT')).toEqual({ ok: true, value: 2_500_000_000n });
    expect(parseAssetAmount('0.00000001', 'BTC')).toEqual({ ok: true, value: 1n });
    expect(parseAssetAmount('1.001', 'USDC')).toEqual({ ok: false, reason: 'too_many_decimals' });
  });

  it('validates refund addresses per network', () => {
    expect(isValidAddress('bitcoin', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    expect(isValidAddress('ethereum', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(isValidAddress('tron', 'TJYeasTPa6gpEEfYqP8zm3gn9H8TCh8Qe1')).toBe(true);
    expect(isValidAddress('ethereum', '0x123')).toBe(false);
    expect(isValidAddress('tron', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(false);
  });
});
