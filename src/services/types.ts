/**
 * Provider interfaces. The UI depends only on these. Production adapters
 * (pricing feed, blockchain monitoring, KYC/AML, sanctions screening, payout
 * rails, courier) implement the same contracts; see docs/architecture.md.
 *
 * Every result that originates from a mock carries `source: 'mock'` so the UI
 * can label it, and so a test can assert nothing mock leaks into production.
 */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { VerificationLevel } from '@/domain/identity';
import type { AtomicAmount, Cents, Micros } from '@/domain/money';
import type { PayoutMethodId } from '@/domain/payout';
import type { QuoteResult } from '@/domain/quote';
import type { Transaction, TransactionEvent } from '@/domain/transaction';

export type DataSource = 'mock';

/* ---------- Pricing ---------- */
export interface ReferencePrice {
  asset: AssetCode;
  priceMicros: Micros;
  asOf: number;
  source: DataSource;
}
export interface PricingProvider {
  getReferencePrice(asset: AssetCode): Promise<ReferencePrice>;
}

/* ---------- Quotes ---------- */
export interface QuoteInput {
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: AtomicAmount;
  payoutMethod: PayoutMethodId;
}
export interface QuoteService {
  getQuote(input: QuoteInput): Promise<QuoteResult & { price: ReferencePrice }>;
}

/* ---------- Identity ---------- */
export type { VerificationLevel };
export interface User {
  email: string;
  name: string;
  createdAt: number;
  verification: VerificationLevel;
}
export interface AuthService {
  currentUser(): User | null;
  signUp(input: { name: string; email: string; password: string }): Promise<User>;
  /** First factor. Resolves to a challenge id for the second factor. */
  signIn(input: { email: string; password: string }): Promise<{ challengeId: string }>;
  verifyMfa(input: { challengeId: string; code: string }): Promise<User>;
  signOut(): void;
  subscribe(listener: (user: User | null) => void): () => void;
}

export type VerificationOutcome =
  | { status: 'approved'; level: VerificationLevel; source: DataSource }
  | { status: 'needs_review'; source: DataSource };
export interface KycProvider {
  startVerification(email: string, level: Exclude<VerificationLevel, 'unverified'>): Promise<VerificationOutcome>;
}

/* ---------- Sanctions / risk screening ---------- */
export type ScreeningResult = { result: 'clear' | 'review' | 'blocked'; source: DataSource; note: string };
export interface ScreeningProvider {
  screenAddress(network: NetworkId, address: string): Promise<ScreeningResult>;
}

/* ---------- Payout destinations and rails ---------- */
export interface PayoutDestinationRecord {
  id: string;
  kind: 'bank' | 'card';
  label: string;
  last4: string;
  methods: PayoutMethodId[];
  source: DataSource;
}
export interface PayoutProvider {
  listDestinations(email: string): Promise<PayoutDestinationRecord[]>;
  /** Validates and keeps ONLY the last four digits; full numbers are discarded. */
  addBankAccount(
    email: string,
    input: { nickname: string; routingNumber: string; accountNumber: string },
  ): Promise<PayoutDestinationRecord>;
  addSimulatedCard(email: string): Promise<PayoutDestinationRecord>;
  removeDestination(email: string, id: string): Promise<void>;
}

/* ---------- Deposits / blockchain monitoring ---------- */
export interface DepositMonitor {
  createDepositAddress(asset: AssetCode, network: NetworkId): string;
}

/** Preview-only: stands in for blockchain and payout-provider events. Absent in production. */
export interface TransactionSimulator {
  /** The next "happy path" event a monitor or payout provider would emit. */
  nextEvent(tx: Transaction): TransactionEvent | null;
}

/* ---------- Transactions ---------- */
export interface CreateTransactionInput {
  quoteResult: QuoteResult;
  /** Resolved server-side against the customer's own saved destinations. */
  destinationId: string;
  refundAddress: string;
  customerEmail: string;
}
export interface TransactionService {
  list(email: string): Promise<Transaction[]>;
  get(id: string, email: string): Promise<Transaction | null>;
  create(input: CreateTransactionInput): Promise<Transaction>;
  dispatch(id: string, email: string, event: TransactionEvent): Promise<Transaction>;
}

/* ---------- Large transactions ---------- */
export interface LargeTransactionRequest {
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
export interface LargeTransactionDesk {
  submit(request: LargeTransactionRequest): Promise<{ reference: string; source: DataSource }>;
}

/* ---------- Courier ---------- */
export type CourierAvailability = { available: false; reason: string; source: DataSource };
export interface CourierProvider {
  checkAvailability(zip: string): Promise<CourierAvailability>;
}

export interface Services {
  mode: 'mock';
  pricing: PricingProvider;
  quotes: QuoteService;
  auth: AuthService;
  kyc: KycProvider;
  screening: ScreeningProvider;
  payouts: PayoutProvider;
  deposits: DepositMonitor;
  transactions: TransactionService;
  largeDesk: LargeTransactionDesk;
  courier: CourierProvider;
  simulator?: TransactionSimulator;
}
