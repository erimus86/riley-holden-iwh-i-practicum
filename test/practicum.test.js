'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { HubSpotClient, HubSpotError, safeError } = require('../lib/hubspot');
const { createApp } = require('../index');
const { seedPracticum } = require('../scripts/setup-practicum');
const { TEST_PORTAL_ID, PRIVATE_APP_ID, OBJECT_NAME, SCOPES, SCHEMA, FIXTURES } = require('../config');

const token = 'synthetic-token-used-only-by-test-transport';
const schema = {
  ...SCHEMA, objectTypeId: '2-90001',
  associations: [{ id: '901', fromObjectTypeId: '2-90001', toObjectTypeId: '0-1' }]
};
const tokenInfo = { hubId: TEST_PORTAL_ID, appId: PRIVATE_APP_ID, scopes: SCOPES };

function clientWith(handler, info = tokenInfo) {
  const calls = [];
  const client = new HubSpotClient({ token, objectType: schema.objectTypeId, transport: {
    async request(request) {
      calls.push(request);
      if (request.url.includes('access-token-info')) return { data: info };
      return { data: await handler(request) };
    }
  } });
  return { client, calls };
}

for (const [name, info] of [
  ['different portal', { ...tokenInfo, hubId: 149576418 }],
  ['different app', { ...tokenInfo, appId: 1 }],
  ['extra scope', { ...tokenInfo, scopes: [...SCOPES, 'crm.objects.deals.write'] }],
  ['missing scope', { ...tokenInfo, scopes: SCOPES.slice(1) }]
]) {
  test(`rejects ${name} before any CRM request`, async () => {
    const { client, calls } = clientWith(() => assert.fail('CRM request must not execute'), info);
    await assert.rejects(client.createKit(FIXTURES[0].properties), HubSpotError);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/oauth/v2/private-apps/get/access-token-info');
  });
}

test('reads all pages with the three required properties', async () => {
  const { client, calls } = clientWith(request => {
    if (request.url.includes('/schemas/')) return schema;
    assert.equal(request.params.properties, 'name,category,capacity');
    return request.params.after === undefined
      ? { results: [{ id: '1', properties: FIXTURES[0].properties }], paging: { next: { after: '101' } } }
      : { results: [{ id: '2', properties: FIXTURES[1].properties }] };
  });
  assert.equal((await client.listKits()).length, 2);
  assert.equal(calls.filter(call => call.url.includes('access-token-info')).length, 1);
  assert.equal(calls.at(-1).params.after, '101');
});

test('accepts the platform oauth authentication marker with exactly the six data permissions', async () => {
  const { client } = clientWith(() => ({ results: [] }), { ...tokenInfo, scopes: [...SCOPES, 'oauth'] });
  const account = await client.verifyAccount();
  assert.deepEqual(account.scopes, [...SCOPES].sort());
  assert.deepEqual(account.platformAuthenticationScopes, ['oauth']);
  assert.deepEqual(await client.listSchemas(), []);
});

test('the oauth marker does not permit an additional data scope', async () => {
  const { client, calls } = clientWith(() => assert.fail('CRM request must not execute'),
    { ...tokenInfo, scopes: [...SCOPES, 'oauth', 'crm.objects.deals.write'] });
  await assert.rejects(client.listSchemas(), /six approved/);
  assert.equal(calls.length, 1);
});

test('stops repeated pagination cursors instead of looping', async () => {
  const { client } = clientWith(request => request.url.includes('/schemas/') ? schema
    : { results: [], paging: { next: { after: 'same' } } });
  await assert.rejects(client.listKits(), /pagination/);
});

test('requires the correct schema and contact association before creating records', async () => {
  const { client, calls } = clientWith(() => ({ ...schema, associations: [] }));
  await assert.rejects(client.createKit(FIXTURES[0].properties), /association/);
  assert.equal(calls.filter(call => call.method === 'POST' && !call.url.includes('access-token-info')).length, 0);
});

test('sanitizes upstream errors and never returns credentials or request bodies', async () => {
  const { client } = clientWith(() => {
    throw { message: token, config: { headers: { Authorization: token } },
      response: { status: 403, data: { message: token, correlationId: 'safe-reference-123' } } };
  });
  await assert.rejects(client.listSchemas(), error => {
    assert.equal(safeError(error), 'HubSpot returned HTTP 403. Reference: safe-reference-123.');
    assert.ok(!JSON.stringify(error).includes(token));
    assert.ok(!error.stack.includes(token));
    return true;
  });
});

test('does not automatically retry an uncertain record creation', async () => {
  const { client, calls } = clientWith(request => {
    if (request.url.includes('/schemas/')) return schema;
    throw { message: 'network timeout', config: { data: token } };
  });
  await assert.rejects(client.createKit(FIXTURES[0].properties), /did not confirm/);
  assert.equal(calls.filter(call => call.url.startsWith('/crm/v3/objects/') && call.method === 'POST').length, 1);
});

