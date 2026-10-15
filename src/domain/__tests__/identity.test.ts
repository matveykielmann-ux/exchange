import { describe, expect, it } from 'vitest';
import { acceptedFileTypes, isKycEditable, missingKycFiles, requiredKycFiles } from '../identity';

describe('document verification rules', () => {
  it('needs both sides of a card ID and one page of a passport', () => {
    expect(requiredKycFiles('drivers_license')).toEqual(['id_front', 'id_back', 'selfie', 'proof_of_address']);
    expect(requiredKycFiles('state_id')).toContain('id_back');
    expect(requiredKycFiles('passport')).toEqual(['id_front', 'selfie', 'proof_of_address']);
  });

  it('lists what is still missing', () => {
    expect(missingKycFiles('passport', ['selfie'])).toEqual(['id_front', 'proof_of_address']);
    expect(missingKycFiles('state_id', ['id_front', 'id_back', 'selfie', 'proof_of_address'])).toEqual([]);
  });

  it('accepts only photos for the selfie', () => {
    expect(acceptedFileTypes('selfie')).not.toContain('application/pdf');
    expect(acceptedFileTypes('proof_of_address')).toContain('application/pdf');
  });

  it('lets the customer edit only before review or when more information is asked for', () => {
    expect(isKycEditable('draft')).toBe(true);
    expect(isKycEditable('needs_info')).toBe(true);
    expect(isKycEditable('submitted')).toBe(false);
    expect(isKycEditable('approved')).toBe(false);
    expect(isKycEditable('rejected')).toBe(false);
  });
});
