import { courierLabel, validateCourierDelivery, type CourierDeliveryInput } from '../courier';

const ok: CourierDeliveryInput = {
  phone: '(212) 555-0142',
  line1: '200 Example Street',
  line2: 'Apt 4B',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  window: 'morning',
  preferredDate: '2026-10-15',
  instructions: '',
};
const today = '2026-10-14';

describe('courier delivery details', () => {
  it('accepts a complete US address', () => {
    expect(validateCourierDelivery(ok, today)).toEqual({});
    expect(validateCourierDelivery({ ...ok, zip: '10001-1234', line2: '', preferredDate: '' }, today)).toEqual({});
  });

  it('refuses PO boxes, bad ZIP codes, unknown states and non-US phones', () => {
    expect(validateCourierDelivery({ ...ok, line1: 'P.O. Box 12' }, today).line1).toMatch(/PO box/);
    expect(validateCourierDelivery({ ...ok, zip: '1000' }, today).zip).toBeDefined();
    expect(validateCourierDelivery({ ...ok, state: 'XX' }, today).state).toBeDefined();
    expect(validateCourierDelivery({ ...ok, phone: '555-0142' }, today).phone).toBeDefined();
    expect(validateCourierDelivery({ ...ok, city: '' }, today).city).toBeDefined();
  });

  it('takes a preferred date from tomorrow up to 30 days ahead', () => {
    expect(validateCourierDelivery({ ...ok, preferredDate: today }, today).preferredDate).toMatch(/tomorrow/);
    expect(validateCourierDelivery({ ...ok, preferredDate: '2026-11-13' }, today).preferredDate).toBeUndefined();
    expect(validateCourierDelivery({ ...ok, preferredDate: '2026-11-14' }, today).preferredDate).toMatch(/30 days/);
    expect(validateCourierDelivery({ ...ok, preferredDate: 'soon' }, today).preferredDate).toBeDefined();
  });

  it('labels the destination with the area only, within 60 characters', () => {
    expect(courierLabel('New York', 'ny', '10001-1234')).toBe('Courier to New York, NY 10001');
    expect(courierLabel('A'.repeat(80), 'NY', '10001').length).toBe(60);
  });
});
