/**
 * Mock payout destinations. Bank details are validated (including the ABA
 * routing checksum) and then reduced to the last four digits before storage.
 * Card numbers are never collected: card payouts need a PCI DSS-compliant
 * tokenization provider, so the preview offers a simulated card only.
 */
import { validateAccountNumber, validateRoutingNumber } from '@/domain/validation';
import { readStore, writeStore } from '@/lib/storage';
import type { PayoutDestinationRecord, PayoutProvider } from '../types';
import { delay, mockId, MockServiceError, type MockOptions } from './util';

type Table = Record<string, PayoutDestinationRecord[]>;
const KEY = 'payout-destinations';

export function createMockPayouts(opts: MockOptions): PayoutProvider {
  const table = () => readStore<Table>(KEY, {});
  const save = (email: string, list: PayoutDestinationRecord[]) => writeStore(KEY, { ...table(), [email]: list });

  return {
    listDestinations(email) {
      return delay(opts, () => table()[email] ?? []);
    },
    addBankAccount(email, { nickname, routingNumber, accountNumber }) {
      return delay(opts, () => {
        const err = validateRoutingNumber(routingNumber) ?? validateAccountNumber(accountNumber);
        if (err) throw new MockServiceError(err, 'invalid_input');
        const digits = accountNumber.replace(/\s/g, '');
        const record: PayoutDestinationRecord = {
          id: `dest_${mockId(opts)}`,
          kind: 'bank',
          label: nickname.trim() || 'Bank account',
          last4: digits.slice(-4),
          methods: ['ach', 'wire'],
          source: 'mock',
        };
        save(email, [...(table()[email] ?? []), record]);
        return record;
      });
    },
    addSimulatedCard(email) {
      return delay(opts, () => {
        const existing = table()[email] ?? [];
        const found = existing.find((d) => d.kind === 'card');
        if (found) return found;
        const record: PayoutDestinationRecord = {
          id: `dest_${mockId(opts)}`,
          kind: 'card',
          label: 'Simulated debit card',
          last4: '0000',
          methods: ['instant_debit'],
          source: 'mock',
        };
        save(email, [...existing, record]);
        return record;
      });
    },
    removeDestination(email, id) {
      return delay(opts, () => {
        save(
          email,
          (table()[email] ?? []).filter((d) => d.id !== id),
        );
      });
    },
  };
}
