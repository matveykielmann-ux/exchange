import { ASSET_ORDER, ASSETS, NETWORKS, isAssetCode, networkLabel, type AssetCode, type NetworkId } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import type { QuoteIssue } from '@/domain/quote';
import { validateCryptoAmount } from '@/domain/validation';
import { formatAsset } from '@/lib/format';
import { ChoiceSelect } from './ChoiceSelect';
import { Field } from './Field';
import { Notice } from './ui';

export function AssetNetworkFields({
  asset,
  network,
  onAsset,
  onNetwork,
  idPrefix,
}: {
  asset: AssetCode;
  network: NetworkId;
  onAsset: (a: AssetCode) => void;
  onNetwork: (n: NetworkId) => void;
  idPrefix: string;
}) {
  const networks = ASSETS[asset].networks;
  return (
    <div className="form-grid">
      <Field label="Asset" id={`${idPrefix}-asset`}>
        {(p) => (
          <ChoiceSelect
            field={p}
            value={asset}
            onChange={(v) => {
              if (isAssetCode(v)) onAsset(v);
            }}
            choices={ASSET_ORDER.map((code) => ({
              value: code,
              label: (
                <>
                  <span className="asset-mark" aria-hidden="true">
                    {code.slice(0, 1)}
                  </span>
                  {code} · {ASSETS[code].name}
                </>
              ),
              detail: `${ASSETS[code].networks.length} network${ASSETS[code].networks.length > 1 ? 's' : ''}`,
            }))}
          />
        )}
      </Field>
      <Field
        label="Network"
        id={`${idPrefix}-network`}
        hint={
          networks.length > 1
            ? 'Must match the network your wallet sends on.'
            : `${asset} is accepted on the ${NETWORKS[network].name} network only.`
        }
      >
        {(p) =>
          networks.length > 1 ? (
            <ChoiceSelect
              field={p}
              value={network}
              onChange={onNetwork}
              choices={networks.map((n) => ({
                value: n.network,
                label: networkLabel(asset, n.network),
                detail: `${NETWORKS[n.network].confirmationsRequired} confirmations required`,
              }))}
            />
          ) : (
            <input className="input" {...p} value={networkLabel(asset, network)} readOnly />
          )
        }
      </Field>
    </div>
  );
}

export function AmountField({
  asset,
  value,
  onChange,
  touched,
  onBlur,
  id,
}: {
  asset: AssetCode;
  value: string;
  onChange: (v: string) => void;
  touched: boolean;
  onBlur: () => void;
  id: string;
}) {
  const error = touched ? validateCryptoAmount(value, asset) : null;
  return (
    <Field label="Amount to sell" id={id} error={error}>
      {(p) => (
        <div className="amount-input" data-invalid={error ? 'true' : undefined}>
          <input
            {...p}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
            onBlur={onBlur}
          />
          <span className="amount-input__code" aria-hidden="true">
            {asset}
          </span>
        </div>
      )}
    </Field>
  );
}

export function QuoteIssues({ issues, asset }: { issues: QuoteIssue[]; asset: AssetCode }) {
  if (!issues.length) return null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {issues.map((issue) => {
        switch (issue.code) {
          case 'below_minimum':
            return (
              <Notice key={issue.code} tone="warn" title={`Minimum is ${formatUsd(issue.minimumCents)}`}>
                <p>That is about {formatAsset(issue.minimumAtomic, asset)} at the current mock price.</p>
              </Notice>
            );
          case 'payout_ineligible':
            return (
              <Notice key={issue.code} tone="warn" title="Payout method not available for this amount">
                <p>{issue.reason}. Choose a different payout method.</p>
              </Notice>
            );
          case 'non_positive_payout':
            return <Notice key={issue.code} tone="warn" title="Fees would exceed the value of this amount." />;
          case 'unsupported_network':
            return <Notice key={issue.code} tone="danger" title="That network isn't supported for this asset." />;
          case 'zero_amount':
            return null;
        }
      })}
    </div>
  );
}
