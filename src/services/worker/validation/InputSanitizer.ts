/**
 * InputSanitizer
 *
 * Comprehensive input validation and sanitization for API endpoints
 * - Schema-based validation
 * - Type checking and coercion
 * - Length limits enforcement
 * - Whitelist-based sanitization
 */

import { logger } from '../../../utils/logger.js';

export interface ValidationSchema {
  [field: string]: FieldValidator;
}

export interface FieldValidator {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedValues?: (string | number | boolean)[];
  custom?: (value: any) => boolean;
}

/**
 * Validate input object against schema
 * Throws error if validation fails
 */
export function validateInput(data: any, schema: ValidationSchema): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [field, validator] of Object.entries(schema)) {
    const value = data[field];

    // Check required fields
    if (validator.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`Required field missing: ${field}`);
    }

    if (value === undefined || value === null) {
      if (!validator.required) {
        sanitized[field] = null;
      }
      continue;
    }

    // Type validation
    if (validator.type !== 'array' && validator.type !== 'object') {
      const actualType = typeof value;
      if (actualType !== validator.type) {
        throw new ValidationError(
          `Invalid type for field '${field}': expected ${validator.type}, got ${actualType}`
        );
      }
    }

    // String-specific validation
    if (validator.type === 'string') {
      if (typeof value !== 'string') {
        throw new ValidationError(`Field '${field}' must be a string`);
      }

      const str = value.trim();

      if (validator.maxLength && str.length > validator.maxLength) {
        throw new ValidationError(
          `Field '${field}' exceeds maximum length of ${validator.maxLength}`
        );
      }

      if (validator.minLength && str.length < validator.minLength) {
        throw new ValidationError(
          `Field '${field}' is below minimum length of ${validator.minLength}`
        );
      }

      if (validator.pattern && !validator.pattern.test(str)) {
        throw new ValidationError(`Field '${field}' does not match required pattern`);
      }

      sanitized[field] = sanitizeString(str);
    }

    // Number-specific validation
    if (validator.type === 'number') {
      if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`Field '${field}' must be a valid number`);
      }
      sanitized[field] = value;
    }

    // Boolean validation
    if (validator.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new ValidationError(`Field '${field}' must be a boolean`);
      }
      sanitized[field] = value;
    }

    // Allowed values check
    if (validator.allowedValues && !validator.allowedValues.includes(sanitized[field])) {
      throw new ValidationError(
        `Field '${field}' has invalid value. Allowed: ${validator.allowedValues.join(', ')}`
      );
    }

    // Custom validation
    if (validator.custom && !validator.custom(sanitized[field])) {
      throw new ValidationError(`Field '${field}' failed custom validation`);
    }
  }

  return sanitized;
}

/**
 * Sanitize string input to prevent injection attacks
 * - Remove dangerous HTML/script tags
 * - Escape special characters
 * - Remove null bytes
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }

  // Remove null bytes
  let result = str.replace(/\0/g, '');

  // Escape HTML special characters
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Remove potentially dangerous protocols
  result = result.replace(/javascript:/gi, '').replace(/data:/gi, '');

  return result;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validate array length
 */
export function validateArrayLength(arr: any[], minLength: number, maxLength: number): void {
  if (!Array.isArray(arr)) {
    throw new ValidationError('Input must be an array');
  }

  if (arr.length < minLength) {
    throw new ValidationError(`Array length must be at least ${minLength}`);
  }

  if (arr.length > maxLength) {
    throw new ValidationError(`Array length cannot exceed ${maxLength}`);
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
