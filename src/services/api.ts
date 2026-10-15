/**
 * HTTP implementation of `Services`. Converts the server's decimal-string
 * amounts into bigint at the edge so the rest of the UI works in exact money
 * types, keeps the signed-in user in a small store, and shares one
 * server-sent events connection for live updates.
 */
import type { Quote } from '@/domain/quote';
import type { AdminApi, AdminOrderDetail, QueueItem, SandboxOutcome } from './adminTypes';
import { ApiError, createHttp, type Http } from './http';
import type {
  Destination,
  LiveEvent,
  LiveState,
  OrderSummary,
  OrderView,
  Page,
  PublicConfig,
  QuoteData,
  QuoteInput,
  KycState,
  ReferencePrice,
  Services,
  SessionStore,
  User,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any -- JSON from the server is narrowed by the converters below. */
type J = any;

const big = (v: J): bigint => BigInt(v as string);
const bigOrNull = (v: J): bigint | null => (v === null || v === undefined ? null : BigInt(v as string));

function toQuote(q: J): Quote {
  return {
    ...q,
    amountAtomic: big(q.amountAtomic),
    referencePriceMicros: big(q.referencePriceMicros),
    grossCents: big(q.grossCents),
    spreadCents: big(q.spreadCents),
    payoutFeeCents: big(q.payoutFeeCents),
    netCents: big(q.netCents),
    effectiveRateMicros: big(q.effectiveRateMicros),
  };
}

function toIssues(issues: J[]): QuoteData['issues'] {
  return issues.map((i) => {
    if (i.code === 'below_minimum') return { ...i, minimumCents: big(i.minimumCents), minimumAtomic: big(i.minimumAtomic) };
    return i;
  });
}

const toPrice = (p: J): ReferencePrice => ({ ...p, priceMicros: big(p.priceMicros) });
const toQuoteData = (d: J): QuoteData => ({ quote: toQuote(d.quote), issues: toIssues(d.issues), price: toPrice(d.price), firm: d.firm });

export function toOrder(o: J): OrderView {
  return {
    ...o,
    amountAtomic: big(o.amountAtomic),
    quote: {
      ...o.quote,
      referencePriceMicros: big(o.quote.referencePriceMicros),
      grossCents: big(o.quote.grossCents),
      spreadCents: big(o.quote.spreadCents),
      payoutFeeCents: big(o.quote.payoutFeeCents),
      netCents: big(o.quote.netCents),
    },
    deposit: { ...o.deposit, amountAtomic: bigOrNull(o.deposit.amountAtomic) },
  };
}

const toSummary = (o: J): OrderSummary => ({
  ...o,
  amountAtomic: big(o.amountAtomic),
  netCents: big(o.netCents),
  grossCents: big(o.grossCents),
});
const toQueueItem = (o: J): QueueItem => ({
  ...o,
  amountAtomic: big(o.amountAtomic),
  grossCents: big(o.grossCents),
  netCents: big(o.netCents),
});
const toPage = <T>(p: J, f: (x: J) => T): Page<T> => ({ ...p, items: (p.items as J[]).map(f) });
const toOutcome = (r: J): SandboxOutcome => ({ outcome: r.outcome ?? r.outcomes, order: toOrder(r.order) });

function toConfig(c: J): PublicConfig {
  return { ...c, policy: { ...c.policy, minimumCents: big(c.policy.minimumCents), largeDeskFromCents: big(c.policy.largeDeskFromCents) } };
}

function qs(params: Record<string, string | number | boolean | undefined | null | string[]>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    u.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

/* ---------- Session store ---------- */

function createSessionStore(http: Http) {
  let user: User | null = null;
  let mfa = false;
  const listeners = new Set<() => void>();
  const store: SessionStore & { set(u: User | null, csrf: string | null, mfaVerified?: boolean): void } = {
    current: () => user,
    mfaVerified: () => mfa,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(u, csrf, mfaVerified = false) {
      user = u;
      mfa = mfaVerified;
      http.setCsrf(csrf);
      listeners.forEach((l) => l());
    },
  };
  return store;
}

/* ---------- Live updates (SSE) ---------- */

function createLive(session: SessionStore) {
  let source: EventSource | null = null;
  let state: LiveState = 'offline';
  const handlers = new Set<(e: LiveEvent) => void>();
  const stateListeners = new Set<() => void>();
  const setState = (s: LiveState) => {
    if (state === s) return;
    state = s;
    stateListeners.forEach((l) => l());
  };
  const TYPES: LiveEvent['type'][] = ['order.updated', 'conversation.updated', 'message.created', 'notification.created'];

  function open() {
    if (source || typeof EventSource === 'undefined' || !session.current()) return;
    setState('connecting');
    const es = new EventSource('/api/events', { withCredentials: true });
    source = es;
    es.addEventListener('ready', () => setState('open'));
    es.onopen = () => setState('open');
    es.onerror = () => {
      // EventSource reconnects by itself (server sends retry: 3000); CLOSED means it gave up (e.g. signed out).
      setState(es.readyState === EventSource.CLOSED ? 'offline' : 'reconnecting');
      if (es.readyState === EventSource.CLOSED) {
        source = null;
        if (handlers.size && session.current()) window.setTimeout(open, 5000);
      }
    };
    for (const t of TYPES)
      es.addEventListener(t, (ev) => {
        let data: J = {};
        try {
          data = JSON.parse((ev as MessageEvent<string>).data);
        } catch {
          return;
        }
        handlers.forEach((h) => h({ type: t, data } as LiveEvent));
      });
  }
  function close() {
    source?.close();
    source = null;
    setState('offline');
  }
  session.subscribe(() => {
    if (!session.current()) close();
    else if (handlers.size) open();
  });
  return {
    subscribe(h: (e: LiveEvent) => void) {
      handlers.add(h);
      open();
      return () => {
        handlers.delete(h);
        if (!handlers.size) close();
      };
    },
    state: () => state,
    onState(l: () => void) {
      stateListeners.add(l);
      return () => stateListeners.delete(l);
    },
  };
}

/* ---------- Bootstrap ---------- */

export interface Bootstrapped {
  services: Services;
}

export async function createApiServices(base = ''): Promise<Services> {
  const http = createHttp(base);
  const config = toConfig(await http.get<J>('/api/config'));
  const session = createSessionStore(http);
  const s = await http.get<J>('/api/auth/session');
  session.set(s.user ?? null, s.csrfToken ?? null, s.mfaVerified ?? false);

  const refresh = async () => {
    const r = await http.get<J>('/api/auth/session');
    session.set(r.user ?? null, r.csrfToken ?? null, r.mfaVerified ?? false);
    return session.current();
  };
  http.onUnauthenticated(() => {
    if (session.current()) void refresh().catch(() => session.set(null, null));
  });

  const live = createLive(session);

  const admin: AdminApi = {
    overview: () => http.get('/api/admin/overview'),
    staff: async () => (await http.get<J>('/api/admin/staff')).staff,
    queue: async (q) =>
      toPage(
        await http.get<J>(
          `/api/admin/orders${qs({
            q: q.q,
            status: q.status,
            stage: q.stage,
            payoutMethod: q.payoutMethod,
            review: q.review === 'open' ? 'open' : undefined,
            assigned: q.assigned === 'any' ? undefined : q.assigned,
            overdue: q.overdue,
            attention: q.attention,
            sort: q.sort,
            dir: q.dir,
            page: q.page,
            pageSize: q.pageSize,
          })}`,
        ),
        toQueueItem,
      ),
    order: async (id) => {
      const d = await http.get<J>(`/api/admin/orders/${encodeURIComponent(id)}`);
      return { ...d, order: toOrder(d.order) } as AdminOrderDetail;
    },
    act: async (id, action, body) =>
      toOrder(
        await http.post<J>(`/api/admin/orders/${encodeURIComponent(id)}/${action === 'note' ? 'notes' : action.replace(/_/g, '-')}`, body),
      ),
    inbox: async (q) =>
      http.get(
        `/api/admin/conversations${qs({ status: q.status === 'all' ? undefined : q.status, q: q.q, assigned: q.assigned === 'any' ? undefined : q.assigned, unread: q.unread, page: q.page })}`,
      ),
    conversation: (id) => http.get(`/api/admin/conversations/${encodeURIComponent(id)}`),
    reply: (id, body, internal, clientMessageId) =>
      http.post(`/api/admin/conversations/${encodeURIComponent(id)}/messages`, { body, internal, clientMessageId }),
    setConversationStatus: (id, status) => http.post(`/api/admin/conversations/${encodeURIComponent(id)}/status`, { status }),
    assignConversation: (id, operatorId) => http.post(`/api/admin/conversations/${encodeURIComponent(id)}/assign`, { operatorId }),
    markConversationRead: (id) => http.post(`/api/admin/conversations/${encodeURIComponent(id)}/read`),
    users: (q) => http.get(`/api/admin/users${qs({ q: q.q, role: q.role, page: q.page })}`),
    changeRole: (id, role, reason) => http.post(`/api/admin/users/${encodeURIComponent(id)}/role`, { role, reason }),
    setUserStatus: (id, status, reason) => http.post(`/api/admin/users/${encodeURIComponent(id)}/status`, { status, reason }),
    audit: (q) => http.get(`/api/admin/audit${qs(q)}`),
    webhooks: (page) => http.get(`/api/admin/webhooks${qs({ page })}`),
    kyc: {
      queue: (q) => http.get(`/api/admin/kyc${qs({ status: q.status, page: q.page })}`),
      get: (id) => http.get(`/api/admin/kyc/${encodeURIComponent(id)}`),
      file: (id, fileId) => http.get(`/api/admin/kyc/${encodeURIComponent(id)}/files/${encodeURIComponent(fileId)}`),
      decide: (id, decision, reason) => http.post(`/api/admin/kyc/${encodeURIComponent(id)}/decision`, { decision, reason }),
    },
    system: () => http.get('/api/admin/system'),
    largeDesk: (page) => http.get(`/api/admin/large-desk${qs({ page })}`),
    credentials: {
      listWire: async () => (await http.get<J>('/api/admin/credentials/wire')).items,
      createWire: (input) => http.post('/api/admin/credentials/wire', input),
      updateWire: (id, input) => http.put(`/api/admin/credentials/wire/${encodeURIComponent(id)}`, input),
      setWireStatus: (id, status) => http.post(`/api/admin/credentials/wire/${encodeURIComponent(id)}/status`, { status }),
      setWireDefault: (id) => http.post(`/api/admin/credentials/wire/${encodeURIComponent(id)}/default`),
      listWallets: async () => (await http.get<J>('/api/admin/credentials/wallets')).items,
      walletsForPair: async (asset, network) =>
        (await http.get<J>(`/api/admin/credentials/wallets/for-pair${qs({ asset, network })}`)).items,
      createWallet: (input) => http.post('/api/admin/credentials/wallets', input),
      updateWallet: (id, input) => http.put(`/api/admin/credentials/wallets/${encodeURIComponent(id)}`, input),
      setWalletStatus: (id, status) => http.post(`/api/admin/credentials/wallets/${encodeURIComponent(id)}/status`, { status }),
      setWalletDefault: (id) => http.post(`/api/admin/credentials/wallets/${encodeURIComponent(id)}/default`),
      assignWire: async (orderId, wireSetId, opts) =>
        toOrder(
          await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/assign-wire-credentials`, {
            wireSetId,
            confirmReplace: opts?.confirmReplace,
            reason: opts?.reason,
          }),
        ),
      assignCustomWire: async (orderId, input) =>
        toOrder(await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/assign-custom-wire-credentials`, input)),
      assignWallet: async (orderId, walletId, opts) =>
        toOrder(
          await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/assign-wallet-credentials`, {
            walletId,
            confirmReplace: opts?.confirmReplace,
            reason: opts?.reason,
          }),
        ),
      issueWire: async (orderId, wireSetId) =>
        toOrder(await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/issue-wire-instructions`, { wireSetId })),
      reviewPaymentConfirmation: async (orderId, body) =>
        toOrder(await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/review-payment-confirmation`, body)),
      postVerificationMessage: async (orderId, body) =>
        toOrder(await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/verification-message`, body)),
      reviewRefundRequest: async (orderId, body) =>
        toOrder(await http.post(`/api/admin/orders/${encodeURIComponent(orderId)}/review-refund-request`, body)),
    },
    sandbox: {
      deposit: async (id, scenario) =>
        toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/deposit`, { scenario })),
      confirmations: async (id, toFinal) =>
        toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/confirmations`, { toFinal })),
      payout: async (id, outcome, reason) =>
        toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/payout`, { outcome, reason })),
      refundComplete: async (id) => toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/refund-complete`)),
      replay: async (id) => toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/replay`)),
      expire: async (id) => toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/expire`)),
      wireInstructions: async (id) => toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/wire-instructions`)),
      wireReceived: async (id) => toOutcome(await http.post(`/api/admin/sandbox/orders/${encodeURIComponent(id)}/wire-received`)),
      notifications: async () => (await http.get<J>('/api/admin/sandbox/notifications')).notifications,
    },
  };

  const services: Services = {
    config,
    session,
    auth: {
      async signUp(input) {
        const r = await http.post<J>('/api/auth/signup', input);
        session.set(r.user, r.csrfToken, false);
        return r.user;
      },
      async signIn(input) {
        const r = await http.post<J>('/api/auth/signin', input);
        if (r.mfaRequired) return { mfaRequired: true, challengeId: r.challengeId };
        session.set(r.user, r.csrfToken, false);
        return { mfaRequired: false, user: r.user };
      },
      async verifyMfa(input) {
        const r = await http.post<J>('/api/auth/mfa', input);
        session.set(r.user, r.csrfToken, true);
        return r.user;
      },
      async signOut() {
        try {
          await http.post('/api/auth/signout');
        } finally {
          session.set(null, null);
        }
      },
      requestPasswordReset: (email) => http.post('/api/auth/password-reset', { email }),
      confirmPasswordReset: (token, password) => http.post('/api/auth/password-reset/confirm', { token, password }),
      async changePassword(currentPassword, newPassword) {
        await http.post('/api/auth/password', { currentPassword, newPassword });
        // Other sessions were revoked; this one keeps working.
      },
      beginTotp: () => http.post('/api/auth/totp/setup'),
      async confirmTotp(code) {
        await http.post('/api/auth/totp/confirm', { code });
        await refresh();
      },
      async disableTotp(code) {
        await http.post('/api/auth/totp/disable', { code });
        await refresh();
      },
      sessions: async () => (await http.get<J>('/api/auth/sessions')).sessions,
      revokeOtherSessions: async () => (await http.post<J>('/api/auth/sessions/revoke-others')).revoked,
      refresh,
    },
    pricing: { prices: async () => ((await http.get<J>('/api/prices')).prices as J[]).map(toPrice) },
    quotes: {
      indicative: async (i: QuoteInput) =>
        toQuoteData(
          await http.get(
            `/api/quotes/indicative${
              i.direction === 'buy'
                ? qs({
                    direction: 'buy',
                    asset: i.asset,
                    network: i.network,
                    cashCents: i.cashCents.toString(),
                    payIn: i.payIn ?? 'courier_cash',
                  })
                : qs({ asset: i.asset, network: i.network, amountAtomic: i.amountAtomic.toString(), payoutMethod: i.payoutMethod })
            }`,
          ),
        ),
      firm: async (i: QuoteInput) => toQuoteData(await http.post('/api/quotes', i)),
    },
    account: {
      profile: () => http.get('/api/me'),
      async updateProfile(patch) {
        const u = await http.put<User>('/api/me/profile', patch);
        await refresh();
        return u;
      },
      async startVerification() {
        const r = await http.post<J>('/api/me/verification');
        await refresh();
        return r;
      },
      kyc: {
        // Each read also refreshes the session, so a reviewer's decision reaches the exchange gate.
        async get() {
          const r = await http.get<KycState>('/api/me/kyc');
          if (r.status !== session.current()?.verification.status) await refresh();
          return r;
        },
        setIdType: (idType) => http.put('/api/me/kyc/id-type', { idType }),
        upload: (file) => http.post('/api/me/kyc/files', file),
        file: (id) => http.get(`/api/me/kyc/files/${encodeURIComponent(id)}`),
        async submit() {
          const r = await http.post<KycState>('/api/me/kyc/submit');
          await refresh();
          return r;
        },
      },
      destinations: async () => (await http.get<{ destinations: Destination[] }>('/api/me/destinations')).destinations,
      addBankAccount: (input) => http.post('/api/me/destinations/bank', input),
      addCard: (label) => http.post('/api/me/destinations/card', { label }),
      addCourierAddress: (input) => http.post('/api/me/destinations/courier', input),
      removeDestination: (id) => http.delete(`/api/me/destinations/${encodeURIComponent(id)}`),
      notifications: () => http.get('/api/me/notifications'),
      markNotificationsRead: async (ids) => (await http.post<J>('/api/me/notifications/read', ids ? { ids } : {})).unread,
      acceptances: async () => (await http.get<J>('/api/me/legal')).acceptances,
    },
    orders: {
      create: async (input, key) => toOrder(await http.post('/api/orders', input, { idempotencyKey: key })),
      list: async (page = 1) => toPage(await http.get<J>(`/api/orders${qs({ page })}`), toSummary),
      get: async (id) => toOrder(await http.get(`/api/orders/${encodeURIComponent(id)}`)),
      cancel: async (id) => toOrder(await http.post(`/api/orders/${encodeURIComponent(id)}/cancel`)),
      reportSent: async (id, txHash) => toOrder(await http.post(`/api/orders/${encodeURIComponent(id)}/report-sent`, { txHash })),
      acceptCourierFee: async (id) => toOrder(await http.post(`/api/orders/${encodeURIComponent(id)}/accept-courier-fee`)),
      setRefundAddress: async (id, refundAddress) =>
        toOrder(await http.post(`/api/orders/${encodeURIComponent(id)}/refund-address`, { refundAddress })),
      uploadDocument: async (id, file) => (await http.post<J>(`/api/orders/${encodeURIComponent(id)}/documents`, file)).documents,
      submitPaymentConfirmation: async (id, input) => {
        const res = await http.post<J>(`/api/orders/${encodeURIComponent(id)}/payment-confirmation`, input);
        return { confirmations: res.confirmations, order: toOrder(res.order) };
      },
      requestRefund: async (id, input) => (await http.post<J>(`/api/orders/${encodeURIComponent(id)}/refund-request`, input)).request,
    },
    support: {
      list: async () => (await http.get<J>('/api/support/conversations')).conversations,
      create: (input) => http.post('/api/support/conversations', input),
      get: (id) => http.get(`/api/support/conversations/${encodeURIComponent(id)}`),
      send: (id, body, clientMessageId) =>
        http.post(`/api/support/conversations/${encodeURIComponent(id)}/messages`, { body, clientMessageId }),
      markRead: (id) => http.post(`/api/support/conversations/${encodeURIComponent(id)}/read`),
    },
    live,
    largeDesk: { submit: (r) => http.post('/api/large-desk', r) },
    cash: { availability: (zip) => http.get(`/api/cash/availability${qs({ zip })}`) },
    admin,
  };
  return services;
}

export { ApiError };
