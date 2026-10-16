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
import type { IdDocumentType, KycFileKind, KycSubmissionStatus } from '@/domain/identity';
import type { AtomicAmount, Cents, Micros } from '@/domain/money';
import type { OrderEventType, OrderStage, OrderStatus, OrderStep } from '@/domain/order';
import type { PayoutMethodId } from '@/domain/payout';
import type { CourierDeliveryInput, CourierWindow } from '@/domain/courier';
import type { BuyPayIn, ExchangeDirection, Quote, QuoteIssue } from '@/domain/quote';

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
  /** Sandbox only: delay between demo autopilot steps; 0 when off (always 0 in production). */
  sandboxAutopilotStepMs: number;
  /** Customer site origin (https://YOUR_DOMAIN). */
  publicOrigin: string;
  /** CRM origin (https://crm.YOUR_DOMAIN), or null in single-host local/dev mode. */
  crmOrigin: string | null;
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
  /** ISO 3166-1 alpha-2; null on accounts created before it was asked. */
  countryOfResidence: string | null;
  /** US residents only. */
  stateOfResidence: string | null;
  verification: { status: KycStatus; level: 'none' | 'basic' | 'enhanced' };
}

export interface ReferencePrice {
  asset: AssetCode;
  priceMicros: Micros;
  asOf: number;
  source: 'sandbox' | 'live';
  /** Set when the price comes from a public market-data feed (indicative). */
  feed?: 'coingecko';
}

export interface SellQuoteInput {
  direction?: 'sell';
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  payoutMethod: PayoutMethodId;
}

/** Cash or wire → crypto: the dollars the customer pays. */
export interface BuyQuoteInput {
  direction: 'buy';
  asset: AssetCode;
  network: NetworkId;
  cashCents: Cents;
  /** Cash handed to a courier (default) or a bank wire. */
  payIn?: BuyPayIn;
}

export type QuoteInput = SellQuoteInput | BuyQuoteInput;

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

export interface OrderDocumentView {
  id: string;
  kind: 'id_document' | 'payment_receipt' | 'admin_attachment' | 'refund_attachment';
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  /** True when the encrypted file bytes are kept under FILES_DIR (or historically retained). */
  stored: boolean;
  createdAt: number;
}

export interface OrderView {
  id: string;
  reference: string;
  source: 'sandbox' | 'live';
  /** sell: crypto → USD. buy: cash collected by courier, or a bank wire → crypto. */
  direction: ExchangeDirection;
  /** Buy orders: how the dollars are paid. Null for a sell. */
  payIn: BuyPayIn | null;
  status: OrderStatus;
  /** Pipeline stage derived on the server from the status and the hold flag. */
  stage: OrderStage;
  /** An operator has put the order on hold. */
  onHold: boolean;
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
    /** True while an operator has not yet set the per-order courier fee. */
    feePending?: boolean;
  };
  /** Courier delivery/collection fee lifecycle for cash-by-courier orders. */
  courierFee?: {
    pending: boolean;
    acceptedAt: number | null;
    awaitingAcceptance: boolean;
  };
  payout: {
    method: PayoutMethodId;
    methodName: string;
    timing: string;
    label: string;
    last4: string;
    providerRef: string | null;
    /** How completion was established. Null until completed. */
    completionKind: 'provider' | 'manual' | null;
    /** Present when completionKind is manual: the recorded evidence reference. */
    evidenceRef: string | null;
    /** Buy→crypto: outgoing blockchain TXID when the payout was recorded. */
    payoutTxHash?: string | null;
    /** Courier orders, customer view only. */
    delivery?: CourierDeliveryView | null;
    /** Staff-only fields for manual records. */
    manualEvidenceNote?: string | null;
    manualRecordedBy?: string | null;
    completedAt?: number | null;
  };
  /** Sell orders: where crypto is returned, once the customer has given it (asked for only when a refund is needed). Null for a buy. */
  refundAddress: string | null;
  /** Sell orders: a refund is pending and waits for the customer's refund address. */
  refundAddressNeeded: boolean;
  /** Buy orders: the wallet that receives the crypto. */
  receiveAddress: string | null;
  /** Wire buys, once issued: bank details from the order's CRM snapshot. */
  wireInstructions: { label: string; value: string; placeholder: boolean }[] | null;
  /** Wire buy waiting for staff to assign bank credentials. */
  wireCredentialsPending?: boolean;
  /** Card buys, once issued: external payment URL / instructions. */
  cardPayInInstructions?: {
    paymentUrl: string | null;
    instructions: string | null;
    providerRef: string | null;
    assignedAt: number;
  } | null;
  /** Card buy waiting for staff to issue payment instructions. */
  cardPayInPending?: boolean;
  /** Sell order with no deposit address yet. */
  depositCredentialsPending?: boolean;
  /** Buy cash: waiting for staff to assign the courier meeting address. */
  courierMeetingPending?: boolean;
  documents: OrderDocumentView[];
  deposit: {
    address: string | null;
    memo: string | null;
    deadline: number;
    confirmations: { count: number; required: number };
    txHash: string | null;
    amountAtomic: AtomicAmount | null;
    exception: 'amount_mismatch' | 'late' | 'order_closed' | null;
    customerReportedSentAt: number | null;
    /** The hash the customer submitted for review. Only its format was checked. */
    customerTxHash: string | null;
    /** How deposit finality was established. Null until confirmed. */
    confirmationKind: 'provider' | 'manual' | null;
  };
  refundTxHash: string | null;
  steps: OrderStep[];
  events: OrderEventView[];
  createdAt: number;
  updatedAt: number;
  reviewReason?: string | null;
  assignedOperatorId?: string | null;
  depositProviderRef?: string | null;
  /** Staff-only: CRM credential snapshots and assignment history for this order. */
  operationCredentials?: {
    wire: {
      wireSetId: string | null;
      name: string;
      beneficiary: string;
      bankName: string;
      accountNumber: string | null;
      routingNumber: string | null;
      swiftBic: string | null;
      bankAddress: string | null;
      instructions: string | null;
      currency: string;
      assignedBy: string | null;
      assignedAt: number;
      revealedToCustomer: boolean;
    } | null;
    wallet: {
      walletId: string | null;
      name: string;
      asset: AssetCode;
      network: NetworkId;
      address: string;
      purpose: string;
      assignedBy: string | null;
      assignedAt: number;
      revealedToCustomer: boolean;
    } | null;
    assignmentHistory: { id: number; kind: string; action: string; actorId: string | null; reason: string | null; createdAt: number }[];
  };
}

