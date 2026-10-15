/** Admin workspace API types. Every figure and record comes from the server; nothing here is computed in the browser. */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { AtomicAmount, Cents } from '@/domain/money';
import type { OrderStage, OrderStatus } from '@/domain/order';
import type { PayoutMethodId } from '@/domain/payout';
import type { IdDocumentType, KycDecision, KycSubmissionStatus } from '@/domain/identity';
import type {
  AppMode,
  CourierDeliveryView,
  Conversation,
  ConversationStatus,
  ConversationSummary,
  KycFileContent,
  KycSubmissionView,
  Message,
  OrderView,
  Page,
  ProviderState,
  Role,
} from './types';

export interface Overview {
  generatedAt: number;
  totals: {
    total: number;
    needsReview: number;
    awaitingDeposit: number;
    awaitingConfirmation: number;
    awaitingPayout: number;
    failedOrOverdue: number;
    completed: number;
    /** Waiting on a person: review, payout authorization, failed payout, pending refund or a hold. */
    needsAction: number;
    onHold: number;
    openConversations: number;
    unreadConversations: number;
  };
  byStatus: Record<OrderStatus, number>;
  processing: { completedLast30Days: number; medianMinutesToComplete: number | null; oldestOpenReviewMinutes: number | null };
  createdLast7Days: { day: string; n: number }[];
}

