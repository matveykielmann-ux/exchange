/**
 * CRM credentials: bank wire sets and crypto wallets. All mutations are
 * audited. Orders receive immutable snapshots on assign/issue; later edits to
 * a set or wallet do not change existing orders. Soft-deactivate only when a
 * credential is referenced by an order snapshot.
 */
import { type AssetCode, type NetworkId, isSupportedPair } from '@/domain/assets';
import {
  type CryptoWalletInput,
  type WalletPurpose,
  type WalletSnapshot,
  type WalletStatus,
  type WireCredentialSetInput,
  type WireCredentialSnapshot,
  type WireCurrency,
  validateWalletAddress,
  validateWalletPair,
  validateWireCredentialInput,
  wireLinesFromSnapshot,
} from '@/domain/credentials';
import type { Actor, AppContext } from '../context';
import { badRequest, conflict, forbidden, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { audit } from './audit';

/* ---------- Rows ---------- */

export interface WireSetRow {
  id: string;
  name: string;
  beneficiary: string;
  bank_name: string;
  account_number: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  bank_address: string | null;
  instructions: string | null;
  currency: WireCurrency;
  status: 'active' | 'suspended';
  is_default: number;
  created_at: number;
  updated_at: number;
  created_by: string | null;
  updated_by: string | null;
}

export interface WalletRow {
  id: string;
  name: string;
  asset: AssetCode | null;
  network: NetworkId | null;
  address: string;
  destination_tag: string | null;
  purpose: WalletPurpose;
  status: WalletStatus;
  is_default: number;
  note: string | null;
  created_at: number;
  updated_at: number;
  created_by: string | null;
  updated_by: string | null;
}

export interface OrderWireSnapRow {
  order_id: string;
  wire_set_id: string | null;
  name: string;
  beneficiary: string;
  bank_name: string;
  account_number: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  bank_address: string | null;
  instructions: string | null;
  currency: WireCurrency;
  assigned_by: string | null;
  assigned_at: number;
  revealed_to_customer: number;
}

export interface OrderWalletSnapRow {
  order_id: string;
  wallet_id: string | null;
  name: string;
  asset: AssetCode;
  network: NetworkId;
  address: string;
  destination_tag: string | null;
  purpose: WalletPurpose;
  assigned_by: string | null;
  assigned_at: number;
  revealed_to_customer: number;
}

/* ---------- Views ---------- */

function wireView(r: WireSetRow) {
  return {
    id: r.id,
    name: r.name,
    beneficiary: r.beneficiary,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    routingNumber: r.routing_number,
    swiftBic: r.swift_bic,
    bankAddress: r.bank_address,
    instructions: r.instructions,
    currency: r.currency,
    status: r.status,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    inUse: false as boolean,
  };
}

function walletView(r: WalletRow) {
  return {
    id: r.id,
    name: r.name,
    asset: r.asset,
    network: r.network,
    address: r.address,
    destinationTag: r.destination_tag,
    purpose: r.purpose,
    status: r.status,
    isDefault: r.is_default === 1,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    inUse: false as boolean,
  };
}

function wireSnapView(r: OrderWireSnapRow): WireCredentialSnapshot & {
  assignedBy: string | null;
  assignedAt: number;
  revealedToCustomer: boolean;
} {
  return {
    wireSetId: r.wire_set_id,
    name: r.name,
    beneficiary: r.beneficiary,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    routingNumber: r.routing_number,
    swiftBic: r.swift_bic,
    bankAddress: r.bank_address,
    instructions: r.instructions,
    currency: r.currency,
    assignedBy: r.assigned_by,
    assignedAt: r.assigned_at,
    revealedToCustomer: r.revealed_to_customer === 1,
  };
}

function walletSnapView(r: OrderWalletSnapRow): WalletSnapshot & {
  assignedBy: string | null;
  assignedAt: number;
  revealedToCustomer: boolean;
} {
  return {
    walletId: r.wallet_id,
    name: r.name,
    asset: r.asset,
    network: r.network,
    address: r.address,
    destinationTag: r.destination_tag,
    purpose: r.purpose,
    assignedBy: r.assigned_by,
    assignedAt: r.assigned_at,
    revealedToCustomer: r.revealed_to_customer === 1,
  };
}

function markInUseWire(ctx: AppContext, rows: ReturnType<typeof wireView>[]) {
  const used = new Set(
    ctx.db
      .all<{ wire_set_id: string }>('SELECT DISTINCT wire_set_id FROM order_wire_snapshots WHERE wire_set_id IS NOT NULL')
      .map((r) => r.wire_set_id),
  );
  for (const r of rows) r.inUse = used.has(r.id);
  return rows;
}

function markInUseWallet(ctx: AppContext, rows: ReturnType<typeof walletView>[]) {
  const used = new Set(
    ctx.db
      .all<{ wallet_id: string }>('SELECT DISTINCT wallet_id FROM order_wallet_snapshots WHERE wallet_id IS NOT NULL')
      .map((r) => r.wallet_id),
  );
  for (const r of rows) r.inUse = used.has(r.id);
  return rows;
}

/* ---------- Wire sets ---------- */

export function listWireSets(ctx: AppContext) {
  const rows = ctx.db.all<WireSetRow>('SELECT * FROM wire_credential_sets ORDER BY is_default DESC, name COLLATE NOCASE');
  return markInUseWire(
    ctx,
    rows.map(wireView),
  );
}

export function getWireSet(ctx: AppContext, id: string): WireSetRow {
  const r = ctx.db.get<WireSetRow>('SELECT * FROM wire_credential_sets WHERE id = ?', [id]);
  if (!r) throw notFound('Bank credential set not found.');
  return r;
}

export function defaultWireSet(ctx: AppContext, currency: WireCurrency = 'USD'): WireSetRow | null {
  return (
    ctx.db.get<WireSetRow>(
      "SELECT * FROM wire_credential_sets WHERE currency = ? AND status = 'active' AND is_default = 1 LIMIT 1",
      [currency],
    ) ?? null
  );
}

function normalizeWireInput(input: WireCredentialSetInput) {
  const err = validateWireCredentialInput(input);
  if (err) throw badRequest(err);
  return {
    name: input.name.trim(),
    beneficiary: input.beneficiary.trim(),
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber?.trim() || null,
    routingNumber: input.routingNumber?.trim() || null,
    swiftBic: input.swiftBic?.trim()?.toUpperCase() || null,
    bankAddress: input.bankAddress?.trim() || null,
    instructions: input.instructions?.trim() || null,
    currency: (input.currency ?? 'USD') as WireCurrency,
  };
}

export function createWireSet(ctx: AppContext, actor: Actor, input: WireCredentialSetInput) {
  const n = normalizeWireInput(input);
  const id = newId('wire');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run(
      `INSERT INTO wire_credential_sets
        (id, name, beneficiary, bank_name, account_number, routing_number, swift_bic, bank_address, instructions, currency, status, is_default, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?)`,
      [
        id,
        n.name,
        n.beneficiary,
        n.bankName,
        n.accountNumber,
        n.routingNumber,
        n.swiftBic,
        n.bankAddress,
        n.instructions,
        n.currency,
        now,
        now,
        actor.id,
        actor.id,
      ],
    );
    audit(ctx, actor, { action: 'credentials.wire_created', targetType: 'wire_set', targetId: id, data: { name: n.name, currency: n.currency } });
  });
  return wireView(getWireSet(ctx, id));
}

