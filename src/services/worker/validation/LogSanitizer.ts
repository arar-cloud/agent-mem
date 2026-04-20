/**
 * LogSanitizer
 *
 * Utility to redact sensitive data from logs
 * - Masks tokens, passwords, API keys
 * - Redacts PII (emails, phone numbers, SSNs)
 * - Prevents information disclosure in log files
 */

// Sensitive field names that should be masked in logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'apiKey',
  'secret',
  'privateKey',
  'apiSecret',
  'csrfToken',
  'authorization',
  'cookie',
  'email',
  'phone',
  'ssn',
  'creditCard',
  'jwt',
  'auth'
];

const MASK_VALUE = '[REDACTED]';

/**
 * Sanitize an object for logging by masking sensitive fields
 * Returns a deep copy with sensitive values redacted
 */
export function sanitizeForLog(data: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[CIRCULAR]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item, depth + 1));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      sanitized[key] = MASK_VALUE;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value, depth + 1);
    } else if (typeof value === 'string' && isSensitiveValue(value)) {
      sanitized[key] = MASK_VALUE;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(
    sensitive => lowerField.includes(sensitive) || lowerField.includes(sensitive.toLowerCase())
  );
}

/**
 * Check if a value looks like a sensitive value (token, hash, etc.)
 */
function isSensitiveValue(value: string): boolean {
  if (!value || value.length < 20) {
    return false;
  }

  // Check for JWT format (three base64 parts separated by dots)
  if (value.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
    return true;
  }

  // Check for hex-encoded secrets (long hex strings)
  if (value.match(/^[a-f0-9]{32,}$/i)) {
    return true;
  }

  // Check for base64-encoded data (long base64 strings)
  if (value.match(/^[A-Za-z0-9+/]{40,}={0,2}$/)) {
    return true;
  }

  return false;
}

/**
 * Sanitize error object for logging
 * Removes stack traces and sensitive details from error responses
 */
export function sanitizeError(error: any): Record<string, any> {
  if (!error) {
    return {};
  }

  // Extract safe error info
  const sanitized: Record<string, any> = {
    name: error.name || 'Error',
    message: maskSensitiveInfo(error.message || 'Unknown error')
  };

  // Don't expose stack trace to logs (only log error name and message)
  // In production, log full stack only to secure internal log system
  if (error.code) {
    sanitized.code = error.code;
  }

  if (error.status) {
    sanitized.status = error.status;
  }

  return sanitized;
}

/**
 * Remove sensitive information from error messages
 */
function maskSensitiveInfo(message: string): string {
  // Mask file paths that might reveal system structure
  message = message.replace(/\/home\/[^\s]+/g, '/home/[USER]');
  message = message.replace(/\/root\/[^\s]+/g, '/root/[PATH]');
  message = message.replace(/[A-Za-z]:\\/g, '[DRIVE]\\');

  // Mask tokens and API keys in error messages
  message = message.replace(/Bearer [A-Za-z0-9._-]+/g, 'Bearer [TOKEN]');
  message = message.replace(/api[_-]?key[=:][A-Za-z0-9._-]+/gi, 'api_key=[KEY]');

  return message;
}
