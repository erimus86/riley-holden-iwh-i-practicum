'use strict';

require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { HubSpotClient, HubSpotError, safeError } = require('../lib/hubspot');
const { TEST_PORTAL_ID, PRIVATE_APP_ID, OBJECT_NAME, SCHEMA, FIXTURES } = require('../config');
const root = path.join(__dirname, '..');

async function getOrCreateContact(client, properties) {
  try {
    return await client.request('GET', `/crm/v3/objects/contacts/${encodeURIComponent(properties.email)}`,
      undefined, { idProperty: 'email', properties: 'email,firstname,lastname' });
  } catch (error) {
    if (error.status !== 404) throw error;
    return client.request('POST', '/crm/v3/objects/contacts', { properties });
  }
}

async function seedPracticum(client, checkpoint = async () => {}) {
  const account = await client.verifyAccount();
  const state = { account, schemaCreated: false, records: [], complete: false };
  await checkpoint(state);
  const schemas = await client.listSchemas();
  let schema = schemas.find(item => item.name === OBJECT_NAME);
  if (!schema) {
    schema = await client.request('POST', '/crm-object-schemas/v3/schemas', SCHEMA);
    state.schemaCreated = true;
  }
  client.validateSchema(schema);
  client.objectType = schema.objectTypeId;
  state.objectTypeId = schema.objectTypeId;
  state.objectUrl = `https://app.hubspot.com/contacts/${TEST_PORTAL_ID}/objects/${schema.objectTypeId}/views/all/list`;
  await checkpoint(state);
  const association = schema.associations.find(a => a.fromObjectTypeId === schema.objectTypeId && a.toObjectTypeId === '0-1');
  const existing = await client.listKits();
  for (const fixture of FIXTURES) {
    const contact = await getOrCreateContact(client, fixture.contact);
    const previous = existing.find(record => record.properties.name === fixture.properties.name);
    if (previous && ['category', 'capacity'].some(key => String(previous.properties[key]) !== fixture.properties[key])) {
      throw new HubSpotError('An existing practice record differs from the fixture. Review it before continuing.');
    }
    const record = previous || await client.createKit(fixture.properties);
    state.records.push({ name: fixture.properties.name, recordId: record.id, contactId: contact.id, recordCreated: !previous, associated: false });
    await checkpoint(state);
    await client.request('PUT', `/crm/v3/objects/${encodeURIComponent(schema.objectTypeId)}/${encodeURIComponent(record.id)}/associations/contacts/${encodeURIComponent(contact.id)}/${encodeURIComponent(association.id)}`);
    state.records[state.records.length - 1].associated = true;
    await checkpoint(state);
  }
  state.complete = true;
  await checkpoint(state);
  return state;
}

async function writeCheckpoint(state) {
  const directory = path.join(root, 'evidence');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'setup-state.json'), JSON.stringify({
    recordedAtUtc: new Date().toISOString(), ...state
  }, null, 2) + '\n');
}

async function saveObjectConfiguration(state) {
  const envPath = path.join(root, '.env');
  let env = await fs.readFile(envPath, 'utf8');
  const line = `HUBSPOT_CUSTOM_OBJECT_TYPE=${state.objectTypeId}`;
  env = /^HUBSPOT_CUSTOM_OBJECT_TYPE=.*$/m.test(env)
    ? env.replace(/^HUBSPOT_CUSTOM_OBJECT_TYPE=.*$/m, line)
    : env.trimEnd() + '\n' + line + '\n';
  await fs.writeFile(envPath, env, { mode: 0o600 });
  await fs.chmod(envPath, 0o600);
  const readmePath = path.join(root, 'README.md');
  const readme = await fs.readFile(readmePath, 'utf8');
  await fs.writeFile(readmePath, readme.replace('<!--OBJECT_URL_PENDING-->', `[Open the Trail Kit records in the developer test account](${state.objectUrl})`));
}

async function main() {
  if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ mode: 'plan-only; no API calls', portalId: TEST_PORTAL_ID, appId: PRIVATE_APP_ID, schema: SCHEMA, fixtures: FIXTURES }, null, 2));
    return;
  }
  if (!process.argv.includes('--apply')) throw new HubSpotError('Choose --plan or --apply explicitly.');
  const client = new HubSpotClient({ token: process.env.HUBSPOT_ACCESS_TOKEN });
  const state = await seedPracticum(client, writeCheckpoint);
  await saveObjectConfiguration(state);
  console.log(`Verified test portal ${TEST_PORTAL_ID}; prepared ${state.records.length} associated practice records. Evidence: evidence/setup-state.json`);
  console.log(state.objectUrl);
}

if (require.main === module) main().catch(error => {
  console.error(safeError(error));
  console.error('Setup stopped. Review evidence/setup-state.json, if present, before retrying. Tokens and raw HTTP errors are never printed.');
  process.exitCode = 1;
});

module.exports = { seedPracticum, getOrCreateContact };
