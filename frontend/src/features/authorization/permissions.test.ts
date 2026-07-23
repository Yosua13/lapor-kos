import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasCapability } from './permissions';

describe('property membership capabilities', () => {
  it('gives owners full property access', () => {
    expect(hasCapability('property_owner', CAPABILITIES.MEMBERSHIP_MANAGE)).toBe(true);
    expect(hasCapability('property_owner', CAPABILITIES.REPORT_EXPORT)).toBe(true);
  });

  it('keeps finance access focused on payments and reports', () => {
    expect(hasCapability('finance', CAPABILITIES.PAYMENT_VERIFY)).toBe(true);
    expect(hasCapability('finance', CAPABILITIES.REPORT_EXPORT)).toBe(true);
    expect(hasCapability('finance', CAPABILITIES.ROOM_WRITE)).toBe(false);
  });

  it('keeps maintenance access focused on complaints', () => {
    expect(hasCapability('maintenance', CAPABILITIES.COMPLAINT_MANAGE)).toBe(true);
    expect(hasCapability('maintenance', CAPABILITIES.PAYMENT_WRITE)).toBe(false);
  });

  it('makes viewers read only', () => {
    expect(hasCapability('viewer', CAPABILITIES.ROOM_READ)).toBe(true);
    expect(hasCapability('viewer', CAPABILITIES.ROOM_WRITE)).toBe(false);
    expect(hasCapability('viewer', CAPABILITIES.COMPLAINT_MANAGE)).toBe(false);
  });

  it('accepts an explicit backend permission without weakening the role defaults', () => {
    expect(hasCapability('viewer', CAPABILITIES.RULE_WRITE, [CAPABILITIES.RULE_WRITE])).toBe(true);
    expect(hasCapability('manager', CAPABILITIES.ROOM_WRITE, [])).toBe(true);
  });
});
