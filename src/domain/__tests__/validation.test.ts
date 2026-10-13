import { describe, expect, it } from 'vitest';
import {
  isValidRoutingNumber,
  validateCryptoAmount,
  validateEmail,
  validatePassword,
  validateRefundAddress,
  validateUsdAmount,
} from '../validation';

describe('validators', () => {
  it('checks ABA routing checksums', () => {
    expect(isValidRoutingNumber('011000015')).toBe(true);
    expect(isValidRoutingNumber('021000021')).toBe(true);
    expect(isValidRoutingNumber('123456789')).toBe(false);
    expect(isValidRoutingNumber('01100001')).toBe(false);
  });
  it('validates email and password', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('nope')).toMatch(/email address like/);
    expect(validatePassword('short')).toMatch(/12 characters/);
    expect(validatePassword('long-enough-pass')).toBeNull();
  });
  it('gives specific amount errors', () => {
    expect(validateCryptoAmount('', 'BTC')).toMatch(/Enter an amount of BTC/);
    expect(validateCryptoAmount('0', 'BTC')).toMatch(/greater than zero/);
    expect(validateCryptoAmount('1.001', 'USDT')).toMatch(/at most 2 decimal places/);
    expect(validateCryptoAmount('abc', 'ETH')).toMatch(/Enter a number/);
    expect(validateCryptoAmount('0.25', 'ETH')).toBeNull();
  });
  it('validates refund addresses for the selected network', () => {
    expect(validateRefundAddress('', 'tron')).toMatch(/Enter a Tron address/);
    expect(validateRefundAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'tron')).toMatch(/doesn't look like a Tron/);
  });
  it('enforces the large-desk minimum', () => {
    expect(validateUsdAmount('10,000', { minDollars: 25_000 })).toMatch(/\$25,000 or more/);
    expect(validateUsdAmount('75,000', { minDollars: 25_000 })).toBeNull();
  });
});
