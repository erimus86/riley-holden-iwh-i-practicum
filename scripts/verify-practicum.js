'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const dotenv = require('dotenv');
const { HubSpotClient, HubSpotError, safeError } = require('../lib/hubspot');
const { FIXTURES, TEST_PORTAL_ID, PRIVATE_APP_ID, SCOPES } = require('../config');
const root = path.join(__dirname, '..');

async function verifyPracticum(client) {
  // The only POST is token introspection. All CRM calls in this script are GETs.
  const account = await client.verifyAccount();
  const schema = await client.getSchema();
  const kits = await client.listKits();
  const ui = JSON.parse(await fs.readFile(path.join(root, 'evidence/live-ui-setup.json'), 'utf8'));
  const verified = [];
  for (const fixture of FIXTURES) {
    const expected = ui.records.find(record => record.properties.name === fixture.properties.name);
    const kit = kits.find(record => record.properties.name === fixture.properties.name);
    if (!expected || !kit || kit.id !== expected.recordId ||
        Object.entries(fixture.properties).some(([key, value]) => String(kit.properties[key]) !== value)) {
      throw new HubSpotError('API kit data does not match the previously verified synthetic fixture.');
    }
    const detail = await client.request('GET', `/crm/v3/objects/${encodeURIComponent(client.objectType)}/${encodeURIComponent(kit.id)}`,
      undefined, { properties: 'name,category,capacity', associations: 'contacts' });
    const associations = detail.associations?.contacts?.results || [];
    if (!associations.some(association => association.id === expected.associatedContact.recordId)) {
      throw new HubSpotError('API record does not contain the expected fictional contact association.');
    }
    const contact = await client.request('GET', `/crm/v3/objects/contacts/${encodeURIComponent(expected.associatedContact.recordId)}`,
      undefined, { properties: 'email,firstname,lastname' });
    if (contact.properties.email !== fixture.contact.email || contact.properties.firstname !== fixture.contact.firstname ||
        contact.properties.lastname !== fixture.contact.lastname) {
      throw new HubSpotError('API contact data does not match the fictional fixture.');
    }
    verified.push({ recordId: kit.id, properties: fixture.properties,
      contactId: contact.id, fictionalEmail: fixture.contact.email, associationVerified: true });
  }
  return { recordedAtUtc: new Date().toISOString(), method: 'Read-only HubSpot CRM API verification; token introspection POST only',
    account, objectTypeId: schema.objectTypeId, objectName: schema.name,
    objectUrl: `https://app.hubspot.com/contacts/${TEST_PORTAL_ID}/objects/${schema.objectTypeId}/views/all/list`,
    customPropertiesVerified: ['name', 'category', 'capacity'], records: verified,
    verifiedKitCount: verified.length, crmWritesPerformed: false, tokenValueRecorded: false };
}

async function main() {
  const env = dotenv.parse(await fs.readFile(path.join(root, '.env')));
  const client = new HubSpotClient({ token: env.HUBSPOT_ACCESS_TOKEN, objectType: env.HUBSPOT_CUSTOM_OBJECT_TYPE });
  if (process.argv.includes('--token-info-only')) {
    const info = await client.send('POST', '/oauth/v2/private-apps/get/access-token-info', { tokenKey: env.HUBSPOT_ACCESS_TOKEN });
    if (Number(info.hubId) !== TEST_PORTAL_ID || Number(info.appId) !== PRIVATE_APP_ID) {
      throw new HubSpotError('Token inspection returned an unexpected portal or app. No CRM request was made.');
    }
    const actualScopes = [...new Set(info.scopes || [])].sort();
    const inspection = { recordedAtUtc: new Date().toISOString(), hubId: TEST_PORTAL_ID, appId: PRIVATE_APP_ID,
      actualScopes, missingScopes: SCOPES.filter(scope => !actualScopes.includes(scope)),
      platformAuthenticationScopes: actualScopes.filter(scope => scope === 'oauth'),
      unexpectedScopes: actualScopes.filter(scope => !SCOPES.includes(scope) && scope !== 'oauth'), crmRequestsMade: false, tokenValueRecorded: false };
    await fs.writeFile(path.join(root, 'evidence/token-scope-inspection.json'), JSON.stringify(inspection, null, 2) + '\n');
    console.log(JSON.stringify(inspection, null, 2));
    return;
  }
  const result = await verifyPracticum(client);
  await fs.writeFile(path.join(root, 'evidence/live-api-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Verified approved test portal ${result.account.hubId}, app ${result.account.appId}, and ${result.account.scopes.length} exact approved scopes.`);
  console.log(`Verified ${result.verifiedKitCount} existing kits and their fictional contacts and associations. No CRM writes performed.`);
  console.log('Sanitized evidence: evidence/live-api-verification.json');
}

if (require.main === module) main().catch(error => {
  console.error(safeError(error));
  process.exitCode = 1;
});

module.exports = { verifyPracticum };