export function updateWireSet(ctx: AppContext, actor: Actor, id: string, input: WireCredentialSetInput) {
  getWireSet(ctx, id);
  const n = normalizeWireInput(input);
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE wire_credential_sets SET
        name = ?, beneficiary = ?, bank_name = ?, account_number = ?, routing_number = ?, swift_bic = ?,
        bank_address = ?, instructions = ?, currency = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [
        n.name,
        n.beneficiary,
        n.bankName,
        n.accountNumber,
        n.routingNumber,
        n.swiftBic,
        n.bankAddress,
        n.instructions,
        n.currency,
        now,
        actor.id,
        id,
      ],
    );
    audit(ctx, actor, { action: 'credentials.wire_updated', targetType: 'wire_set', targetId: id, data: { name: n.name } });
  });
  return wireView(getWireSet(ctx, id));
}

export function setWireStatus(ctx: AppContext, actor: Actor, id: string, status: 'active' | 'suspended') {
  const row = getWireSet(ctx, id);
  if (row.status === status) return wireView(row);
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    if (status === 'suspended') {
      ctx.db.run('UPDATE wire_credential_sets SET status = ?, is_default = 0, updated_at = ?, updated_by = ? WHERE id = ?', [
        status,
        now,
        actor.id,
        id,
      ]);
    } else {
      ctx.db.run('UPDATE wire_credential_sets SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, now, actor.id, id]);
    }
    audit(ctx, actor, {
      action: status === 'active' ? 'credentials.wire_activated' : 'credentials.wire_suspended',
      targetType: 'wire_set',
      targetId: id,
    });
  });
  return wireView(getWireSet(ctx, id));
}

