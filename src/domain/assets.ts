/**
 * Supported assets and networks. Confirmation counts and minimums are MOCK
 * POLICY values for the preview — production thresholds must be set by the
 * risk and compliance owners for each chain.
 */
import { parseDecimal, type ParseResult } from './money';

export type AssetCode = 'BTC' | 'ETH' | 'USDT' | 'USDC';
export type NetworkId = 'bitcoin' | 'ethereum' | 'tron' | 'solana' | 'base';
export type AssetClass = 'volatile' | 'stable';

export interface Network {
  id: NetworkId;
  name: string;
  /** Mock confirmation policy before the deposit counts as final. */
  confirmationsRequired: number;
  /** Plain-language estimate shown to customers. Always an estimate. */
  typicalConfirmationTime: string;
  /** Pattern for validating a customer-supplied refund address. */
  addressPattern: RegExp;
  addressExample: string;
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
    confirmationsRequired: 2,
    typicalConfirmationTime: 'about 20–60 minutes',
    addressPattern: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    addressExample: 'bc1q…',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    confirmationsRequired: 12,
    typicalConfirmationTime: 'about 3–5 minutes',
    addressPattern: /^0x[0-9a-fA-F]{40}$/,
    addressExample: '0x…',
  },
  tron: {
    id: 'tron',
    name: 'Tron',
    confirmationsRequired: 20,
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
};

export const ASSET_ORDER: AssetCode[] = ['BTC', 'ETH', 'USDT', 'USDC'];

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
