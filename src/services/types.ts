/**
 * The browser's view of the exchange API. Pages depend only on these
 * interfaces, reached through `useServices()`; the implementation in
 * `./api.ts` talks to the server over HTTP. Every business rule, price,
 * status and outcome comes from the server: the browser only displays it.
 *
 * Amounts arrive as decimal strings and are converted to bigint here, so UI
 * code keeps using the domain's exact money types.
 */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { AtomicAmount, Cents, Micros } from '@/domain/money';
import type { OrderEventType, OrderStatus, OrderStep } from '@/domain/order';
import type { PayoutMethodId } from '@/domain/payout';
import type { CourierDeliveryInput, CourierWindow } from '@/domain/courier';
import type { Quote, QuoteIssue } from '@/domain/quote';

export type AppMode = 'sandbox' | 'production';
export type ProviderState = 'sandbox' | 'configured' | 'not_configured' | 'disabled_by_policy';
export type Role = 'customer' | 'support' | 'reviewer' | 'admin' | 'owner';
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'needs_info' | 'rejected';

export interface ProviderSummary {
  key: string;
  label: string;
  state: ProviderState;
}

export interface LegalDocRef {
  slug: string;
  title: string;
  version: string;
  acceptance: 'signup' | 'order' | null;
}

export interface PublicConfig {
  mode: AppMode;
  realMoneyEnabled: boolean;
  featureFlags: { courierCashDelivery: boolean };
  providers: ProviderSummary[];
  policy: { quoteTtlMs: number; depositWindowMs: number; indicativeRefreshMs: number; minimumCents: Cents; largeDeskFromCents: Cents };
  legal: LegalDocRef[];
}

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: number;
  totpEnabled: boolean;
  fullName: string;
  phone: string | null;
  stateOfResidence: string | null;
  verification: { status: KycStatus; level: 'none' | 'basic' | 'enhanced' };
}

export interface ReferencePrice {
  asset: AssetCode;
  priceMicros: Micros;
  asOf: number;
  source: 'sandbox' | 'live';
}

export interface QuoteInput {
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  payoutMethod: PayoutMethodId;
}

export interface QuoteData {
  quote: Quote;
  issues: QuoteIssue[];
  price: ReferencePrice;
  /** Firm quotes are stored on the server and can be accepted once before they expire. */
  firm: boolean;
}

export interface CourierDetailsView {
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  window: CourierWindow;
  preferredDate: string | null;
  instructions: string;
}

export interface Destination {
  id: string;
  kind: 'bank' | 'card' | 'courier';
  label: string;
  /** Empty for courier addresses. */
  last4: string;
  methods: PayoutMethodId[];
  createdAt: number;
  /** Courier addresses only: the details the owner gave. */
  courier?: CourierDetailsView;
}

/** Delivery details on a courier order. Support staff get a masked version. */
export interface CourierDeliveryView extends CourierDetailsView {
  recipient: string;
  masked: boolean;
}

export interface OrderEventView {
  seq: number;
  type: OrderEventType | 'ORDER_CREATED';
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: string;
  actorId?: string | null;
  data?: Record<string, unknown>;
  visibility?: 'customer' | 'internal';
  detail: string;
  createdAt: number;
}

export interface OrderView {
  id: string;
  reference: string;
  source: 'sandbox' | 'live';
  status: OrderStatus;
  version: number;
  asset: AssetCode;
  network: NetworkId;
  networkLabel: string;
  amountAtomic: AtomicAmount;
  quote: {
    id: string;
    referencePriceMicros: Micros;
    grossCents: Cents;
    spreadBps: number;
    spreadCents: Cents;
    payoutFeeCents: Cents;
    netCents: Cents;
  };
  payout: {
    method: PayoutMethodId;
    methodName: string;
    timing: string;
    label: string;
    last4: string;
    providerRef: string | null;
    /** Courier orders, customer view only. */
    delivery?: CourierDeliveryView | null;
  };
  refundAddress: string;
  deposit: {
    address: string | null;
    memo: string | null;
    deadline: number;
    confirmations: { count: number; required: number };
    txHash: string | null;
    amountAtomic: AtomicAmount | null;
    exception: 'amount_mismatch' | 'late' | 'order_closed' | null;
    customerReportedSentAt: number | null;
  };
  refundTxHash: string | null;
  steps: OrderStep[];
  events: OrderEventView[];
  createdAt: number;
  updatedAt: number;
  reviewReason?: string | null;
  assignedOperatorId?: string | null;
  depositProviderRef?: string | null;
}

