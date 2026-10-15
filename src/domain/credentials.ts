/**
 * CRM bank-wire credential sets and crypto deposit wallets. Orders keep an
 * immutable snapshot of whatever was issued; editing a set or wallet never
 * rewrites an existing order. Private keys and seed phrases are never stored.
 */
import { ASSETS, isValidAddress, NETWORKS, type AssetCode, type NetworkId } from './assets';
import type { WireInstructionLine } from './wire';

export type CredentialStatus = 'active' | 'suspended';
export type WalletStatus = CredentialStatus | 'pending_network';
export type WalletPurpose = 'deposit' | 'payout';
export type WireCurrency = 'USD';

export interface WireCredentialSetInput {
  name: string;
  beneficiary: string;
  bankName: string;
  accountNumber?: string | null;
  routingNumber?: string | null;
  swiftBic?: string | null;
  bankAddress?: string | null;
  instructions?: string | null;
  currency?: WireCurrency;
}

export interface WireCredentialSnapshot {
  wireSetId: string | null;
  name: string;
  beneficiary: string;
  bankName: string;
  accountNumber: string | null;
  routingNumber: string | null;
  swiftBic: string | null;
  bankAddress: string | null;
  instructions: string | null;
  currency: WireCurrency;
}

export interface CryptoWalletInput {
  name: string;
  asset?: AssetCode | null;
  network?: NetworkId | null;
  address: string;
  /** XRP Ledger destination tag when required by the deposit wallet. */
  destinationTag?: string | null;
  purpose?: WalletPurpose;
  note?: string | null;
}

export interface WalletSnapshot {
  walletId: string | null;
  name: string;
  asset: AssetCode;
  network: NetworkId;
  address: string;
  destinationTag?: string | null;
  purpose: WalletPurpose;
}

/** Networks that share the same 0x address format (may reuse an address as separate rows). */
export const EVM_NETWORKS: readonly NetworkId[] = ['ethereum', 'base', 'bsc'];

export function isEvmNetwork(network: NetworkId): boolean {
  return (EVM_NETWORKS as readonly string[]).includes(network);
}

/** Validate optional wire fields: at least one of account / routing / SWIFT. */
export function validateWireCredentialInput(input: WireCredentialSetInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Enter an internal name.';
  if (!input.beneficiary.trim()) return 'Enter the payment beneficiary.';
  if (!input.bankName.trim()) return 'Enter the bank name.';
  const account = input.accountNumber?.trim() || null;
  const routing = input.routingNumber?.trim() || null;
  const swift = input.swiftBic?.trim() || null;
  if (!account && !routing && !swift) return 'Provide an account number/IBAN, routing number, or SWIFT/BIC.';
  if (swift && !/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/.test(swift)) return 'SWIFT/BIC must be 8 or 11 characters.';
  if (routing && !/^[0-9A-Za-z-]{4,34}$/.test(routing)) return 'Routing number is not in the expected format.';
  if (account && account.length < 4) return 'Account number / IBAN is too short.';
  return null;
}

/**
 * Address must match the selected network. Pending-network (EVM template) rows
 * only accept a syntactically valid EVM address and require network before activation.
 */
export function validateWalletAddress(address: string, network: NetworkId | null | undefined): string | null {
  const a = address.trim();
  if (a.length < 20 || a.length > 128) return 'Enter a wallet address between 20 and 128 characters.';
  if (!network) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return 'Without a network, only a standard EVM (0x) address is allowed.';
    return null;
  }
  if (!NETWORKS[network]) return 'Unknown network.';
  if (!isValidAddress(network, a)) return `Address does not match the ${NETWORKS[network].name} format.`;
  return null;
}

export function validateWalletPair(asset: AssetCode | null | undefined, network: NetworkId | null | undefined): string | null {
  if (!asset && !network) return null;
  if (!asset || !network) return 'Select both an asset and a network, or leave both empty for an EVM template.';
  if (!ASSETS[asset]) return 'Unknown asset.';
  if (!ASSETS[asset].networks.some((n) => n.network === network))
    return `${asset} is not supported on ${NETWORKS[network]?.name ?? network}.`;
  return null;
}

/** Customer-facing wire instruction lines from an order snapshot (never DEMO placeholders). */
export function wireLinesFromSnapshot(snap: WireCredentialSnapshot, reference: string): WireInstructionLine[] {
  const lines: WireInstructionLine[] = [
    { label: 'Beneficiary', value: snap.beneficiary, placeholder: false },
    { label: 'Bank', value: snap.bankName, placeholder: false },
  ];
  if (snap.accountNumber) lines.push({ label: 'Account number / IBAN', value: snap.accountNumber, placeholder: false });
  if (snap.routingNumber) lines.push({ label: 'Routing number (ABA)', value: snap.routingNumber, placeholder: false });
  if (snap.swiftBic) lines.push({ label: 'SWIFT / BIC', value: snap.swiftBic, placeholder: false });
  if (snap.bankAddress) lines.push({ label: 'Bank address', value: snap.bankAddress, placeholder: false });
  lines.push({ label: 'Reference / memo', value: reference, placeholder: false });
  if (snap.instructions) lines.push({ label: 'Instructions', value: snap.instructions, placeholder: false });
  return lines;
}
