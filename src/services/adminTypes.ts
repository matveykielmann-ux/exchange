/** Admin workspace API types. Every figure and record comes from the server; nothing here is computed in the browser. */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { AtomicAmount, Cents } from '@/domain/money';
import type { OrderStatus } from '@/domain/order';
import type { PayoutMethodId } from '@/domain/payout';
import type {
  AppMode,
  CourierDeliveryView,
  Conversation,
  ConversationStatus,
  ConversationSummary,
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
  priority: 'high' | 'medium' | 'low';
  customer: { id: string; email: string; name: string };
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
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
  payoutMethod?: PayoutMethodId | '';
  review?: 'open' | 'any';
  assigned?: 'me' | 'unassigned' | 'any';
  overdue?: boolean;
  sort?: 'created_at' | 'updated_at' | 'net_cents' | 'priority';
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
  | 'retry_payout'
  | 'refund'
  | 'resubmit_refund';

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

export interface AdminApi {
  overview(): Promise<Overview>;
  staff(): Promise<StaffMember[]>;
  queue(q: QueueQuery): Promise<Page<QueueItem>>;
  order(id: string): Promise<AdminOrderDetail>;
  act(id: string, action: OrderActionKey, body: Record<string, unknown>): Promise<OrderView>;
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
    notifications(): Promise<OutboxMessage[]>;
  };
}
