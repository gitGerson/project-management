import { Client, InvalidCredentialsError, type ClientOptions } from 'ldapts';
import { getLdapConnection, getLdapUrl, ldapConfig, type LdapConnectionConfig } from '@/config/ldap';

export interface LdapUserEntry {
  dn: string;
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  guid: string | null;
  domain: string;
  rawAttributes: Record<string, unknown>;
}

export interface LdapCredentials {
  username: string;
  password: string;
}

/**
 * Escape characters for LDAP filter syntax to prevent LDAP injection (RFC 4515)
 */
export function escapeLdapFilter(input: string): string {
  return input.replace(/[\0\(\)\*\\]/g, (char) => {
    switch (char) {
      case '\0':
        return '\\00';
      case '(':
        return '\\28';
      case ')':
        return '\\29';
      case '*':
        return '\\2a';
      case '\\':
        return '\\5c';
      default:
        return char;
    }
  });
}

/**
 * Safely extracts a single string value from an LDAP attribute
 */
function getSingleAttribute(entry: Record<string, unknown>, attrName: string): string | null {
  const normalizedKey = Object.keys(entry).find(
    (k) => k.toLowerCase() === attrName.toLowerCase()
  );

  if (!normalizedKey) return null;
  const value = entry[normalizedKey];
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const first = value[0];
    if (Buffer.isBuffer(first)) return first.toString('utf8');
    return typeof first === 'string' ? first : String(first);
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return typeof value === 'string' ? value : String(value);
}

/**
 * Create a new configured ldapts Client instance
 */
function createLdapClient(connectionConfig: LdapConnectionConfig): Client {
  const url = getLdapUrl();
  const timeoutMs = connectionConfig.timeout * 1000;

  const clientOptions: ClientOptions = {
    url,
    timeout: timeoutMs,
    connectTimeout: timeoutMs,
    strictDN: false,
  };

  if (connectionConfig.useSsl) {
    clientOptions.tlsOptions = {
      rejectUnauthorized: false,
    };
  }

  return new Client(clientOptions);
}

/**
 * Authenticate against LDAP and retrieve user profile attributes
 * Returns user details upon successful bind; throws an Error on failure
 */
export async function authenticateLdapUser(
  credentials: LdapCredentials,
  connectionName?: string
): Promise<LdapUserEntry> {
  const config = getLdapConnection(connectionName);
  const adminClient = createLdapClient(config);

  const { username, password } = credentials;
  if (!username || !password) {
    throw new Error('Invalid username or password');
  }

  try {
    if (config.useTls) {
      await adminClient.startTLS({ rejectUnauthorized: false });
    }

    // Step 1: Bind as admin/service account if configured to search directory
    if (config.username) {
      if (ldapConfig.logging) {
        console.log(`[LDAP] Connecting to ${getLdapUrl()} as ${config.username}...`);
      }
      await adminClient.bind(config.username, config.password || '');
    }

    // Step 2: Search for user by uid, mail, or cn under baseDn
    const escapedInput = escapeLdapFilter(username);
    const filter = `(&(objectClass=*)(|(uid=${escapedInput})(mail=${escapedInput})(cn=${escapedInput})))`;

    if (ldapConfig.logging) {
      console.log(`[LDAP] Searching ${config.baseDn} with filter: ${filter}`);
    }

    const searchResult = await adminClient.search(config.baseDn, {
      scope: 'sub',
      filter,
      attributes: [
        'dn',
        'uid',
        'cn',
        'displayName',
        'mail',
        'telephoneNumber',
        'mobile',
        'entryUUID',
        'entryuuid',
      ],
      sizeLimit: 1,
    });

    if (!searchResult.searchEntries || searchResult.searchEntries.length === 0) {
      if (ldapConfig.logging) {
        console.warn(`[LDAP] User not found: "${username}"`);
      }
      throw new Error('Invalid username or password');
    }

    const entry = searchResult.searchEntries[0];
    const userDn = entry.dn;

    if (!userDn) {
      throw new Error('Invalid username or password');
    }

    // Step 3: Authenticate the user by binding with user's DN and supplied password
    const userClient = createLdapClient(config);
    try {
      if (config.useTls) {
        await userClient.startTLS({ rejectUnauthorized: false });
      }

      if (ldapConfig.logging) {
        console.log(`[LDAP] Attempting user bind for DN: ${userDn}`);
      }

      await userClient.bind(userDn, password);

      if (ldapConfig.logging) {
        console.log(`[LDAP] Bind successful for DN: ${userDn}`);
      }
    } catch (bindError) {
      if (bindError instanceof InvalidCredentialsError) {
        if (ldapConfig.logging) {
          console.warn(`[LDAP] Invalid credentials for DN: ${userDn}`);
        }
        throw new Error('Invalid username or password');
      }

      const err = bindError as Error;
      if (err.message && err.message.toLowerCase().includes('invalid credentials')) {
        throw new Error('Invalid username or password');
      }

      throw bindError;
    } finally {
      await userClient.unbind().catch(() => {});
    }

    // Step 4: Extract attributes mapped to our user model
    const uid = getSingleAttribute(entry, 'uid') || username;
    const name =
      getSingleAttribute(entry, 'cn') ||
      getSingleAttribute(entry, 'displayName') ||
      uid;
    const email =
      getSingleAttribute(entry, 'mail') ||
      (username.includes('@') ? username : `${uid}@tongtji.com`);
    const phone =
      getSingleAttribute(entry, 'telephoneNumber') ||
      getSingleAttribute(entry, 'mobile') ||
      null;
    const guid =
      getSingleAttribute(entry, 'entryUUID') ||
      getSingleAttribute(entry, 'entryuuid') ||
      null;

    return {
      dn: userDn,
      uid,
      name,
      email,
      phone,
      guid,
      domain: connectionName || ldapConfig.default,
      rawAttributes: entry,
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.message === 'Invalid username or password') {
      throw err;
    }

    if (ldapConfig.logging) {
      console.error('[LDAP] Connection or operation error:', err);
    }

    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ENOTFOUND' ||
      err.name === 'TimeoutError' ||
      err.message?.includes('timeout')
    ) {
      throw new Error('Whoops! LDAP server cannot be reached.');
    }

    throw new Error(err.message || 'Authentication error occurred.');
  } finally {
    await adminClient.unbind().catch(() => {});
  }
}

