/**
 * Mock blockchain monitor. Deposit "addresses" are intentionally INVALID for
 * every chain (prefix MOCK-, suffix -DO-NOT-SEND, contain characters outside
 * the chain alphabets) so funds cannot be sent to them by mistake.
 */
import type { AssetCode, NetworkId } from '@/domain/assets';
import type { Transaction, TransactionEvent } from '@/domain/transaction';
import type { DepositMonitor, TransactionSimulator } from '../types';
import { mockId, type MockOptions } from './util';

export function createMockDeposits(opts: MockOptions): DepositMonitor {
  return {
    createDepositAddress(asset: AssetCode, network: NetworkId) {
      return `MOCK-${asset}-${network.toUpperCase()}-${mockId(opts, 10)}-DO-NOT-SEND`;
    },
  };
}

export function createMockSimulator(opts: MockOptions): TransactionSimulator {
  return {
    nextEvent(tx: Transaction): TransactionEvent | null {
      const step = Math.max(1, Math.ceil(tx.confirmations.required / 3));
      switch (tx.status) {
        case 'awaiting_deposit':
          return { type: 'DEPOSIT_DETECTED', txHash: `mock_tx_${mockId(opts, 16).toLowerCase()}`, amountAtomic: tx.quote.amountAtomic };
        case 'deposit_detected':
        case 'confirming':
          return { type: 'CONFIRMATION', count: tx.confirmations.count + step };
        case 'compliance_review':
          return { type: 'REVIEW_CLEARED' };
        case 'payout_processing':
          return { type: 'PAYOUT_SETTLED', reference: `MOCK-PAYOUT-${mockId(opts, 8)}` };
        case 'payout_failed':
          return { type: 'RETRY_PAYOUT' };
        case 'refund_pending':
          return { type: 'REFUND_SENT', txHash: `mock_refund_${mockId(opts, 12).toLowerCase()}` };
        default:
          return null;
      }
    },
  };
}
