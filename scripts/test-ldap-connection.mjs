import { Client } from 'ldapts';

const host = process.env.LDAP_HOST || '127.0.0.1';
const port = parseInt(process.env.LDAP_PORT || '389', 10);
const username = process.env.LDAP_USERNAME || '';
const password = process.env.LDAP_PASSWORD || '';
const baseDn = process.env.LDAP_BASE_DN || 'dc=local,dc=com';
const timeout = parseInt(process.env.LDAP_TIMEOUT || '5', 10);
const useSsl = process.env.LDAP_SSL === 'true';
const useTls = process.env.LDAP_TLS === 'true';

const protocol = useSsl ? 'ldaps' : 'ldap';
const url = `${protocol}://${host}:${port}`;

console.log('Testing LDAP connection with environment settings:');
console.log(`  URL:        ${url}`);
console.log(`  Bind DN:    ${username}`);
console.log(`  Base DN:    ${baseDn}`);
console.log(`  Timeout:    ${timeout}s`);
console.log(`  SSL:        ${useSsl}`);
console.log(`  TLS:        ${useTls}`);
console.log('');

const clientOptions = {
  url,
  timeout: timeout * 1000,
  connectTimeout: timeout * 1000,
  strictDN: false,
};

if (useSsl) {
  clientOptions.tlsOptions = { rejectUnauthorized: false };
}

const client = new Client(clientOptions);

try {
  if (useTls) {
    console.log('Starting TLS...');
    await client.startTLS({ rejectUnauthorized: false });
  }

  console.log(`Attempting to bind with admin credentials (${username})...`);
  await client.bind(username, password);
  console.log('✅ Successfully bound to LDAP server with admin credentials!');

  console.log(`\nQuerying LDAP base DN (${baseDn}) for up to 3 entries...`);
  const searchResult = await client.search(baseDn, {
    scope: 'sub',
    filter: '(objectClass=*)',
    sizeLimit: 3,
  });

  console.log(`✅ Received ${searchResult.searchEntries.length} entries from LDAP directory:`);
  for (const entry of searchResult.searchEntries) {
    console.log(`  - DN: ${entry.dn}`);
  }

  await client.unbind();
  console.log('\n🎉 LDAP connection verified successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ LDAP connection failed:');
  console.error(`   ${error.message}`);
  if (error.code) {
    console.error(`   Error code: ${error.code}`);
  }
  await client.unbind().catch(() => {});
  process.exit(1);
}