test('setup creates three kits and contacts with associations, then reuses fixtures', async () => {
  let createdSchema = false;
  const kits = [], contacts = [], associationWrites = [];
  const { client, calls } = clientWith(request => {
    const { method, url, data } = request;
    if (url === '/crm-object-schemas/v3/schemas' && method === 'GET') return { results: createdSchema ? [schema] : [] };
    if (url === '/crm-object-schemas/v3/schemas' && method === 'POST') { createdSchema = true; return schema; }
    if (url.includes('/schemas/')) return schema;
    if (url.includes('/associations/')) { associationWrites.push(url); return {}; }
    if (url.startsWith('/crm/v3/objects/contacts/') && method === 'GET') {
      const email = decodeURIComponent(url.split('/').at(-1));
      const contact = contacts.find(item => item.properties.email === email);
      if (!contact) throw { response: { status: 404, data: {} } };
      return contact;
    }
    if (url === '/crm/v3/objects/contacts' && method === 'POST') {
      const contact = { id: String(100 + contacts.length), properties: data.properties };
      contacts.push(contact); return contact;
    }
    if (method === 'GET') return { results: kits };
    if (method === 'POST') {
      const record = { id: String(200 + kits.length), properties: data.properties };
      kits.push(record); return record;
    }
    assert.fail('Unexpected synthetic transport request');
  });
  client.objectType = undefined;
  const checkpoints = [];
  const first = await seedPracticum(client, async state => checkpoints.push(JSON.parse(JSON.stringify(state))));
  assert.equal(first.complete, true);
  assert.equal(first.records.length, 3);
  assert.ok(first.records.every(record => record.associated));
  assert.equal(kits.length, 3); assert.equal(contacts.length, 3);
  assert.equal(associationWrites.length, 3);
  assert.ok(first.objectUrl.includes(`${TEST_PORTAL_ID}/objects/${schema.objectTypeId}`));
  assert.equal(checkpoints[0].complete, false);
  const creationsBefore = calls.filter(call => call.method === 'POST').length;
  const second = await seedPracticum(client);
  assert.ok(second.records.every(record => !record.recordCreated));
  assert.equal(calls.filter(call => call.method === 'POST').length, creationsBefore);
  assert.equal(associationWrites.length, 6);
});

async function serve(t, hubspot) {
  const server = createApp({ hubspot }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('homepage renders all properties, escapes records, and links to the form', async t => {
  const url = await serve(t, { listKits: async () => [{ properties: { name: '<script>bad()</script>', category: 'Hiking', capacity: '12' } }] });
  const response = await fetch(url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  for (const label of ['Name', 'Category', 'Capacity', 'Add to this table']) assert.ok(html.includes(label));
  assert.match(html, /href="\/update-cobj"/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('form uses the exact course title and all three inputs', async t => {
  const url = await serve(t, {});
  const response = await fetch(url + '/update-cobj');
  const html = await response.text();
  assert.match(html, /<title>Update Custom Object Form \| Integrating With HubSpot I Practicum<\/title>/);
  for (const name of ['name', 'category', 'capacity']) assert.ok(html.includes(`name="${name}"`));
  assert.match(html, /Return to homepage/);
});

test('invalid form submissions do not call HubSpot', async t => {
  const url = await serve(t, { createKit: async () => assert.fail('Invalid data must not be sent') });
  for (const capacity of ['0', '101', '1.5', '-2', 'abc']) {
    const response = await fetch(url + '/update-cobj', { method: 'POST', body: new URLSearchParams({ name: 'Test', category: 'Hiking', capacity }) });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /whole-number capacity/);
  }
});

test('valid form creates the submitted kit and redirects to the table', async t => {
  let created;
  const url = await serve(t, { createKit: async properties => { created = properties; } });
  const response = await fetch(url + '/update-cobj', { method: 'POST', redirect: 'manual',
    headers: { Origin: url }, body: new URLSearchParams({ name: '  Test Kit  ', category: '  Hiking ', capacity: '012' }) });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/');
  assert.deepEqual(created, { name: 'Test Kit', category: 'Hiking', capacity: '12' });
});

test('cross-origin submissions are rejected before any write', async t => {
  const url = await serve(t, { createKit: async () => assert.fail('Cross-origin request must not write') });
  const response = await fetch(url + '/update-cobj', { method: 'POST', headers: { Origin: 'https://example.invalid' },
    body: new URLSearchParams(FIXTURES[0].properties) });
  assert.equal(response.status, 403);
});

test('failed writes preserve escaped form values without leaking raw errors', async t => {
  const url = await serve(t, { createKit: async () => { throw new Error(token); } });
  const response = await fetch(url + '/update-cobj', { method: 'POST', body: new URLSearchParams({ name: '<b>Kit</b>', category: 'Hiking', capacity: '12' }) });
  const html = await response.text();
  assert.equal(response.status, 502);
  assert.match(html, /&lt;b&gt;Kit&lt;\/b&gt;/);
  assert.ok(!html.includes(token));
  assert.match(html, /The request could not be completed/);
});
