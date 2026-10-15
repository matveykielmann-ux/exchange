/**
 * Ordered, append-only schema migrations. Never edit a migration that has
 * shipped: add a new one. Each runs inside a transaction and is recorded in
 * schema_migrations with a checksum, so an edited migration is detected.
 *
 * Money columns: USD cents are INTEGER (well inside 2^53, enforced by CHECK);
 * crypto atomic amounts and USD-micro prices are TEXT digit strings because
 * 18-decimal amounts overflow 64-bit integers. Code converts both to bigint.
 */
export interface Migration {
  id: number;
  name: string;
  sql: string;
  /**
   * Table rebuilds (SQLite cannot alter a CHECK constraint) run with foreign
   * keys off, as SQLite's documented procedure requires; foreign_key_check
   * then runs inside the same transaction and aborts it on any violation.
   */
  disableForeignKeys?: boolean;
}

const digits = (col: string, nullable = false) =>
  `${col} TEXT${nullable ? '' : ' NOT NULL'} CHECK (${nullable ? `${col} IS NULL OR ` : ''}(length(${col}) BETWEEN 1 AND 40 AND ${col} NOT GLOB '*[^0-9]*'))`;
const cents = (col: string, nullable = false) =>
  `${col} INTEGER${nullable ? '' : ' NOT NULL'} CHECK (${nullable ? `${col} IS NULL OR ` : ''}(${col} BETWEEN -900000000000000 AND 900000000000000))`;

const appendOnly = (table: string) => `
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, '${table} is append-only'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, '${table} is append-only'); END;`;

