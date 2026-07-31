import { maskSensitiveFields } from './mask-sensitive-fields';

describe('maskSensitiveFields', () => {
  it('returns primitive string unchanged', () => {
    expect(maskSensitiveFields('hello')).toBe('hello');
  });

  it('returns primitive number unchanged', () => {
    expect(maskSensitiveFields(42)).toBe(42);
  });

  it('returns primitive boolean unchanged', () => {
    expect(maskSensitiveFields(true)).toBe(true);
  });

  it('returns null unchanged', () => {
    expect(maskSensitiveFields(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(maskSensitiveFields(undefined)).toBeUndefined();
  });

  it('redacts top-level sensitive key', () => {
    const result = maskSensitiveFields({ password: 'secret123' });
    expect(result).toEqual({ password: '[REDACTED]' });
  });

  it('does not redact non-sensitive key', () => {
    const result = maskSensitiveFields({
      username: 'alice',
      email: 'alice@example.com',
    });
    expect(result).toEqual({ username: 'alice', email: 'alice@example.com' });
  });

  it('redacts sensitive key while preserving non-sensitive sibling keys', () => {
    const result = maskSensitiveFields({
      username: 'alice',
      password: 'secret',
    });
    expect(result).toEqual({ username: 'alice', password: '[REDACTED]' });
  });

  it('redacts nested sensitive key', () => {
    const result = maskSensitiveFields({ user: { id: '1', token: 'abc' } });
    expect(result).toEqual({ user: { id: '1', token: '[REDACTED]' } });
  });

  it('traverses arrays of objects', () => {
    const result = maskSensitiveFields([
      { password: 'x' },
      { username: 'bob' },
    ]);
    expect(result).toEqual([{ password: '[REDACTED]' }, { username: 'bob' }]);
  });

  it('is case-insensitive: PASSWORD', () => {
    const result = maskSensitiveFields({ PASSWORD: 'x' });
    expect(result).toEqual({ PASSWORD: '[REDACTED]' });
  });

  it('is case-insensitive: accessToken', () => {
    const result = maskSensitiveFields({ accessToken: 'tok' });
    expect(result).toEqual({ accessToken: '[REDACTED]' });
  });

  it('is case-insensitive: Authorization', () => {
    const result = maskSensitiveFields({ Authorization: 'Bearer xyz' });
    expect(result).toEqual({ Authorization: '[REDACTED]' });
  });

  it('does not mutate the original input', () => {
    const input = { username: 'alice', password: 'secret' };
    maskSensitiveFields(input);
    expect(input.password).toBe('secret');
  });

  it('handles empty object', () => {
    expect(maskSensitiveFields({})).toEqual({});
  });

  it('handles deeply nested objects without throwing', () => {
    const deep = { a: { b: { c: { d: { e: { f: { password: 'x' } } } } } } };
    expect(() => maskSensitiveFields(deep)).not.toThrow();
  });

  it('redacts all known sensitive keys', () => {
    const payload = {
      password: '1',
      confirmPassword: '2',
      newPassword: '3',
      oldPassword: '4',
      token: '5',
      accessToken: '6',
      refreshToken: '7',
      idToken: '8',
      resetToken: '9',
      secret: '10',
      apiKey: '11',
      privateKey: '12',
      authorization: '13',
    };
    const result = maskSensitiveFields(payload) as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });
});
