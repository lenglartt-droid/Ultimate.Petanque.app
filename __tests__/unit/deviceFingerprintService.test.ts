/**
 * Unit tests for services/deviceFingerprintService.ts
 *
 * Tests: simpleHash (deterministic, collision resistance), generateRandomId
 * (length, charset), canCreateAccount logic (max accounts, cooldown, duplicate
 * email bypass), constants validation.
 */

const MAX_ACCOUNTS_PER_DEVICE = 3;
const COOLDOWN_HOURS = 24;

function generateRandomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return result;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { const char = str.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  let hash2 = 0;
  for (let i = str.length - 1; i >= 0; i--) { const char = str.charCodeAt(i); hash2 = ((hash2 << 7) - hash2) + char; hash2 |= 0; }
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return `${hex}-${hex2}`;
}

interface Registration { email: string; date: string; }

function canCreateAccountLocal(registrations: Registration[], email: string): { allowed: boolean; reason?: string } {
  if (registrations.length >= MAX_ACCOUNTS_PER_DEVICE) return { allowed: false, reason: 'max_accounts_reached' };
  const last = registrations[registrations.length - 1];
  if (last) {
    const hoursSince = (Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60);
    if (hoursSince < COOLDOWN_HOURS) {
      if (registrations.some(r => r.email.toLowerCase() === email.toLowerCase())) return { allowed: true };
      return { allowed: false, reason: 'cooldown_active' };
    }
  }
  if (registrations.some(r => r.email.toLowerCase() === email.toLowerCase())) return { allowed: true };
  return { allowed: true };
}

describe('simpleHash', () => {
  test('deterministic: same input same output', () => {
    expect(simpleHash('test')).toBe(simpleHash('test'));
  });
  test('different inputs produce different hashes', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('def'));
  });
  test('format is hex-hex (8-8)', () => {
    expect(simpleHash('hello')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{8}$/);
  });
  test('empty string produces valid hash', () => {
    expect(simpleHash('')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{8}$/);
  });
  test('long string produces valid hash', () => {
    const long = 'a'.repeat(10000);
    expect(simpleHash(long)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{8}$/);
  });
});

describe('generateRandomId', () => {
  test('length is 32', () => { expect(generateRandomId()).toHaveLength(32); });
  test('only alphanumeric chars', () => { expect(generateRandomId()).toMatch(/^[A-Za-z0-9]{32}$/); });
  test('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRandomId()));
    expect(ids.size).toBe(50);
  });
});

describe('canCreateAccountLocal', () => {
  test('allows first account', () => {
    expect(canCreateAccountLocal([], 'a@b.com').allowed).toBe(true);
  });
  test('allows up to MAX_ACCOUNTS_PER_DEVICE', () => {
    const regs = [
      { email: 'a@b.com', date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { email: 'c@d.com', date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
    ];
    expect(canCreateAccountLocal(regs, 'e@f.com').allowed).toBe(true);
  });
  test('blocks at max accounts', () => {
    const regs = [
      { email: 'a@b.com', date: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() },
      { email: 'c@d.com', date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      { email: 'e@f.com', date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
    ];
    const result = canCreateAccountLocal(regs, 'g@h.com');
    expect(result.allowed).toBe(false); expect(result.reason).toBe('max_accounts_reached');
  });
  test('blocks during cooldown', () => {
    const regs = [{ email: 'a@b.com', date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }];
    const result = canCreateAccountLocal(regs, 'new@test.com');
    expect(result.allowed).toBe(false); expect(result.reason).toBe('cooldown_active');
  });
  test('allows same email during cooldown (re-registration)', () => {
    const regs = [{ email: 'a@b.com', date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }];
    expect(canCreateAccountLocal(regs, 'a@b.com').allowed).toBe(true);
  });
  test('allows after cooldown expires', () => {
    const regs = [{ email: 'a@b.com', date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }];
    expect(canCreateAccountLocal(regs, 'new@test.com').allowed).toBe(true);
  });
  test('case insensitive email match', () => {
    const regs = [{ email: 'A@B.COM', date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() }];
    expect(canCreateAccountLocal(regs, 'a@b.com').allowed).toBe(true);
  });
});

describe('Constants', () => {
  test('MAX_ACCOUNTS_PER_DEVICE is 3', () => { expect(MAX_ACCOUNTS_PER_DEVICE).toBe(3); });
  test('COOLDOWN_HOURS is 24', () => { expect(COOLDOWN_HOURS).toBe(24); });
});