export interface OrderSummary {
  id: string;
  reference: string;
  source: 'sandbox' | 'live';
  direction: ExchangeDirection;
  status: OrderStatus;
  stage: OrderStage;
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  netCents: Cents;
  /** Buy orders: the cash paid. */
  grossCents: Cents;
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
  /** The order this notice is about, when there is one. */
  orderId: string | null;
  /** The values the English text was built from, for showing it in another language. */
  vars: Record<string, string>;
  readAt: number | null;
}

export interface NotificationList {
  notifications: Notification[];
  unread: number;
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
    notInRestrictedTerritory: boolean;
    accepted: { slug: string; version: string }[];
    /** Ignored; server records US as the primary market. */
    countryOfResidence?: string | null;
  }): Promise<User>;
  /** `staffOnly` is the staff entrance: the server refuses customer accounts. */
  signIn(input: { email: string; password: string; staffOnly?: boolean }): Promise<SignInResult>;
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

/* ---------- Identity verification by documents ---------- */
export interface KycFileView {
  id: string;
  kind: KycFileKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
}
export interface KycSubmissionView {
  id: string;
  idType: IdDocumentType;
  status: KycSubmissionStatus;
  /** The reviewer's note when more information is needed. */
  reason: string | null;
  submittedAt: number | null;
  reviewedAt: number | null;
  files: KycFileView[];
  missing: KycFileKind[];
}
export interface KycState {
  status: KycStatus;
  submission: KycSubmissionView | null;
}
export interface KycFileContent extends KycFileView {
  dataBase64: string;
}

export interface AccountApi {
  profile(): Promise<User>;
  updateProfile(patch: {
    fullName?: string;
    phone: string | null;
    countryOfResidence?: string | null;
    stateOfResidence: string | null;
  }): Promise<User>;
  startVerification(): Promise<{ status: KycStatus; hostedUrl: string | null }>;
  kyc: {
    get(): Promise<KycState>;
    setIdType(idType: IdDocumentType): Promise<KycState>;
    upload(file: { kind: KycFileKind; fileName: string; contentType: string; dataBase64: string }): Promise<KycState>;
    file(id: string): Promise<KycFileContent>;
    submit(): Promise<KycState>;
  };
  destinations(): Promise<Destination[]>;
  addBankAccount(input: {
    label: string;
    routingNumber: string;
    accountNumber: string;
    accountType: 'checking' | 'savings';
  }): Promise<Destination>;
  addCard(input: { label?: string; cardNumber?: string; holderName?: string }): Promise<Destination>;
  addCourierAddress(input: CourierDeliveryInput): Promise<Destination>;
  removeDestination(id: string): Promise<void>;
  notifications(): Promise<NotificationList>;
  /** Marks the given notifications (all when omitted) as read; returns the new unread count. */
  markNotificationsRead(ids?: string[]): Promise<number>;
  acceptances(): Promise<Acceptance[]>;
}

export interface OrdersApi {
  create(
    input: {
      quoteId: string;
      destinationId: string;
      /** Buy orders. */
      receiveAddress?: string;
      accepted: { slug: string; version: string }[];
    },
    idempotencyKey: string,
  ): Promise<OrderView>;
  list(page?: number): Promise<Page<OrderSummary>>;
  get(id: string): Promise<OrderView>;
  cancel(id: string): Promise<OrderView>;
  reportSent(id: string, txHash: string | null): Promise<OrderView>;
  /** Accept the operator-quoted courier fee so deposit/collection can proceed. */
  acceptCourierFee(id: string): Promise<OrderView>;
  /** Sell orders with a pending refund: the address the deposit is returned to. Can be set once. */
  setRefundAddress(id: string, refundAddress: string): Promise<OrderView>;
  /** Demo ID upload for a cash handover. The sandbox checks and discards the file. */
  uploadDocument(
    id: string,
    file: { kind: 'id_document'; fileName: string; contentType: string; dataBase64: string },
  ): Promise<OrderDocumentView[]>;
  /** Submit receipt / TXID / wire reference for staff review (does not auto-confirm). */
  submitPaymentConfirmation(
    id: string,
    input: {
      txid?: string | null;
      wireReference?: string | null;
      comment?: string | null;
      file?: { fileName: string; contentType: string; dataBase64: string } | null;
    },
  ): Promise<{ confirmations: unknown; order: OrderView }>;
  /** Request a refund via support; requires completed KYC before approval. */
  requestRefund(
    id: string,
    input: { reason: string; file?: { fileName: string; contentType: string; dataBase64: string } | null },
  ): Promise<unknown>;
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
  support: SupportApi;
  live: LiveApi;
  largeDesk: { submit(request: LargeDeskRequest): Promise<{ reference: string; source: AppMode }> };
  cash: { availability(zip: string): Promise<{ available: boolean; reason?: string; zip: string }> };
  admin: import('./adminTypes').AdminApi;
}
