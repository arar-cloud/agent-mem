/**
 * ErrorHandler - Centralized error handling for Express
 *
 * Provides error handling middleware and utilities for the server.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../../utils/logger.js';

interface ErrorResponse {
  error: string;
  requestId?: string;
  status: number;
}

/**
 * Sanitize error for client response
 * Hides internal details and returns generic message
 */
export function formatErrorResponse(error: any, requestId?: string): ErrorResponse {
  // Log full error details server-side
  logger.error('Request error', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    requestId
  });

  // Determine HTTP status
  const status = error.status || error.statusCode || 500;

  // Return generic message to client based on status
  let clientMessage = 'An error occurred';

  switch (status) {
    case 400:
      clientMessage = 'Invalid request';
      break;
    case 401:
      clientMessage = 'Authentication required';
      break;
    case 403:
      clientMessage = 'Access denied';
      break;
    case 404:
      clientMessage = 'Resource not found';
      break;
    case 409:
      clientMessage = 'Conflict';
      break;
    case 422:
      clientMessage = 'Validation failed';
      break;
    case 429:
      clientMessage = 'Too many requests';
      break;
    default:
      clientMessage = 'Server error';
  }

  const response: ErrorResponse = {
    error: clientMessage,
    status
  };

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
}



/**
 * Application error with additional context
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Create an error response object
 */
export function createErrorResponse(
  error: string,
  message: string,
  code?: string,
  details?: unknown
): ErrorResponse {
  const response: ErrorResponse = { error, message };
  if (code) response.code = code;
  if (details) response.details = details;
  return response;
}

/**
 * Global error handler middleware
 * Should be registered last in the middleware chain
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Log error
  logger.error('HTTP', `Error handling ${req.method} ${req.path}`, {
    statusCode,
    error: err.message,
    code: err instanceof AppError ? err.code : undefined
  }, err);

  // Build sanitized response
  const sanitizedResponse = formatErrorResponse(err, req.id);

  // Send response (don't call next, as we've handled the error)
  res.status(sanitizedResponse.status).json(sanitizedResponse);
};

/**
 * Not found handler - for routes that don't exist
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(createErrorResponse(
    'NotFound',
    `Cannot ${req.method} ${req.path}`
  ));
}

/**
 * Async wrapper to catch errors in async route handlers
 * Automatically passes errors to Express error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
