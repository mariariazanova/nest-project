const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'resettoken',
  'secret',
  'apikey',
  'privatekey',
  'authorization',
]);

const MAX_DEPTH = 6;

export function maskSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveFields(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? '[REDACTED]'
      : maskSensitiveFields(val, depth + 1);
  }
  return result;
}