const ORDER_STATUS_CHECK = `status IN ('created','awaiting_deposit','deposit_observed','confirming','deposit_confirmed','compliance_review','ready_for_payout','payout_submitted','payout_processing','completed','rejected','failed','cancelled','expired','refund_pending','refunded')`;

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    sql: `
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','support','reviewer','admin','owner')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  totp_secret_enc TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0,1)),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX users_role ON users(role);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- HMAC of the session token; the token itself is never stored
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  mfa_verified INTEGER NOT NULL DEFAULT 0 CHECK (mfa_verified IN (0,1)),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE login_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX password_reset_user ON password_reset_tokens(user_id);

CREATE TABLE customer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 120),
  phone TEXT CHECK (phone IS NULL OR length(phone) <= 32),
  state_of_residence TEXT CHECK (state_of_residence IS NULL OR length(state_of_residence) = 2),
  kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified','pending','verified','needs_info','rejected')),
  kyc_level TEXT NOT NULL DEFAULT 'none' CHECK (kyc_level IN ('none','basic','enhanced')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  level TEXT NOT NULL CHECK (level IN ('basic','enhanced')),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','needs_info','rejected')),
  result_detail TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (provider, provider_ref)
);
CREATE INDEX identity_verifications_user ON identity_verifications(user_id, created_at);

CREATE TABLE payout_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bank','card')),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  last4 TEXT NOT NULL CHECK (length(last4) = 4 AND last4 NOT GLOB '*[^0-9]*'),
  methods TEXT NOT NULL, -- JSON array of payout method ids
  -- AES-256-GCM ciphertext of {routingNumber, accountNumber, accountType} for banks, or the provider token for cards.
  details_enc TEXT NOT NULL,
  provider_token TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  created_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE INDEX payout_destinations_user ON payout_destinations(user_id, status);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('sandbox','live')),
  asset TEXT NOT NULL CHECK (asset IN ('BTC','ETH','USDT','USDC')),
  network TEXT NOT NULL,
  payout_method TEXT NOT NULL,
  ${digits('amount_atomic')},
  ${digits('reference_price_micros')},
  price_as_of INTEGER NOT NULL,
  ${cents('gross_cents')},
  spread_bps INTEGER NOT NULL CHECK (spread_bps BETWEEN 0 AND 10000),
  ${cents('spread_cents')},
  ${cents('payout_fee_cents')},
  ${cents('net_cents')},
  ${digits('effective_rate_micros')},
  issues TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  CHECK (gross_cents - spread_cents - payout_fee_cents = net_cents),
  CHECK (expires_at > created_at)
);
CREATE INDEX quotes_user ON quotes(user_id, created_at);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),
  ${ORDER_STATUS_CHECK.replace('status IN', 'status TEXT NOT NULL CHECK (status IN')}),
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('sandbox','live')),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  ${digits('amount_atomic')},
  ${digits('reference_price_micros')},
  ${cents('gross_cents')},
  spread_bps INTEGER NOT NULL,
  ${cents('spread_cents')},
  ${cents('payout_fee_cents')},
  ${cents('net_cents')},
  payout_method TEXT NOT NULL CHECK (payout_method IN ('ach','wire','instant_debit','courier_cash')),
  payout_destination_id TEXT NOT NULL REFERENCES payout_destinations(id),
  payout_label TEXT NOT NULL,
  payout_last4 TEXT NOT NULL,
  refund_address TEXT NOT NULL CHECK (length(refund_address) BETWEEN 20 AND 128),
  deposit_deadline INTEGER NOT NULL,
  confirmations_required INTEGER NOT NULL CHECK (confirmations_required > 0),
  confirmations_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmations_count >= 0),
  deposit_tx_hash TEXT,
  ${digits('deposit_amount_atomic', true)},
  deposit_exception TEXT CHECK (deposit_exception IS NULL OR deposit_exception IN ('amount_mismatch','late','order_closed')),
  review_reason TEXT,
  payout_provider_ref TEXT,
  refund_tx_hash TEXT,
  assigned_operator_id TEXT REFERENCES users(id),
  customer_reported_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  CHECK (gross_cents - spread_cents - payout_fee_cents = net_cents)
);
CREATE INDEX orders_user ON orders(user_id, created_at DESC);
CREATE INDEX orders_status ON orders(status, updated_at);
CREATE INDEX orders_assigned ON orders(assigned_operator_id);
CREATE INDEX orders_created ON orders(created_at DESC);
CREATE INDEX orders_deadline ON orders(status, deposit_deadline);

-- The accepted quote and amounts are an immutable snapshot of the order.
CREATE TRIGGER orders_snapshot_immutable BEFORE UPDATE OF
  quote_id, user_id, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents,
  payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address,
  deposit_deadline, confirmations_required, reference, created_at
ON orders BEGIN SELECT RAISE(ABORT, 'order snapshot fields are immutable'); END;

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer','operator','provider','system')),
  actor_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('customer','internal')),
  detail TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE (order_id, seq)
);
${appendOnly('order_events')}

CREATE TABLE deposit_instructions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  address TEXT NOT NULL,
  memo TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE deposit_observations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  ${digits('amount_atomic')},
  confirmations INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX deposit_observations_order ON deposit_observations(order_id);
${appendOnly('deposit_observations')}

CREATE TABLE payout_instructions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  ${cents('amount_cents')},
  status TEXT NOT NULL CHECK (status IN ('authorized','submitted','processing','completed','failed','not_configured')),
  provider_ref TEXT,
  failure_reason TEXT,
  authorized_by TEXT NOT NULL REFERENCES users(id),
  authorization_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (order_id, attempt)
);
CREATE INDEX payout_instructions_ref ON payout_instructions(provider, provider_ref);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  address TEXT NOT NULL,
  ${digits('amount_atomic')},
  status TEXT NOT NULL CHECK (status IN ('initiated','submitted','completed','failed','not_configured')),
  provider_ref TEXT,
  tx_hash TEXT,
  initiated_by TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE compliance_reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL CHECK (status IN ('open','info_requested','approved','rejected')),
  reason TEXT NOT NULL,
  opened_by TEXT, -- user id, or NULL for the system
  decided_by TEXT REFERENCES users(id),
  decision_reason TEXT,
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX compliance_reviews_order ON compliance_reviews(order_id, created_at);
CREATE INDEX compliance_reviews_status ON compliance_reviews(status);

CREATE TABLE operator_notes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at INTEGER NOT NULL
);
CREATE INDEX operator_notes_order ON operator_notes(order_id, created_at);
${appendOnly('operator_notes')}

CREATE TABLE support_conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 140),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  assigned_operator_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL,
  customer_last_read_at INTEGER NOT NULL DEFAULT 0,
  staff_last_read_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX support_conversations_customer ON support_conversations(customer_id, last_message_at DESC);
CREATE INDEX support_conversations_status ON support_conversations(status, last_message_at DESC);

CREATE TABLE support_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES support_conversations(id),
  author_id TEXT REFERENCES users(id),
  author_kind TEXT NOT NULL CHECK (author_kind IN ('customer','staff','system')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  internal INTEGER NOT NULL DEFAULT 0 CHECK (internal IN (0,1)),
  client_message_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (conversation_id, client_message_id)
);
CREATE INDEX support_messages_conversation ON support_messages(conversation_id, created_at);
${appendOnly('support_messages')}

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','not_configured','sandbox_captured')),
  provider_ref TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX notifications_status ON notifications(status);

CREATE TABLE provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('received','processed','rejected','failed')),
  payload TEXT NOT NULL,
  error TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  UNIQUE (provider, event_id)
);
CREATE INDEX provider_webhook_events_received ON provider_webhook_events(received_at DESC);

CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL, -- user id + route
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer','operator','provider','system','sandbox')),
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT,
  ip TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE
);
CREATE INDEX audit_events_target ON audit_events(target_type, target_id, at);
CREATE INDEX audit_events_actor ON audit_events(actor_id, at);
CREATE INDEX audit_events_action ON audit_events(action, at);
${appendOnly('audit_events')}

-- Privileged actions taken by staff, for the administrative-actions report.
CREATE VIEW admin_actions AS
  SELECT id, at, actor_id, actor_role, action, target_type, target_id, reason, ip, data
  FROM audit_events WHERE actor_type = 'operator';

CREATE TABLE legal_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_slug TEXT NOT NULL,
  document_version TEXT NOT NULL,
  context TEXT NOT NULL CHECK (context IN ('signup','order','reacceptance')),
  order_id TEXT REFERENCES orders(id),
  ip TEXT,
  accepted_at INTEGER NOT NULL
);
CREATE INDEX legal_acceptances_user ON legal_acceptances(user_id, document_slug);
${appendOnly('legal_acceptances')}

CREATE TABLE large_desk_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  ${cents('approximate_usd_cents')},
  customer_type TEXT NOT NULL CHECK (customer_type IN ('individual','business')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  timing TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at INTEGER NOT NULL
);
`,
  },
  {
    id: 2,
    name: 'courier_payout_destinations',
    disableForeignKeys: true,
    sql: `
CREATE TABLE payout_destinations_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bank','card','courier')),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  -- Courier addresses have no account number, so no last4.
  last4 TEXT NOT NULL CHECK ((kind = 'courier' AND last4 = '') OR (length(last4) = 4 AND last4 NOT GLOB '*[^0-9]*')),
  methods TEXT NOT NULL, -- JSON array of payout method ids
  -- AES-256-GCM ciphertext of the bank details, the card provider token, or the courier delivery details.
  details_enc TEXT NOT NULL,
  provider_token TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  created_at INTEGER NOT NULL,
  removed_at INTEGER
);
INSERT INTO payout_destinations_v2 (id, user_id, kind, label, last4, methods, details_enc, provider_token, status, created_at, removed_at)
  SELECT id, user_id, kind, label, last4, methods, details_enc, provider_token, status, created_at, removed_at FROM payout_destinations;
DROP TABLE payout_destinations;
ALTER TABLE payout_destinations_v2 RENAME TO payout_destinations;
CREATE INDEX payout_destinations_user ON payout_destinations(user_id, status);
`,
  },
  {
    id: 3,
    name: 'buy_orders_residence_documents',
    sql: `
-- Buy orders (cash collected by courier, crypto sent to the customer). For a buy, orders.amount_atomic is the
-- crypto the customer receives, gross_cents the cash collected, and refund_address the customer's receiving wallet.
ALTER TABLE quotes ADD COLUMN direction TEXT NOT NULL DEFAULT 'sell' CHECK (direction IN ('sell','buy'));
ALTER TABLE orders ADD COLUMN direction TEXT NOT NULL DEFAULT 'sell' CHECK (direction IN ('sell','buy'));

-- The Service is not limited to US residents; the US state applies only to US residents.
ALTER TABLE customer_profiles ADD COLUMN country_of_residence TEXT CHECK (country_of_residence IS NULL OR length(country_of_residence) = 2);
UPDATE customer_profiles SET country_of_residence = 'US' WHERE state_of_residence IS NOT NULL;

-- Documents a customer uploads for an order (the ID shown at a cash handover). In sandbox mode the file is
-- checked and discarded: only its type, size and SHA-256 fingerprint are kept (stored = 0).
CREATE TABLE order_documents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('id_document')),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 120),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  stored INTEGER NOT NULL CHECK (stored IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX order_documents_order ON order_documents(order_id);
${appendOnly('order_documents')}
`,
  },
  {
    id: 4,
    name: 'order_hold_notification_reads',
    sql: `
-- An operator can put an order on hold (see BLOCKED_WHILE_ON_HOLD in src/domain/order.ts). The status is unchanged.
ALTER TABLE orders ADD COLUMN on_hold INTEGER NOT NULL DEFAULT 0 CHECK (on_hold IN (0,1));

-- In-account notifications: read state, the order they belong to, and the values the text was built from.
ALTER TABLE notifications ADD COLUMN read_at INTEGER;
ALTER TABLE notifications ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE notifications ADD COLUMN vars TEXT;
UPDATE notifications SET read_at = created_at;
CREATE INDEX notifications_order ON notifications(order_id, created_at);
CREATE INDEX notifications_unread ON notifications(user_id, read_at);
`,
  },
  {
    id: 5,
    name: 'orders_refund_address_optional',
    // Rebuilds orders (SQLite cannot alter a CHECK constraint); see Migration.disableForeignKeys.
    disableForeignKeys: true,
    sql: `
-- A sell order no longer needs a refund address up front: it is asked for only if funds have to be
-- returned, and can then be set once. A buy order still needs it (it is the wallet that receives the crypto).
CREATE TABLE orders_v5 (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),
  ${ORDER_STATUS_CHECK.replace('status IN', 'status TEXT NOT NULL CHECK (status IN')}),
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('sandbox','live')),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  ${digits('amount_atomic')},
  ${digits('reference_price_micros')},
  ${cents('gross_cents')},
  spread_bps INTEGER NOT NULL,
  ${cents('spread_cents')},
  ${cents('payout_fee_cents')},
  ${cents('net_cents')},
  payout_method TEXT NOT NULL CHECK (payout_method IN ('ach','wire','instant_debit','courier_cash')),
  payout_destination_id TEXT NOT NULL REFERENCES payout_destinations(id),
  payout_label TEXT NOT NULL,
  payout_last4 TEXT NOT NULL,
  refund_address TEXT CHECK (refund_address IS NULL OR length(refund_address) BETWEEN 20 AND 128),
  deposit_deadline INTEGER NOT NULL,
  confirmations_required INTEGER NOT NULL CHECK (confirmations_required > 0),
  confirmations_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmations_count >= 0),
  deposit_tx_hash TEXT,
  ${digits('deposit_amount_atomic', true)},
  deposit_exception TEXT CHECK (deposit_exception IS NULL OR deposit_exception IN ('amount_mismatch','late','order_closed')),
  review_reason TEXT,
  payout_provider_ref TEXT,
  refund_tx_hash TEXT,
  assigned_operator_id TEXT REFERENCES users(id),
  customer_reported_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  direction TEXT NOT NULL DEFAULT 'sell' CHECK (direction IN ('sell','buy')),
  on_hold INTEGER NOT NULL DEFAULT 0 CHECK (on_hold IN (0,1)),
  CHECK (gross_cents - spread_cents - payout_fee_cents = net_cents),
  CHECK (direction = 'sell' OR refund_address IS NOT NULL)
);
INSERT INTO orders_v5 (id, reference, user_id, quote_id, status, version, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address, deposit_deadline, confirmations_required, confirmations_count, deposit_tx_hash, deposit_amount_atomic, deposit_exception, review_reason, payout_provider_ref, refund_tx_hash, assigned_operator_id, customer_reported_sent_at, created_at, updated_at, closed_at, direction, on_hold) SELECT id, reference, user_id, quote_id, status, version, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address, deposit_deadline, confirmations_required, confirmations_count, deposit_tx_hash, deposit_amount_atomic, deposit_exception, review_reason, payout_provider_ref, refund_tx_hash, assigned_operator_id, customer_reported_sent_at, created_at, updated_at, closed_at, direction, on_hold FROM orders;
DROP TABLE orders;
ALTER TABLE orders_v5 RENAME TO orders;
CREATE INDEX orders_user ON orders(user_id, created_at DESC);
CREATE INDEX orders_status ON orders(status, updated_at);
CREATE INDEX orders_assigned ON orders(assigned_operator_id);
CREATE INDEX orders_created ON orders(created_at DESC);
CREATE INDEX orders_deadline ON orders(status, deposit_deadline);

-- The accepted quote and amounts stay an immutable snapshot. The refund address can be set once, never changed.
CREATE TRIGGER orders_snapshot_immutable BEFORE UPDATE OF
  quote_id, user_id, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents,
  payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4,
  deposit_deadline, confirmations_required, reference, created_at, direction
ON orders BEGIN SELECT RAISE(ABORT, 'order snapshot fields are immutable'); END;
CREATE TRIGGER orders_refund_address_once BEFORE UPDATE OF refund_address ON orders
WHEN OLD.refund_address IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'the refund address is already set'); END;
`,
  },
  {
    id: 6,
    name: 'kyc_documents',
    sql: `
-- Identity verification by documents (Service Rules 8.1): a photo ID, a selfie and a proof of address,
-- reviewed by a reviewer or admin in the CRM. One submission per attempt; the files belong to it.
CREATE TABLE kyc_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL CHECK (id_type IN ('drivers_license','state_id','passport')),
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','approved','needs_info','rejected')),
  decision_reason TEXT CHECK (decision_reason IS NULL OR length(decision_reason) <= 500),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at INTEGER,
  submitted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX kyc_submissions_user ON kyc_submissions(user_id, created_at DESC);
CREATE INDEX kyc_submissions_status ON kyc_submissions(status, submitted_at);

-- The file content is AES-256-GCM ciphertext (the data encryption key); it is never returned in lists.
CREATE TABLE kyc_files (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES kyc_submissions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('id_front','id_back','selfie','proof_of_address')),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 120),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  content_enc TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (submission_id, kind)
);
CREATE INDEX kyc_files_user ON kyc_files(user_id);
`,
  },
  {
    id: 7,
    name: 'orders_wire_buy',
    // Rebuilds orders (SQLite cannot alter a CHECK constraint); see Migration.disableForeignKeys.
    disableForeignKeys: true,
    sql: `
-- A buy can be paid by bank wire: it has no saved destination, so payout_destination_id may be null
-- for a wire buy (and only then). payout_method holds the pay-in of a buy: courier_cash or wire.
CREATE TABLE orders_v6 (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),
  ${ORDER_STATUS_CHECK.replace('status IN', 'status TEXT NOT NULL CHECK (status IN')}),
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('sandbox','live')),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  ${digits('amount_atomic')},
  ${digits('reference_price_micros')},
  ${cents('gross_cents')},
  spread_bps INTEGER NOT NULL,
  ${cents('spread_cents')},
  ${cents('payout_fee_cents')},
  ${cents('net_cents')},
  payout_method TEXT NOT NULL CHECK (payout_method IN ('ach','wire','instant_debit','courier_cash')),
  payout_destination_id TEXT REFERENCES payout_destinations(id),
  payout_label TEXT NOT NULL,
  payout_last4 TEXT NOT NULL,
  refund_address TEXT CHECK (refund_address IS NULL OR length(refund_address) BETWEEN 20 AND 128),
  deposit_deadline INTEGER NOT NULL,
  confirmations_required INTEGER NOT NULL CHECK (confirmations_required > 0),
  confirmations_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmations_count >= 0),
  deposit_tx_hash TEXT,
  ${digits('deposit_amount_atomic', true)},
  deposit_exception TEXT CHECK (deposit_exception IS NULL OR deposit_exception IN ('amount_mismatch','late','order_closed')),
  review_reason TEXT,
  payout_provider_ref TEXT,
  refund_tx_hash TEXT,
  assigned_operator_id TEXT REFERENCES users(id),
  customer_reported_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  direction TEXT NOT NULL DEFAULT 'sell' CHECK (direction IN ('sell','buy')),
  on_hold INTEGER NOT NULL DEFAULT 0 CHECK (on_hold IN (0,1)),
  CHECK (gross_cents - spread_cents - payout_fee_cents = net_cents),
  CHECK (direction = 'sell' OR refund_address IS NOT NULL),
  CHECK (payout_destination_id IS NOT NULL OR (direction = 'buy' AND payout_method = 'wire'))
);
INSERT INTO orders_v6 (id, reference, user_id, quote_id, status, version, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address, deposit_deadline, confirmations_required, confirmations_count, deposit_tx_hash, deposit_amount_atomic, deposit_exception, review_reason, payout_provider_ref, refund_tx_hash, assigned_operator_id, customer_reported_sent_at, created_at, updated_at, closed_at, direction, on_hold) SELECT id, reference, user_id, quote_id, status, version, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents, payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4, refund_address, deposit_deadline, confirmations_required, confirmations_count, deposit_tx_hash, deposit_amount_atomic, deposit_exception, review_reason, payout_provider_ref, refund_tx_hash, assigned_operator_id, customer_reported_sent_at, created_at, updated_at, closed_at, direction, on_hold FROM orders;
DROP TABLE orders;
ALTER TABLE orders_v6 RENAME TO orders;
CREATE INDEX orders_user ON orders(user_id, created_at DESC);
CREATE INDEX orders_status ON orders(status, updated_at);
CREATE INDEX orders_assigned ON orders(assigned_operator_id);
CREATE INDEX orders_created ON orders(created_at DESC);
CREATE INDEX orders_deadline ON orders(status, deposit_deadline);

-- The accepted quote and amounts stay an immutable snapshot. The refund address can be set once, never changed.
CREATE TRIGGER orders_snapshot_immutable BEFORE UPDATE OF
  quote_id, user_id, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents,
  payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4,
  deposit_deadline, confirmations_required, reference, created_at, direction
ON orders BEGIN SELECT RAISE(ABORT, 'order snapshot fields are immutable'); END;
CREATE TRIGGER orders_refund_address_once BEFORE UPDATE OF refund_address ON orders
WHEN OLD.refund_address IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'the refund address is already set'); END;
`,
  },
  {
    id: 8,
    name: 'manual_payout_evidence',
    sql: `
-- Distinguishes provider-verified payout completion from an operator-recorded
-- manual confirmation. Evidence fields are required for manual rows.
ALTER TABLE payout_instructions ADD COLUMN completion_kind TEXT
  CHECK (completion_kind IS NULL OR completion_kind IN ('provider','manual'));
ALTER TABLE payout_instructions ADD COLUMN evidence_ref TEXT
  CHECK (evidence_ref IS NULL OR length(evidence_ref) BETWEEN 4 AND 200);
ALTER TABLE payout_instructions ADD COLUMN evidence_note TEXT
  CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000);
ALTER TABLE payout_instructions ADD COLUMN recorded_by TEXT REFERENCES users(id);
ALTER TABLE payout_instructions ADD COLUMN completed_at INTEGER;
`,
  },
  {
    id: 9,
    name: 'courier_fee_per_order',
    sql: `
-- Courier delivery cost is quoted per order (no published flat tariff). While
-- courier_fee_pending=1 the fee/net snapshot may be updated once when an
-- operator sets the fee; the customer then accepts before deposit proceeds.
ALTER TABLE orders ADD COLUMN courier_fee_pending INTEGER NOT NULL DEFAULT 0
  CHECK (courier_fee_pending IN (0,1));
ALTER TABLE orders ADD COLUMN courier_fee_accepted_at INTEGER;

DROP TRIGGER IF EXISTS orders_snapshot_immutable;
CREATE TRIGGER orders_snapshot_immutable BEFORE UPDATE OF
  quote_id, user_id, source, asset, network, amount_atomic, reference_price_micros, gross_cents, spread_bps, spread_cents,
  payout_fee_cents, net_cents, payout_method, payout_destination_id, payout_label, payout_last4,
  deposit_deadline, confirmations_required, reference, created_at, direction
ON orders
WHEN NOT (OLD.courier_fee_pending = 1 AND NEW.courier_fee_pending = 0)
BEGIN SELECT RAISE(ABORT, 'order snapshot fields are immutable'); END;
`,
  },
];
