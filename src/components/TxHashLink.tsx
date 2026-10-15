import type { NetworkId } from '@/domain/assets';
import { explorerTxUrl } from '@/domain/explorer';
import { t } from '@/i18n';

/**
 * Renders a blockchain TXID. When the hash matches the network format and a
 * verified explorer exists, links out safely (new tab, noopener). Otherwise
 * shows plain text. An explorer link does not confirm exchange completion.
 */
export function TxHashLink({
  txHash,
  network,
  className = 'mono',
}: {
  txHash: string | null | undefined;
  network: NetworkId;
  className?: string;
}) {
  if (!txHash?.trim()) return null;
  const hash = txHash.trim();
  const href = explorerTxUrl(hash, network);
  if (!href) {
    return <span className={`${className} break`}>{hash}</span>;
  }
  return (
    <a
      className={`${className} break`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t('View on blockchain explorer')}
    >
      {hash}
    </a>
  );
}
