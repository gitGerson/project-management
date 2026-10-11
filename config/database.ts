export interface MysqlConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  charset?: string;
  connectionLimit?: number;
  waitForConnections?: boolean;
  queueLimit?: number;
}

export interface DatabaseConfig {
  default: string;
  connections: {
    mysql: MysqlConnectionConfig;
    [key: string]: unknown;
  };
}

export const databaseConfig: DatabaseConfig = {
  default: process.env.DB_CONNECTION || 'mysql',
  connections: {
    mysql: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      database: process.env.DB_DATABASE || 'project_management',
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      charset: process.env.DB_CHARSET || 'utf8mb4',
      connectionLimit: process.env.DB_CONNECTION_LIMIT
        ? parseInt(process.env.DB_CONNECTION_LIMIT, 10)
        : 10,
      waitForConnections: true,
      queueLimit: 0,
    },
  },
};

export default databaseConfig;

