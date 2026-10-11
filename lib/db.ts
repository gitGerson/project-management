import mysql, {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import type { ExecuteValues, QueryValues } from 'mysql2';
import { databaseConfig } from '@/config/database';

// Global singleton declaration to preserve connection pool across Fast Refresh in Next.js development
declare global {
  var __mysqlPool: Pool | undefined;
}

const mysqlConfig = databaseConfig.connections.mysql;

export const pool: Pool =
  global.__mysqlPool ||
  mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    database: mysqlConfig.database,
    user: mysqlConfig.username,
    password: mysqlConfig.password,
    waitForConnections: mysqlConfig.waitForConnections,
    connectionLimit: mysqlConfig.connectionLimit,
    queueLimit: mysqlConfig.queueLimit,
    charset: mysqlConfig.charset,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__mysqlPool = pool;
}

/**
 * DB helper mirroring Laravel's DB facade patterns (DB::select, DB::insert, DB::transaction, etc.)
 */
export const DB = {
  /**
   * Raw pool instance
   */
  pool,

  /**
   * Run a raw SQL query with parameters.
   * Equivalent to DB::select() in Laravel.
   */
  async select<T = RowDataPacket[]>(sql: string, params?: QueryValues): Promise<T> {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T;
  },

  /**
   * Execute an INSERT query and return insertId and affectedRows.
   * Equivalent to DB::insert() in Laravel.
   */
  async insert(
    sql: string,
    params?: ExecuteValues
  ): Promise<{ insertId: number; affectedRows: number }> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  },

  /**
   * Execute an UPDATE query and return affectedRows and changedRows.
   * Equivalent to DB::update() in Laravel.
   */
  async update(
    sql: string,
    params?: ExecuteValues
  ): Promise<{ affectedRows: number; changedRows: number }> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
    };
  },

  /**
   * Execute a DELETE query and return affectedRows.
   * Equivalent to DB::delete() in Laravel.
   */
  async delete(sql: string, params?: ExecuteValues): Promise<{ affectedRows: number }> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return {
      affectedRows: result.affectedRows,
    };
  },

  /**
   * Execute an arbitrary SQL statement.
   * Equivalent to DB::statement() in Laravel.
   */
  async statement(sql: string, params?: ExecuteValues): Promise<ResultSetHeader> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return result;
  },

  /**
   * General query executor.
   */
  async query<T = unknown>(sql: string, params?: QueryValues): Promise<T> {
    const [result] = await pool.query(sql, params);
    return result as T;
  },

  /**
   * Execute queries inside a database transaction.
   * Equivalent to DB::transaction() in Laravel.
   */
  async transaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Test the database connection.
   */
  async testConnection(): Promise<{ connected: boolean; message: string; details?: unknown }> {
    try {
      const connection = await pool.getConnection();
      try {
        const [rows] = await connection.query<RowDataPacket[]>('SELECT 1 + 1 AS result, VERSION() AS version');
        return {
          connected: true,
          message: 'MySQL connection successful!',
          details: rows[0],
        };
      } finally {
        connection.release();
      }
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      return {
        connected: false,
        message: `MySQL connection failed: ${err.message}`,
        details: { code: err.code },
      };
    }
  },
};

export default DB;

