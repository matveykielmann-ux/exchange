/**
 * Public blockchain explorer links for real transaction hashes.
 * Links are formed only when the network has a verified explorer and the
 * TXID matches that network's format. An explorer link lets anyone inspect
 * the on-chain transaction; it does not by itself confirm exchange completion,
 * USD receipt, or a cash payout.
 */
import { NETWORKS, type NetworkId } from './assets';
import { validateTxHash } from './validation';

/** Verified public explorers. Networks without an entry never get a link. */
const EXPLORERS: Partial<Record<NetworkId, (txHash: string) => string>> = {
  bitcoin: (h) => `https://mempool.space/tx/${h}`,
  ethereum: (h) => `https://etherscan.io/tx/${h}`,
  tron: (h) => `https://tronscan.org/#/transaction/${h}`,
  solana: (h) => `https://solscan.io/tx/${h}`,
  base: (h) => `https://basescan.org/tx/${h}`,
};

const ADDRESS_EXPLORERS: Partial<Record<NetworkId, (address: string) => string>> = {
  bitcoin: (a) => `https://mempool.space/address/${a}`,
  ethereum: (a) => `https://etherscan.io/address/${a}`,
  tron: (a) => `https://tronscan.org/#/address/${a}`,
  solana: (a) => `https://solscan.io/account/${a}`,
  base: (a) => `https://basescan.org/address/${a}`,
};

/** Returns an https explorer URL, or null when the hash/network cannot be linked safely. */
export function explorerTxUrl(txHash: string | null | undefined, network: NetworkId | null | undefined): string | null {
  if (!txHash || !network) return null;
  const hash = txHash.trim();
  if (!hash) return null;
  if (!(network in NETWORKS)) return null;
  if (validateTxHash(hash, network) !== null) return null;
  const build = EXPLORERS[network];
  if (!build) return null;
  return build(hash);
}

export function hasExplorer(network: NetworkId): boolean {
  return network in EXPLORERS;
}

/** Public address page when the network has a verified explorer and the address looks valid. */
export function explorerAddressUrl(address: string | null | undefined, network: NetworkId | null | undefined): string | null {
  if (!address || !network) return null;
  const a = address.trim();
  if (!a || !(network in NETWORKS)) return null;
  if (!NETWORKS[network].addressPattern.test(a)) return null;
  const build = ADDRESS_EXPLORERS[network];
  return build ? build(a) : null;
}
