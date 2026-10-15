/**
 * Buy orders paid by bank wire (wire → crypto). Live bank details come from
 * CRM credential sets and are snapshotted onto each order. The DEMO helpers
 * below remain only for legacy rows that still carry placeholder deposit
 * markers; new orders never use them when a CRM set is available.
 */

/**
 * How long the quoted rate is held for the wire to arrive. Placeholder
 * [OWNER INPUT REQUIRED], like the cash collection window.
 */
export const WIRE_RECEIPT_WINDOW_MS = 72 * 3_600_000;

export interface WireInstructionLine {
  /** Field name, e.g. "Routing number (ABA)". */
  label: string;
  value: string;
  /** True for the values that only exist after launch; the UI marks them as placeholders. */
  placeholder: boolean;
}

/** Placeholder values are deliberately not account or routing numbers: they contain letters and say so. */
const PLACEHOLDER = (what: string) => `DEMO-${what}-NOT-ISSUED`;

/** Every placeholder starts with DEMO- and ends with -NOT-ISSUED; the server and UI refuse to show anything else. */
export function isPreviewWireValue(value: string): boolean {
  return value.startsWith('DEMO-') && value.endsWith('-NOT-ISSUED');
}

/**
 * The wire instructions shown for an order. Only the amount and the order
 * reference are real (they are ours); the bank fields are placeholders.
 */
export function wireInstructionsPreview(reference: string): WireInstructionLine[] {
  return [
    { label: 'Beneficiary', value: PLACEHOLDER('BENEFICIARY'), placeholder: true },
    { label: 'Bank', value: PLACEHOLDER('BANK'), placeholder: true },
    { label: 'Account number', value: PLACEHOLDER('ACCOUNT'), placeholder: true },
    { label: 'Routing number (ABA)', value: PLACEHOLDER('ROUTING'), placeholder: true },
    { label: 'Reference / memo', value: reference, placeholder: false },
  ];
}

/** The customer's own wire reference (optional): what their bank shows for the transfer. Format only. */
export function validateWireReference(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 64) return 'Use 64 characters or fewer.';
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._/#-]*$/.test(v)) return 'Use letters, digits, spaces and . _ / # - only.';
  return null;
}
