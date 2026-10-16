/** Field validators. Each returns an error message, or null when valid. */
import { ASSETS, NETWORKS, isValidAddress, parseAssetAmount, type AssetCode, type NetworkId } from './assets';
import { formatUsd, parseDecimal, type Cents } from './money';

export type FieldError = string | null;

export function validateEmail(value: string): FieldError {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter an email address like name@example.com.';
  return null;
}

/** Minimum password length (owner decision, 2026-03-01 package). */
export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(value: string): FieldError {
  if (!value) return 'Enter a password.';
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export function validateRequired(value: string, label: string): FieldError {
  return value.trim() ? null : `Enter ${label}.`;
}

export function validateCryptoAmount(value: string, asset: AssetCode): FieldError {
  const parsed = parseAssetAmount(value, asset);
  if (!parsed.ok) {
    if (parsed.reason === 'empty') return `Enter an amount of ${asset}.`;
    if (parsed.reason === 'too_many_decimals') return `${asset} amounts can have at most ${ASSETS[asset].inputDecimals} decimal places.`;
    return 'Enter a number using a period for decimals, for example 0.25.';
  }
  if (parsed.value === 0n) return 'Enter an amount greater than zero.';
  return null;
}

export function validateRefundAddress(value: string, network: NetworkId): FieldError {
  const v = value.trim();
  if (!v) return `Enter a ${NETWORKS[network].name} address for refunds.`;
  if (!isValidAddress(network, v))
    return `That doesn't look like a ${NETWORKS[network].name} address (expected ${NETWORKS[network].addressExample}).`;
  return null;
}

/** ABA routing number checksum (3-7-1 weighting). */
export function isValidRoutingNumber(value: string): boolean {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split('').map(Number) as number[];
  const sum = 3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + 1 * (d[2]! + d[5]! + d[8]!);
  return sum % 10 === 0;
}

export function validateRoutingNumber(value: string): FieldError {
  const v = value.replace(/\s/g, '');
  if (!v) return 'Enter the 9-digit routing number.';
  if (!/^\d{9}$/.test(v)) return 'Routing numbers are exactly 9 digits.';
  if (!isValidRoutingNumber(v)) return 'That routing number fails the ABA checksum. Check it against a check or your bank.';
  return null;
}

export function validateAccountNumber(value: string): FieldError {
  const v = value.replace(/\s/g, '');
  if (!v) return 'Enter the account number.';
  if (!/^\d{4,17}$/.test(v)) return 'Account numbers are 4 to 17 digits.';
  return null;
}

/** The wallet that receives the crypto of a buy order. */
export function validateReceiveAddress(value: string, network: NetworkId): FieldError {
  const v = value.trim();
  if (!v) return `Enter the ${NETWORKS[network].name} address of a wallet you control.`;
  if (!isValidAddress(network, v))
    return `That doesn't look like a ${NETWORKS[network].name} address (expected ${NETWORKS[network].addressExample}).`;
  return null;
}

/** Cash a customer pays the courier on a buy, in whole cents. */
export function validateCashAmount(value: string): FieldError {
  const parsed = parseDecimal(value.replace(/,/g, ''), 2);
  if (!parsed.ok)
    return parsed.reason === 'empty'
      ? 'Enter how many US dollars you will pay.'
      : parsed.reason === 'too_many_decimals'
        ? 'Use at most 2 decimal places.'
        : 'Enter a dollar amount, for example 1,500.';
  if (parsed.value === 0n) return 'Enter an amount greater than zero.';
  return null;
}

export function validateUsdAmount(value: string, { minCents }: { minCents: Cents }): FieldError {
  const parsed = parseDecimal(value, 2);
  if (!parsed.ok) return parsed.reason === 'empty' ? 'Enter an approximate amount in USD.' : 'Enter a dollar amount, for example 75,000.';
  if (parsed.value < minCents)
    return `The large-transaction desk handles ${formatUsd(minCents, { whole: true })} or more. Use the standard exchange below that.`;
  return null;
}

export function validateUsPhone(value: string): FieldError {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'Enter a phone number.';
  const lengthOk = digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  if (!lengthOk || !/^[\d\s()+.-]+$/.test(value.trim())) return 'Enter a US phone number, including area code.';
  return null;
}

const TX_HASH: Record<NetworkId, { pattern: RegExp; example: string }> = {
  bitcoin: { pattern: /^[0-9a-fA-F]{64}$/, example: '64 hexadecimal characters' },
  tron: { pattern: /^[0-9a-fA-F]{64}$/, example: '64 hexadecimal characters' },
  ethereum: { pattern: /^0x[0-9a-fA-F]{64}$/, example: '0x followed by 64 hexadecimal characters' },
  base: { pattern: /^0x[0-9a-fA-F]{64}$/, example: '0x followed by 64 hexadecimal characters' },
  solana: { pattern: /^[1-9A-HJ-NP-Za-km-z]{64,90}$/, example: 'a Base58 signature of 64 to 90 characters' },
  xrpl: { pattern: /^[0-9A-F]{64}$/i, example: '64 hexadecimal characters' },
  bsc: { pattern: /^0x[0-9a-fA-F]{64}$/, example: '0x followed by 64 hexadecimal characters' },
};

/**
 * Checks only that a transaction hash is shaped like one for the network. It
 * says nothing about whether the transaction exists or reached us.
 */
export function validateTxHash(value: string, network: NetworkId): FieldError {
  const v = value.trim();
  if (!v) return 'Enter the transaction hash (TXID) from your wallet.';
  if (!TX_HASH[network].pattern.test(v))
    return `That doesn't look like a transaction hash on ${NETWORKS[network].name} (expected ${TX_HASH[network].example}).`;
  return null;
}

/** Digits only; strips spaces and dashes. */
export function normalizeCardNumber(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** Luhn check for primary account numbers (PAN). */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Card number for a manual USD payout destination. Never accepts CVV/CVC/PIN.
 * Used only for owner-operated card payouts; authorization of card *pay-in*
 * stays on an external processor page.
 */
export function validateCardNumber(value: string): FieldError {
  const v = normalizeCardNumber(value);
  if (!v) return 'Enter the bank card number.';
  if (!/^\d+$/.test(v)) return 'Card numbers contain digits only.';
  if (v.length < 12 || v.length > 19) return 'Card numbers are 12 to 19 digits.';
  if (!isValidLuhn(v)) return 'That card number fails the checksum. Check it and try again.';
  return null;
}

export function validateCardHolderName(value: string): FieldError {
  const v = value.trim();
  if (!v) return 'Enter the name on the card.';
  if (v.length < 2 || v.length > 80) return 'Enter the cardholder name (2–80 characters).';
  if (!/^[\p{L}\p{M}0-9\s.'’-]+$/u.test(v)) return 'Enter the cardholder name as printed on the card.';
  return null;
}
