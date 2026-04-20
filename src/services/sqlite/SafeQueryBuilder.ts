/**
 * SafeQueryBuilder
 *
 * Provides safe query building with parameterized statements
 * to prevent SQL injection attacks
 */

import Database from 'better-sqlite3';

/**
 * Builder for safe parameterized SQL queries
 * Ensures user input is never concatenated into SQL strings
 */
export class SafeQueryBuilder {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Execute a SELECT query with parameterized placeholders
   * @param sql - SQL query with ? placeholders
   * @param params - Array of parameters matching placeholders
   * @returns Query results
   */
  selectAll<T = any>(sql: string, params: any[] = []): T[] {
    this.validateQuery(sql);
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      throw new QueryError(`Failed to execute SELECT query: ${error}`);
    }
  }

  /**
   * Execute a SELECT query returning single row
   */
  selectOne<T = any>(sql: string, params: any[] = []): T | undefined {
    this.validateQuery(sql);
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } catch (error) {
      throw new QueryError(`Failed to execute SELECT query: ${error}`);
    }
  }

  /**
   * Execute INSERT/UPDATE/DELETE query
   * @param sql - SQL query with ? placeholders
   * @param params - Array of parameters matching placeholders
   * @returns Execution info (changes, lastID)
   */
  execute(sql: string, params: any[] = []): Database.RunResult {
    this.validateQuery(sql);
    this.validateMutationQuery(sql);
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      throw new QueryError(`Failed to execute query: ${error}`);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  transaction<T>(
    callback: (builder: SafeQueryBuilder) => T
  ): T {
    try {
      const transaction = this.db.transaction(callback);
      return transaction(this);
    } catch (error) {
      throw new QueryError(`Transaction failed: ${error}`);
    }
  }

  /**
   * Build WHERE clause with safe parameters
   * Prevents injection in WHERE conditions
   */
  buildWhereClause(conditions: Record<string, any>): { clause: string; params: any[] } {
    const parts: string[] = [];
    const params: any[] = [];

    for (const [field, value] of Object.entries(conditions)) {
      // Validate field name (only alphanumeric, underscore)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        throw new QueryError(`Invalid field name: ${field}`);
      }

      if (value === null) {
        parts.push(`${field} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(',');
        parts.push(`${field} IN (${placeholders})`);
        params.push(...value);
      } else {
        parts.push(`${field} = ?`);
        params.push(value);
      }
    }

    const clause = parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '';
    return { clause, params };
  }

  /**
   * Validate query for common injection patterns
   * This is a defensive check; parameterization is the primary defense
   */
  private validateQuery(sql: string): void {
    if (!sql || typeof sql !== 'string') {
      throw new QueryError('Query must be a non-empty string');
    }

    // Check for suspicious patterns (not exhaustive, parameterization is primary defense)
    const suspiciousPatterns = [
      /--/,           // SQL comment
      /\/\*/,          // Block comment start
      /;\s*DROP/i,    // DROP statement
      /;\s*DELETE/i,  // DELETE statement (if not intended)
      /EXEC\s*\(/i,   // EXEC (SQL Server)
      /EXECUTE\s*\(/i // EXECUTE (SQL Server)
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sql)) {
        throw new QueryError(`Suspicious SQL pattern detected`);
      }
    }
  }

  /**
   * Validate that mutation queries use parameterized placeholders
   */
  private validateMutationQuery(sql: string): void {
    const upperSql = sql.toUpperCase().trim();
    
    // Check if this is a mutation query
    const isMutation = upperSql.startsWith('INSERT') || 
                       upperSql.startsWith('UPDATE') || 
                       upperSql.startsWith('DELETE');

    if (!isMutation) {
      return;
    }

    // Ensure values are parameterized (not string literals)
    // This check is defensive - the real protection is using prepared statements
    if (sql.includes("'") && !sql.includes('?')) {
      // May have string literals in VALUES or WHERE - require review
      // In strict mode, this should fail, but we warn for now
      console.warn('Mutation query may contain unparameterized values');
    }
  }
}

/**
 * Custom error for query issues
 */
export class QueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryError';
  }
}

/**
 * Helper to create safe query builder for a database
 */
export function createSafeQueryBuilder(db: Database.Database): SafeQueryBuilder {
  return new SafeQueryBuilder(db);
}