export interface OrderSummary {
  id: string;
  reference: string;
  source: 'sandbox' | 'live';
  status: OrderStatus;
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  netCents: Cents;
  payoutMethod: PayoutMethodId;
  createdAt: number;
  updatedAt: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Notification {
  id: string;
  template: string;
  subject: string;
  body: string;
  status: string;
  createdAt: number;
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastSeenAt: number;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface Acceptance {
  slug: string;
  version: string;
  context: string;
  acceptedAt: number;
  orderId: string | null;
}

export type ConversationStatus = 'open' | 'pending' | 'resolved';

export interface Message {
  id: string;
  authorKind: 'customer' | 'staff' | 'system';
  authorId?: string | null;
  authorName?: string | null;
  body: string;
  internal: boolean;
  clientMessageId: string | null;
  createdAt: number;
}

export interface ConversationSummary {
  id: string;
  subject: string;
  status: ConversationStatus;
  order: { id: string; reference: string; status: OrderStatus } | null;
  createdAt: number;
  lastMessageAt: number;
  lastMessage: { body: string; authorKind: Message['authorKind']; internal: boolean } | null;
  unread: number;
  customer?: { id: string; email: string; name: string };
  assignedOperatorId?: string | null;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

export interface LargeDeskRequest {
  asset: AssetCode;
  network: NetworkId;
  approximateUsdCents: Cents;
  customerType: 'individual' | 'business';
  fullName: string;
  email: string;
  phone: string;
  timing: 'this_week' | 'this_month' | 'exploring';
  notes: string;
}

export type LiveEvent =
  | { type: 'order.updated'; data: { orderId: string; status: OrderStatus; version: number } }
  | { type: 'conversation.updated'; data: { conversationId: string } }
  | { type: 'message.created'; data: { conversationId: string; messageId: string } }
  | { type: 'notification.created'; data: { id: string } };

export type LiveState = 'connecting' | 'open' | 'reconnecting' | 'offline';

export type SignInResult = { mfaRequired: true; challengeId: string } | { mfaRequired: false; user: User };

export interface AuthApi {
  signUp(input: {
    email: string;
    password: string;
    fullName: string;
    stateOfResidence: string | null;
    accepted: { slug: string; version: string }[];
  }): Promise<User>;
  signIn(input: { email: string; password: string }): Promise<SignInResult>;
  verifyMfa(input: { challengeId: string; code: string }): Promise<User>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ sandboxResetUrl?: string }>;
  confirmPasswordReset(token: string, password: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  beginTotp(): Promise<{ secret: string; otpauthUrl: string }>;
  confirmTotp(code: string): Promise<void>;
  disableTotp(code: string): Promise<void>;
  sessions(): Promise<SessionInfo[]>;
  revokeOtherSessions(): Promise<number>;
  /** Re-reads the session from the server (after a 401, or on focus). */
  refresh(): Promise<User | null>;
}

export interface SessionStore {
  current(): User | null;
  mfaVerified(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface AccountApi {
  profile(): Promise<User>;
  updateProfile(patch: { fullName?: string; phone: string | null; stateOfResidence: string | null }): Promise<User>;
  startVerification(): Promise<{ status: KycStatus; hostedUrl: string | null }>;
  destinations(): Promise<Destination[]>;
  addBankAccount(input: {
    label: string;
    routingNumber: string;
    accountNumber: string;
    accountType: 'checking' | 'savings';
  }): Promise<Destination>;
  addCard(label: string): Promise<Destination>;
  addCourierAddress(input: CourierDeliveryInput): Promise<Destination>;
  removeDestination(id: string): Promise<void>;
  notifications(): Promise<Notification[]>;
  acceptances(): Promise<Acceptance[]>;
}

export interface OrdersApi {
  create(
    input: { quoteId: string; destinationId: string; refundAddress: string; accepted: { slug: string; version: string }[] },
    idempotencyKey: string,
  ): Promise<OrderView>;
  list(page?: number): Promise<Page<OrderSummary>>;
  get(id: string): Promise<OrderView>;
  cancel(id: string): Promise<OrderView>;
  reportSent(id: string, txHash: string | null): Promise<OrderView>;
}

/** Sandbox-only customer controls. Absent (undefined) in production. */
export interface SandboxApi {
  deposit(orderId: string, scenario: 'exact' | 'short' | 'late'): Promise<OrderView>;
  confirmations(orderId: string, toFinal: boolean): Promise<OrderView>;
}

export interface SupportApi {
  list(): Promise<ConversationSummary[]>;
  create(input: { subject: string; body: string; orderId: string | null; clientMessageId: string }): Promise<Conversation>;
  get(id: string): Promise<Conversation>;
  send(id: string, body: string, clientMessageId: string): Promise<Message>;
  markRead(id: string): Promise<void>;
}

export interface LiveApi {
  /** Opens (or shares) the server-sent events stream for the signed-in user. */
  subscribe(onEvent: (e: LiveEvent) => void): () => void;
  state(): LiveState;
  onState(listener: () => void): () => void;
}

export interface Services {
  config: PublicConfig;
  session: SessionStore;
  auth: AuthApi;
  pricing: { prices(): Promise<ReferencePrice[]> };
  quotes: { indicative(input: QuoteInput): Promise<QuoteData>; firm(input: QuoteInput): Promise<QuoteData> };
  account: AccountApi;
  orders: OrdersApi;
  sandbox?: SandboxApi;
  support: SupportApi;
  live: LiveApi;
  largeDesk: { submit(request: LargeDeskRequest): Promise<{ reference: string; source: AppMode }> };
  cash: { availability(zip: string): Promise<{ available: boolean; reason?: string; zip: string }> };
  admin: import('./adminTypes').AdminApi;
}