export function setWireDefault(ctx: AppContext, actor: Actor, id: string) {
  const row = getWireSet(ctx, id);
  if (row.status !== 'active') throw conflict('Only an active set can be the default.', 'invalid_status');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run('UPDATE wire_credential_sets SET is_default = 0, updated_at = ? WHERE currency = ? AND is_default = 1', [now, row.currency]);
    ctx.db.run('UPDATE wire_credential_sets SET is_default = 1, updated_at = ?, updated_by = ? WHERE id = ?', [now, actor.id, id]);
    audit(ctx, actor, { action: 'credentials.wire_default', targetType: 'wire_set', targetId: id, data: { currency: row.currency } });
  });
  return wireView(getWireSet(ctx, id));
}

export function wireRowToSnapshot(row: WireSetRow): WireCredentialSnapshot {
  return {
    wireSetId: row.id,
    name: row.name,
    beneficiary: row.beneficiary,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    routingNumber: row.routing_number,
    swiftBic: row.swift_bic,
    bankAddress: row.bank_address,
    instructions: row.instructions,
    currency: row.currency,
  };
}

/* ---------- Wallets ---------- */

export function listWallets(ctx: AppContext) {
  const rows = ctx.db.all<WalletRow>('SELECT * FROM crypto_wallets ORDER BY status, asset, network, name COLLATE NOCASE');
  return markInUseWallet(
    ctx,
    rows.map(walletView),
  );
}

export function getWallet(ctx: AppContext, id: string): WalletRow {
  const r = ctx.db.get<WalletRow>('SELECT * FROM crypto_wallets WHERE id = ?', [id]);
  if (!r) throw notFound('Wallet not found.');
  return r;
}

export function defaultWallet(ctx: AppContext, asset: AssetCode, network: NetworkId, purpose: WalletPurpose = 'deposit'): WalletRow | null {
  return (
    ctx.db.get<WalletRow>(
      `SELECT * FROM crypto_wallets
       WHERE asset = ? AND network = ? AND purpose = ? AND status = 'active' AND is_default = 1 LIMIT 1`,
      [asset, network, purpose],
    ) ?? null
  );
}

function assertWalletAddressCompatible(ctx: AppContext, address: string, network: NetworkId | null, excludeId?: string) {
  const addrErr = validateWalletAddress(address, network);
  if (addrErr) throw badRequest(addrErr, { field: 'address' });
  if (!network) return;
  const others = ctx.db.all<{ id: string; network: NetworkId | null }>(
    `SELECT id, network FROM crypto_wallets WHERE lower(address) = lower(?) ${excludeId ? 'AND id != ?' : ''}`,
    excludeId ? [address, excludeId] : [address],
  );
  for (const o of others) {
    if (!o.network || o.network === network) continue;
    const evm = ['ethereum', 'base', 'bsc'];
    const bothEvm = evm.includes(o.network) && evm.includes(network);
    if (!bothEvm)
      throw conflict(
        `This address is already registered for ${o.network}. Use a separate compatible-network assignment only for EVM (Ethereum/Base/BSC).`,
        'address_network_conflict',
      );
  }
}

function normalizeWalletInput(ctx: AppContext, input: CryptoWalletInput, excludeId?: string) {
  const name = input.name.trim();
  if (!name) throw badRequest('Enter an internal name.', { field: 'name' });
  const asset = input.asset ?? null;
  const network = input.network ?? null;
  const pairErr = validateWalletPair(asset, network);
  if (pairErr) throw badRequest(pairErr);
  const address = input.address.trim();
  assertWalletAddressCompatible(ctx, address, network, excludeId);
  if (asset && network && !isSupportedPair(asset, network)) throw badRequest('Unsupported asset/network pair.');
  const tag = input.destinationTag?.trim() || null;
  if (tag && network !== 'xrpl') throw badRequest('Destination tag applies only to XRP Ledger wallets.', { field: 'destinationTag' });
  if (tag && !/^\d{1,10}$/.test(tag)) throw badRequest('Destination tag must be 1–10 digits.', { field: 'destinationTag' });
  return {
    name,
    asset,
    network,
    address,
    destinationTag: tag,
    purpose: (input.purpose ?? 'deposit') as WalletPurpose,
    note: input.note?.trim() || null,
  };
}

function walletStatusFor(asset: AssetCode | null, network: NetworkId | null): WalletStatus {
  return asset && network ? 'active' : 'pending_network';
}

