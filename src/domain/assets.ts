/**
 * Supported assets and networks. Confirmation counts follow the table in
 * Section 5 of the Service Rules where specified. XRP, SOL and BNB use
 * network-typical confirmation depths until the owner sets them in the Rules.
 */
import { parseDecimal, type ParseResult } from './money';

export type AssetCode = 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'XRP' | 'SOL' | 'BNB';
export type NetworkId = 'bitcoin' | 'ethereum' | 'tron' | 'solana' | 'base' | 'xrpl' | 'bsc';
export type AssetClass = 'volatile' | 'stable';

export interface Network {
  id: NetworkId;
  name: string;
  /** Confirmations before the deposit counts as final (Service Rules, Section 5). */
  confirmationsRequired: number;
  /** Plain-language estimate shown to customers. Always an estimate. */
  typicalConfirmationTime: string;
  /** Pattern for validating a customer-supplied refund address. */
  addressPattern: RegExp;
  addressExample: string;
  /** Extra field some ledgers need (e.g. XRP destination tag). */
  memoLabel?: string;
  memoRequired?: boolean;
}

export interface AssetNetwork {
  network: NetworkId;
  /** e.g. "ERC-20" — shown so customers can match their wallet's labelling. */
  standard: string | null;
}

export interface Asset {
  code: AssetCode;
  name: string;
  class: AssetClass;
  /** On-chain atomic decimals. */
  decimals: number;
  /** Maximum decimals a customer may type. */
  inputDecimals: number;
  /** Decimals shown in summaries. */
  displayDecimals: number;
  networks: AssetNetwork[];
}

export const NETWORKS: Record<NetworkId, Network> = {
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    confirmationsRequired: 4,
    typicalConfirmationTime: 'about 40–80 minutes',
    addressPattern: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    addressExample: 'bc1q…',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    confirmationsRequired: 21,
    typicalConfirmationTime: 'about 4–6 minutes',
    addressPattern: /^0x[0-9a-fA-F]{40}$/,
    addressExample: '0x…',
  },
  tron: {
    id: 'tron',
    name: 'Tron',
    confirmationsRequired: 21,
    typicalConfirmationTime: 'about 1–3 minutes',
    addressPattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    addressExample: 'T…',
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    confirmationsRequired: 32,
    typicalConfirmationTime: 'under 1 minute',
    addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    addressExample: 'Base58, 32–44 characters',
  },
  base: {
    id: 'base',
    name: 'Base',
    confirmationsRequired: 12,
    typicalConfirmationTime: 'about 1–2 minutes',
    addressPattern: /^0x[0-9a-fA-F]{40}$/,
    addressExample: '0x…',
  },
  xrpl: {
    id: 'xrpl',
    name: 'XRP Ledger',
    confirmationsRequired: 1,
    typicalConfirmationTime: 'about 3–5 seconds',
    // Classic r… addresses (25–35 Base58Check chars).
    addressPattern: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
    addressExample: 'r…',
    memoLabel: 'Destination tag',
    memoRequired: false,
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    confirmationsRequired: 15,
    typicalConfirmationTime: 'about 45–90 seconds',
    addressPattern: /^0x[0-9a-fA-F]{40}$/,
    addressExample: '0x…',
  },
};

export const ASSETS: Record<AssetCode, Asset> = {
  BTC: {
    code: 'BTC',
    name: 'Bitcoin',
    class: 'volatile',
    decimals: 8,
    inputDecimals: 8,
    displayDecimals: 8,
    networks: [{ network: 'bitcoin', standard: null }],
  },
  ETH: {
    code: 'ETH',
    name: 'Ether',
    class: 'volatile',
    decimals: 18,
    inputDecimals: 8,
    displayDecimals: 6,
    networks: [{ network: 'ethereum', standard: null }],
  },
  USDT: {
    code: 'USDT',
    name: 'Tether USD',
    class: 'stable',
    decimals: 6,
    inputDecimals: 2,
    displayDecimals: 2,
    networks: [
      { network: 'ethereum', standard: 'ERC-20' },
      { network: 'tron', standard: 'TRC-20' },
      { network: 'bsc', standard: 'BEP-20' },
    ],
  },
  USDC: {
    code: 'USDC',
    name: 'USD Coin',
    class: 'stable',
    decimals: 6,
    inputDecimals: 2,
    displayDecimals: 2,
    networks: [
      { network: 'ethereum', standard: 'ERC-20' },
      { network: 'solana', standard: 'SPL' },
      { network: 'base', standard: null },
    ],
  },
  XRP: {
    code: 'XRP',
    name: 'XRP',
    class: 'volatile',
    decimals: 6,
    inputDecimals: 6,
    displayDecimals: 4,
    networks: [{ network: 'xrpl', standard: null }],
  },
  SOL: {
    code: 'SOL',
    name: 'Solana',
    class: 'volatile',
    decimals: 9,
    inputDecimals: 9,
    displayDecimals: 6,
    networks: [{ network: 'solana', standard: null }],
  },
  BNB: {
    code: 'BNB',
    name: 'BNB',
    class: 'volatile',
    decimals: 18,
    inputDecimals: 8,
    displayDecimals: 6,
    networks: [{ network: 'bsc', standard: 'BEP-20' }],
  },
};

export const ASSET_ORDER: AssetCode[] = ['BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'SOL', 'BNB'];

export function isAssetCode(v: unknown): v is AssetCode {
  return typeof v === 'string' && Object.hasOwn(ASSETS, v);
}

export function isSupportedPair(asset: AssetCode, network: NetworkId): boolean {
  return ASSETS[asset].networks.some((n) => n.network === network);
}

export function defaultNetwork(asset: AssetCode): NetworkId {
  const first = ASSETS[asset].networks[0];
  if (!first) throw new Error(`Asset ${asset} has no networks configured`);
  return first.network;
}

export function networkLabel(asset: AssetCode, network: NetworkId): string {
  const pair = ASSETS[asset].networks.find((n) => n.network === network);
  const name = NETWORKS[network].name;
  return pair?.standard ? `${name} (${pair.standard})` : name;
}

/** Parses a typed amount into the asset's ATOMIC units (not input precision). */
export function parseAssetAmount(input: string, asset: AssetCode): ParseResult {
  const a = ASSETS[asset];
  return parseDecimal(input, a.decimals, a.inputDecimals);
}

export function isValidAddress(network: NetworkId, address: string): boolean {
  return NETWORKS[network].addressPattern.test(address.trim());
}

/** Validates an optional destination tag / memo for networks that support one. */
export function isValidMemo(network: NetworkId, memo: string | null | undefined): boolean {
  if (memo == null || memo === '') return !NETWORKS[network].memoRequired;
  if (network === 'xrpl') return /^\d{1,10}$/.test(memo.trim());
  return memo.trim().length <= 128;
}