export interface QueueItem {
  id: string;
  reference: string;
  source: 'sandbox' | 'live';
  direction: 'sell' | 'buy';
  status: OrderStatus;
  stage: OrderStage;
  onHold: boolean;
  priority: 'high' | 'medium' | 'low';
  customer: { id: string; email: string; name: string };
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  /** Sell: value at the reference price. Buy: the cash the customer pays. */
  grossCents: Cents;
  netCents: Cents;
  payoutMethod: PayoutMethodId;
  assignedTo: { id: string; email: string | null } | null;
  depositException: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface QueueQuery {
  q?: string;
  status?: OrderStatus[];
  stage?: OrderStage[];
  payoutMethod?: PayoutMethodId | '';
  review?: 'open' | 'any';
  assigned?: 'me' | 'unassigned' | 'any';
  overdue?: boolean;
  /** Only orders waiting on a person. */
  attention?: boolean;
  sort?: 'created_at' | 'updated_at' | 'net_cents' | 'priority' | 'attention';
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type OrderActionKey =
  | 'assign'
  | 'note'
  | 'flag'
  | 'request_info'
  | 'approve'
  | 'reject'
  | 'authorize_payout'
  | 'record_manual_payout'
  | 'retry_payout'
  | 'refund'
  | 'resubmit_refund'
  | 'message'
  | 'hold'
  | 'release_hold'
  | 'set_courier_fee';

export interface ActionAvailability {
  action: OrderActionKey;
  label: string;
  /** Why the action can't be taken right now, or null when it can. */
  unavailable: string | null;
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: { type: string; id: string | null; role: string | null };
  action: string;
  target: { type: string; id: string | null } | null;
  reason: string | null;
  ip: string | null;
  data: Record<string, unknown>;
  hash: string;
}

export interface AdminOrderDetail {
  order: OrderView;
  customer: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    stateOfResidence: string | null;
    kycStatus: string;
    kycLevel: string;
    accountStatus: string;
    memberSince: number;
    orders: { total: number; completed: number };
  };
  /** Courier orders only. Masked for support staff. */
  courierDelivery: CourierDeliveryView | null;
  notes: { id: string; body: string; createdAt: number; author: { id: string; email: string } }[];
  /** Every notice sent to the customer about this order (in-account and email record). */
  notifications: import('./types').Notification[];
  reviews: {
    id: string;
    status: string;
    reason: string;
    openedBy: string | null;
    decidedBy: string | null;
    decisionReason: string | null;
    createdAt: number;
    decidedAt: number | null;
  }[];
  payouts: {
    id: string;
    attempt: number;
    provider: string;
    method: string;
    amountCents: number;
    status: string;
    providerRef: string | null;
    failureReason: string | null;
    authorizedBy: string | null;
    authorizationReason: string | null;
    createdAt: number;
    updatedAt: number;
  }[];
  refund: {
    status: string;
    providerRef: string | null;
    txHash: string | null;
    reason: string;
    createdAt: number;
    updatedAt: number;
  } | null;
  deposits: { provider: string; eventId: string; txHash: string; amountAtomic: string; confirmations: number; observedAt: number }[];
  conversations: { id: string; subject: string; status: ConversationStatus; lastMessageAt: number }[];
  audit: AuditEntry[];
  actions: ActionAvailability[];
  sandboxControls: boolean;
}

export interface StaffMember {
  id: string;
  email: string;
  role: Role;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'disabled';
  totpEnabled: boolean;
  kycStatus: string | null;
  createdAt: number;
}

export interface WebhookRow {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  status: string;
  error: string | null;
  receivedAt: number;
  processedAt: number | null;
}

export interface SystemStatus {
  mode: AppMode;
  realMoneyEnabled: boolean;
  featureFlags: { courierCashDelivery: boolean };
  providers: { key: string; label: string; state: ProviderState; detail: string }[];
  database: { applied: number; pending: string[] };
  auditChain: { ok: true; count: number } | { ok: false; brokenAtId: number };
  liveConnections: number;
  requireStaffMfa: boolean;
  manualReviewThresholdCents: string;
  warnings: string[];
  notifications: { status: string; n: number }[];
}

export interface DeskRequest {
  id: string;
  reference: string;
  asset: AssetCode;
  network: NetworkId;
  approximateUsdCents: string;
  customerType: string;
  fullName: string;
  email: string;
  phone: string;
  timing: string;
  notes: string;
  status: string;
  createdAt: number;
}

export interface OutboxMessage {
  id: string;
  recipient: string;
  template: string;
  subject: string;
  body: string;
  status: string;
  createdAt: number;
}

export interface StaffConversation extends Conversation {
  customerContext: {
    kycStatus: string;
    stateOfResidence: string | null;
    recentOrders: { id: string; reference: string; status: OrderStatus; createdAt: number }[];
  };
}

export interface SandboxOutcome {
  outcome: unknown;
  order: OrderView;
}

export interface KycQueueItem {
  id: string;
  customer: { id: string; name: string; email: string };
  idType: IdDocumentType;
  status: KycSubmissionStatus;
  fileCount: number;
  submittedAt: number | null;
  reviewedAt: number | null;
}
export type KycQueueFilter = 'submitted' | 'needs_info' | 'approved' | 'rejected' | 'all';
export interface KycDetail extends KycSubmissionView {
  reviewedBy: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    countryOfResidence: string | null;
    stateOfResidence: string | null;
    kycStatus: string;
    createdAt: number;
  };
  history: { id: string; status: KycSubmissionStatus; createdAt: number }[];
}

export interface WireCredentialSet {
  id: string;
  name: string;
  beneficiary: string;
  bankName: string;
  accountNumber: string | null;
  routingNumber: string | null;
  swiftBic: string | null;
  bankAddress: string | null;
  instructions: string | null;
  currency: string;
  status: 'active' | 'suspended';
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  updatedBy: string | null;
  inUse: boolean;
}

export interface CryptoWallet {
  id: string;
  name: string;
  asset: AssetCode | null;
  network: NetworkId | null;
  address: string;
  purpose: 'deposit' | 'payout';
  status: 'active' | 'suspended' | 'pending_network';
  isDefault: boolean;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  updatedBy: string | null;
  inUse: boolean;
}

export type WireCredentialInput = {
  name: string;
  beneficiary: string;
  bankName: string;
  accountNumber?: string | null;
  routingNumber?: string | null;
  swiftBic?: string | null;
  bankAddress?: string | null;
  instructions?: string | null;
  currency?: 'USD';
};

export type CryptoWalletInput = {
  name: string;
  asset?: AssetCode | null;
  network?: NetworkId | null;
  address: string;
  purpose?: 'deposit' | 'payout';
  note?: string | null;
};