export function createWallet(ctx: AppContext, actor: Actor, input: CryptoWalletInput) {
  const n = normalizeWalletInput(ctx, input);
  const id = newId('wal');
  const now = ctx.clock.now();
  const status = walletStatusFor(n.asset, n.network);
  ctx.db.tx(() => {
    ctx.db.run(
      `INSERT INTO crypto_wallets
        (id, name, asset, network, address, destination_tag, purpose, status, is_default, note, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [id, n.name, n.asset, n.network, n.address, n.destinationTag, n.purpose, status, n.note, now, now, actor.id, actor.id],
    );
    audit(ctx, actor, {
      action: 'credentials.wallet_created',
      targetType: 'crypto_wallet',
      targetId: id,
      data: { name: n.name, asset: n.asset, network: n.network, purpose: n.purpose },
    });
  });
  return walletView(getWallet(ctx, id));
}

export function updateWallet(ctx: AppContext, actor: Actor, id: string, input: CryptoWalletInput) {
  const existing = getWallet(ctx, id);
  const n = normalizeWalletInput(ctx, input, id);
  const now = ctx.clock.now();
  let status: WalletStatus = existing.status === 'suspended' ? 'suspended' : walletStatusFor(n.asset, n.network);
  if (existing.status === 'active' && n.asset && n.network) status = 'active';
  ctx.db.tx(() => {
    const clearDefault = status !== 'active' ? 1 : 0;
    ctx.db.run(
      `UPDATE crypto_wallets SET
        name = ?, asset = ?, network = ?, address = ?, destination_tag = ?, purpose = ?, status = ?,
        is_default = CASE WHEN ? = 1 THEN 0 ELSE is_default END,
        note = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [n.name, n.asset, n.network, n.address, n.destinationTag, n.purpose, status, clearDefault, n.note, now, actor.id, id],
    );
    audit(ctx, actor, {
      action: 'credentials.wallet_updated',
      targetType: 'crypto_wallet',
      targetId: id,
      data: { name: n.name, asset: n.asset, network: n.network, status },
    });
  });
  return walletView(getWallet(ctx, id));
}

export function setWalletStatus(ctx: AppContext, actor: Actor, id: string, status: 'active' | 'suspended') {
  const row = getWallet(ctx, id);
  if (status === 'active') {
    if (!row.asset || !row.network) throw conflict('Select an asset and network before activating this wallet.', 'network_required');
    const addrErr = validateWalletAddress(row.address, row.network);
    if (addrErr) throw badRequest(addrErr);
  }
  if (row.status === status) return walletView(row);
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    if (status === 'suspended') {
      ctx.db.run('UPDATE crypto_wallets SET status = ?, is_default = 0, updated_at = ?, updated_by = ? WHERE id = ?', [
        status,
        now,
        actor.id,
        id,
      ]);
    } else {
      ctx.db.run('UPDATE crypto_wallets SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, now, actor.id, id]);
    }
    audit(ctx, actor, {
      action: status === 'active' ? 'credentials.wallet_activated' : 'credentials.wallet_suspended',
      targetType: 'crypto_wallet',
      targetId: id,
    });
  });
  return walletView(getWallet(ctx, id));
}

export function setWalletDefault(ctx: AppContext, actor: Actor, id: string) {
  const row = getWallet(ctx, id);
  if (row.status !== 'active' || !row.asset || !row.network)
    throw conflict('Only an active wallet with asset and network can be the default.', 'invalid_status');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run(
      `UPDATE crypto_wallets SET is_default = 0, updated_at = ?
       WHERE asset = ? AND network = ? AND purpose = ? AND is_default = 1`,
      [now, row.asset, row.network, row.purpose],
    );
    ctx.db.run('UPDATE crypto_wallets SET is_default = 1, updated_at = ?, updated_by = ? WHERE id = ?', [now, actor.id, id]);
    audit(ctx, actor, {
      action: 'credentials.wallet_default',
      targetType: 'crypto_wallet',
      targetId: id,
      data: { asset: row.asset, network: row.network, purpose: row.purpose },
    });
  });
  return walletView(getWallet(ctx, id));
}

export function walletRowToSnapshot(row: WalletRow): WalletSnapshot {
  if (!row.asset || !row.network) throw conflict('Wallet has no asset/network.', 'network_required');
  return {
    walletId: row.id,
    name: row.name,
    asset: row.asset,
    network: row.network,
    address: row.address,
    destinationTag: row.destination_tag,
    purpose: row.purpose,
  };
}

