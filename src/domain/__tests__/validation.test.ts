import { describe, expect, it } from 'vitest';
import {
  isValidRoutingNumber,
  validateCashAmount,
  validateCryptoAmount,
  validateReceiveAddress,
  validateTxHash,
  validateEmail,
  validatePassword,
  validateRefundAddress,
  validateUsdAmount,
  validateUsPhone,
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
    expect(validatePassword('short')).toMatch(/8 characters/);
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
    expect(validateUsdAmount('10,000', { minCents: 25_000_00n })).toMatch(/\$25,000 or more/);
    expect(validateUsdAmount('75,000', { minCents: 25_000_00n })).toBeNull();
    expect(validateUsPhone('(415) 555-0100')).toBeNull();
    expect(validateUsPhone('555-0100')).toMatch(/area code/);
  });
});

describe('validateTxHash', () => {
  it('checks the shape of a hash for the network, and nothing more', () => {
    expect(validateTxHash('', 'ethereum')).toMatch(/Enter the transaction hash/);
    expect(validateTxHash('0x' + 'ab'.repeat(32), 'ethereum')).toBeNull();
    expect(validateTxHash('ab'.repeat(32), 'ethereum')).toMatch(/0x followed by 64/);
    expect(validateTxHash('ab'.repeat(32), 'bitcoin')).toBeNull();
    expect(validateTxHash('ab'.repeat(32), 'tron')).toBeNull();
    expect(validateTxHash('0x' + 'ab'.repeat(32), 'tron')).not.toBeNull();
    expect(validateTxHash('5'.repeat(88), 'solana')).toBeNull();
    expect(validateTxHash('0'.repeat(88), 'solana')).not.toBeNull(); // 0 is not Base58
  });
});

describe('buy inputs', () => {
  it('validates the cash amount and the receiving wallet', () => {
    expect(validateCashAmount('')).toMatch(/Enter how many/);
    expect(validateCashAmount('1,500')).toBeNull();
    expect(validateCashAmount('10.555')).toMatch(/2 decimal/);
    expect(validateCashAmount('0')).toMatch(/greater than zero/);
    expect(validateReceiveAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 'tron')).toBeNull();
    expect(validateReceiveAddress('0x52908400098527886E0F7030069857D2E4169EE7', 'tron')).toMatch(/TRON|Tron|address/);
  });
});