export interface AdminApi {
  overview(): Promise<Overview>;
  staff(): Promise<StaffMember[]>;
  queue(q: QueueQuery): Promise<Page<QueueItem>>;
  order(id: string): Promise<AdminOrderDetail>;
  act(id: string, action: OrderActionKey, body: Record<string, unknown>): Promise<OrderView>;
  credentials: {
    listWire(): Promise<WireCredentialSet[]>;
    createWire(input: WireCredentialInput): Promise<WireCredentialSet>;
    updateWire(id: string, input: WireCredentialInput): Promise<WireCredentialSet>;
    setWireStatus(id: string, status: 'active' | 'suspended'): Promise<WireCredentialSet>;
    setWireDefault(id: string): Promise<WireCredentialSet>;
    listWallets(): Promise<CryptoWallet[]>;
    walletsForPair(asset: AssetCode, network: NetworkId): Promise<CryptoWallet[]>;
    createWallet(input: CryptoWalletInput): Promise<CryptoWallet>;
    updateWallet(id: string, input: CryptoWalletInput): Promise<CryptoWallet>;
    setWalletStatus(id: string, status: 'active' | 'suspended'): Promise<CryptoWallet>;
    setWalletDefault(id: string): Promise<CryptoWallet>;
    assignWire(orderId: string, wireSetId: string, opts?: { confirmReplace?: boolean; reason?: string }): Promise<OrderView>;
    assignWallet(orderId: string, walletId: string, opts?: { confirmReplace?: boolean; reason?: string }): Promise<OrderView>;
    issueWire(orderId: string, wireSetId?: string): Promise<OrderView>;
  };
  inbox(q: {
    status?: ConversationStatus | 'all';
    q?: string;
    assigned?: 'me' | 'unassigned' | 'any';
    unread?: boolean;
    page?: number;
  }): Promise<Page<ConversationSummary>>;
  conversation(id: string): Promise<StaffConversation>;
  reply(id: string, body: string, internal: boolean, clientMessageId: string): Promise<Message>;
  setConversationStatus(id: string, status: ConversationStatus): Promise<StaffConversation>;
  assignConversation(id: string, operatorId: string | null): Promise<StaffConversation>;
  markConversationRead(id: string): Promise<void>;
  users(q: { q?: string; role?: Role | ''; page?: number }): Promise<Page<UserRow>>;
  changeRole(id: string, role: Role, reason: string): Promise<void>;
  setUserStatus(id: string, status: 'active' | 'disabled', reason: string): Promise<void>;
  audit(q: { targetType?: string; targetId?: string; actorId?: string; action?: string; page?: number }): Promise<Page<AuditEntry>>;
  webhooks(page?: number): Promise<Page<WebhookRow>>;
  kyc: {
    queue(q: { status: KycQueueFilter; page?: number }): Promise<Page<KycQueueItem>>;
    get(id: string): Promise<KycDetail>;
    file(id: string, fileId: string): Promise<KycFileContent>;
    decide(id: string, decision: KycDecision, reason: string): Promise<KycDetail>;
  };
  system(): Promise<SystemStatus>;
  largeDesk(page?: number): Promise<Page<DeskRequest>>;
  /** Sandbox lab. Each call goes through the signed webhook pipeline on the server. */
  sandbox: {
    deposit(id: string, scenario: 'exact' | 'short' | 'late'): Promise<SandboxOutcome>;
    confirmations(id: string, toFinal: boolean): Promise<SandboxOutcome>;
    payout(id: string, outcome: 'processing' | 'completed' | 'failed', reason?: string): Promise<SandboxOutcome>;
    refundComplete(id: string): Promise<SandboxOutcome>;
    replay(id: string): Promise<SandboxOutcome>;
    expire(id: string): Promise<SandboxOutcome>;
    wireInstructions(id: string): Promise<SandboxOutcome>;
    wireReceived(id: string): Promise<SandboxOutcome>;
    notifications(): Promise<OutboxMessage[]>;
  };
}