/** Fix seed rows that were inserted with created_at = 0. */
export function touchSeedWalletTimestamps(ctx: AppContext): void {
  const now = ctx.clock.now();
  ctx.db.run('UPDATE crypto_wallets SET created_at = ?, updated_at = ? WHERE created_at = 0', [now, now]);
}

/* ---------- Order snapshots ---------- */

export function orderWireSnapshot(ctx: AppContext, orderId: string) {
  const r = ctx.db.get<OrderWireSnapRow>('SELECT * FROM order_wire_snapshots WHERE order_id = ?', [orderId]);
  return r ? wireSnapView(r) : null;
}

export function orderWalletSnapshot(ctx: AppContext, orderId: string) {
  const r = ctx.db.get<OrderWalletSnapRow>('SELECT * FROM order_wallet_snapshots WHERE order_id = ?', [orderId]);
  return r ? walletSnapView(r) : null;
}

export function assignmentHistory(ctx: AppContext, orderId: string) {
  return ctx.db
    .all<{
      id: number;
      kind: string;
      action: string;
      actor_id: string | null;
      previous_json: string | null;
      new_json: string;
      reason: string | null;
      created_at: number;
    }>('SELECT * FROM credential_assignment_events WHERE order_id = ? ORDER BY id', [orderId])
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      action: e.action,
      actorId: e.actor_id,
      previous: e.previous_json ? (JSON.parse(e.previous_json) as unknown) : null,
      next: JSON.parse(e.new_json) as unknown,
      reason: e.reason,
      createdAt: e.created_at,
    }));
}

export function recordAssignment(
  ctx: AppContext,
  orderId: string,
  kind: 'wire' | 'wallet',
  action: 'assigned' | 'replaced',
  actor: Actor,
  previous: unknown,
  next: unknown,
  reason: string | null,
) {
  ctx.db.run(
    `INSERT INTO credential_assignment_events (order_id, kind, action, actor_id, previous_json, new_json, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, kind, action, actor.id, previous ? JSON.stringify(previous) : null, JSON.stringify(next), reason, ctx.clock.now()],
  );
}

export function upsertWireSnapshot(ctx: AppContext, orderId: string, snap: WireCredentialSnapshot, actor: Actor, revealed: boolean) {
  const now = ctx.clock.now();
  ctx.db.run('DELETE FROM order_wire_snapshots WHERE order_id = ?', [orderId]);
  ctx.db.run(
    `INSERT INTO order_wire_snapshots
      (order_id, wire_set_id, name, beneficiary, bank_name, account_number, routing_number, swift_bic, bank_address, instructions, currency, assigned_by, assigned_at, revealed_to_customer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      snap.wireSetId,
      snap.name,
      snap.beneficiary,
      snap.bankName,
      snap.accountNumber,
      snap.routingNumber,
      snap.swiftBic,
      snap.bankAddress,
      snap.instructions,
      snap.currency,
      actor.id,
      now,
      revealed ? 1 : 0,
    ],
  );
}

export function upsertWalletSnapshot(ctx: AppContext, orderId: string, snap: WalletSnapshot, actor: Actor, revealed: boolean) {
  const now = ctx.clock.now();
  ctx.db.run('DELETE FROM order_wallet_snapshots WHERE order_id = ?', [orderId]);
  ctx.db.run(
    `INSERT INTO order_wallet_snapshots
      (order_id, wallet_id, name, asset, network, address, destination_tag, purpose, assigned_by, assigned_at, revealed_to_customer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      snap.walletId,
      snap.name,
      snap.asset,
      snap.network,
      snap.address,
      snap.destinationTag ?? null,
      snap.purpose,
      actor.id,
      now,
      revealed ? 1 : 0,
    ],
  );
}

export function listActiveWalletsForPair(ctx: AppContext, asset: AssetCode, network: NetworkId, purpose: WalletPurpose = 'deposit') {
  return ctx.db
    .all<WalletRow>(
      `SELECT * FROM crypto_wallets WHERE asset = ? AND network = ? AND purpose = ? AND status = 'active' ORDER BY is_default DESC, name`,
      [asset, network, purpose],
    )
    .map(walletView);
}

export function listActiveWireSets(ctx: AppContext, currency: WireCurrency = 'USD') {
  return ctx.db
    .all<WireSetRow>(
      `SELECT * FROM wire_credential_sets WHERE currency = ? AND status = 'active' ORDER BY is_default DESC, name`,
      [currency],
    )
    .map(wireView);
}

export function assertStaffCredentialsAccess(actor: Actor): void {
  if (actor.type !== 'operator' && actor.type !== 'sandbox') throw forbidden('Only staff can manage credentials.');
}

export { wireLinesFromSnapshot };
