export interface LdapConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  baseDn: string;
  timeout: number; // in seconds
  useSsl: boolean;
  useTls: boolean;
  useSasl: boolean;
}

export interface LdapConfig {
  default: string;
  logging: boolean;
  cache: boolean;
  connections: {
    default: LdapConnectionConfig;
    [key: string]: unknown;
  };
}

export const ldapConfig: LdapConfig = {
  default: process.env.LDAP_CONNECTION || 'default',
  logging: process.env.LDAP_LOGGING === 'true',
  cache: process.env.LDAP_CACHE === 'true',
  connections: {
    default: {
      host: process.env.LDAP_HOST || '127.0.0.1',
      port: process.env.LDAP_PORT ? parseInt(process.env.LDAP_PORT, 10) : 389,
      username: process.env.LDAP_USERNAME || '',
      password: process.env.LDAP_PASSWORD || '',
      baseDn: process.env.LDAP_BASE_DN || 'dc=local,dc=com',
      timeout: process.env.LDAP_TIMEOUT ? parseInt(process.env.LDAP_TIMEOUT, 10) : 5,
      useSsl: process.env.LDAP_SSL === 'true',
      useTls: process.env.LDAP_TLS === 'true',
      useSasl: process.env.LDAP_SASL === 'true',
    },
  },
};

export function getLdapConnection(name?: string): LdapConnectionConfig {
  const connName = name || ldapConfig.default;
  const conn = ldapConfig.connections[connName] as LdapConnectionConfig | undefined;
  if (!conn) {
    return ldapConfig.connections.default;
  }
  return conn;
}

export function getLdapUrl(name?: string): string {
  const conn = getLdapConnection(name);
  const protocol = conn.useSsl ? 'ldaps' : 'ldap';
  return `${protocol}://${conn.host}:${conn.port}`;
}

export default ldapConfig;

