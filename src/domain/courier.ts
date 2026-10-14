/**
 * Cash delivery by courier: the delivery details a customer gives us and the
 * rules they must meet. Shared by the exchange form and the server, which
 * re-validates everything. Cash is released only to the verified account
 * holder after an ID check at the door, so the recipient is never typed in.
 */
import { US_STATE_NAMES, type UsStateCode } from './usStates';
import { validateUsPhone } from './validation';

export const COURIER_WINDOWS = ['morning', 'afternoon', 'evening', 'any'] as const;
export type CourierWindow = (typeof COURIER_WINDOWS)[number];

export const COURIER_WINDOW_LABELS: Record<CourierWindow, string> = {
  morning: 'Morning, 9 am to 12 pm',
  afternoon: 'Afternoon, 12 pm to 5 pm',
  evening: 'Evening, 5 pm to 8 pm',
  any: 'Any time, 9 am to 8 pm',
};

/** How far ahead a preferred delivery date may be. */
export const COURIER_MAX_DAYS_AHEAD = 30;

export interface CourierDeliveryInput {
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  window: CourierWindow;
  /** YYYY-MM-DD, or empty for the first available day. */
  preferredDate: string;
  instructions: string;
}

export type CourierField = keyof CourierDeliveryInput;
export type CourierErrors = Partial<Record<CourierField, string>>;

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Trims every field and normalizes the ZIP and state; does not validate. */
export function normalizeCourierInput(input: CourierDeliveryInput): CourierDeliveryInput {
  return {
    phone: input.phone.trim(),
    line1: input.line1.trim().replace(/\s+/g, ' '),
    line2: input.line2.trim().replace(/\s+/g, ' '),
    city: input.city.trim().replace(/\s+/g, ' '),
    state: input.state.trim().toUpperCase(),
    zip: input.zip.trim(),
    window: input.window,
    preferredDate: input.preferredDate.trim(),
    instructions: input.instructions.trim(),
  };
}

/**
 * Validates delivery details. `today` is the current date as YYYY-MM-DD
 * (UTC); a preferred date must be tomorrow or later and within
 * COURIER_MAX_DAYS_AHEAD days.
 */
export function validateCourierDelivery(raw: CourierDeliveryInput, today: string): CourierErrors {
  const input = normalizeCourierInput(raw);
  const errors: CourierErrors = {};
  const phone = validateUsPhone(input.phone);
  if (phone) errors.phone = phone;
  if (input.line1.length < 3) errors.line1 = 'Enter the street address.';
  else if (input.line1.length > 100) errors.line1 = 'Use 100 characters or fewer.';
  else if (PO_BOX.test(input.line1) || PO_BOX.test(input.line2))
    errors.line1 = 'A courier can’t deliver to a PO box. Enter a street address.';
  if (input.line2.length > 60) errors.line2 = 'Use 60 characters or fewer.';
  if (!input.city) errors.city = 'Enter the city.';
  else if (input.city.length > 40 || !/^[\p{L}][\p{L} .'-]*$/u.test(input.city)) errors.city = 'Enter a valid city name.';
  if (!(input.state in US_STATE_NAMES)) errors.state = 'Choose a state.';
  if (!/^\d{5}(-\d{4})?$/.test(input.zip)) errors.zip = 'Enter a 5-digit ZIP code, or ZIP+4.';
  if (!(COURIER_WINDOWS as readonly string[]).includes(input.window)) errors.window = 'Choose a delivery window.';
  if (input.preferredDate) {
    const day = ISO_DATE.test(input.preferredDate) ? dayNumber(input.preferredDate) : NaN;
    const now = dayNumber(today);
    if (!Number.isFinite(day)) errors.preferredDate = 'Enter a date.';
    else if (day <= now) errors.preferredDate = 'Choose tomorrow or a later date.';
    else if (day > now + COURIER_MAX_DAYS_AHEAD) errors.preferredDate = `Choose a date within the next ${COURIER_MAX_DAYS_AHEAD} days.`;
  }
  if (input.instructions.length > 200) errors.instructions = 'Use 200 characters or fewer.';
  return errors;
}

export const zip5 = (zip: string) => zip.trim().slice(0, 5);

/** The saved destination's label, e.g. "Courier to Austin, TX 78701". At most 60 characters. */
export function courierLabel(city: string, state: string, zip: string): string {
  return `Courier to ${city.trim()}, ${state.trim().toUpperCase()} ${zip5(zip)}`.slice(0, 60);
}

export const stateName = (code: string) => US_STATE_NAMES[code as UsStateCode] ?? code;

/** YYYY-MM-DD for a timestamp, in UTC. */
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
