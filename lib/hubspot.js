'use strict';

const axios = require('axios');
const { TEST_PORTAL_ID, PRIVATE_APP_ID, SCOPES, OBJECT_NAME, PROPERTY_NAMES } = require('../config');

class HubSpotError extends Error {
  constructor(message, status, correlationId) {
    super(message);
    this.name = 'HubSpotError';
    this.status = Number.isInteger(status) ? status : undefined;
    this.correlationId = /^[a-zA-Z0-9-]{1,80}$/.test(correlationId || '') ? correlationId : undefined;
  }
}

function safeError(error) {
  if (!(error instanceof HubSpotError)) return 'The request could not be completed.';
  const suffix = error.correlationId ? ` Reference: ${error.correlationId}.` : '';
  return error.message + suffix;
}

class HubSpotClient {
  constructor({ token, objectType, transport } = {}) {
    if (!token) throw new HubSpotError('A local private-app token is required.');
    this.token = token;
    this.objectType = objectType;
    this.http = transport || axios.create({
      baseURL: 'https://api.hubapi.com', timeout: 15000, maxRedirects: 0,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    this.verified = null;
  }

  async send(method, url, data, params) {
    try {
      return (await this.http.request({ method, url, data, params })).data;
    } catch (error) {
      // Axios errors include credentials in headers and bodies. Never log or rethrow them.
      const status = error.response?.status;
      const correlationId = error.response?.data?.correlationId;
      const message = status === 429
        ? 'HubSpot rate limit reached. Wait before trying again.'
        : status
          ? `HubSpot returned HTTP ${status}.`
          : 'HubSpot did not confirm the request. Check the portal before retrying a creation.';
      throw new HubSpotError(message, status, correlationId);
    }
  }

  async verifyAccount() {
    if (!this.verified) {
      this.verified = this.send('POST', '/oauth/v2/private-apps/get/access-token-info', { tokenKey: this.token })
        .then(info => {
          if (Number(info.hubId) !== TEST_PORTAL_ID || Number(info.appId) !== PRIVATE_APP_ID) {
            throw new HubSpotError('This token is not for the approved developer test portal and app. No CRM request was made.');
          }
          const actual = new Set(info.scopes || []);
          // HubSpot's token metadata also reports its basic `oauth` authentication
          // scope. It is absent from this private app's configurable CRM scope list.
          // Accept that one authentication marker; reject every extra data permission.
          if (SCOPES.some(s => !actual.has(s)) || [...actual].some(s => !SCOPES.includes(s) && s !== 'oauth')) {
            throw new HubSpotError('The token scopes do not match the six approved practicum scopes. No CRM request was made.');
          }
          return { hubId: TEST_PORTAL_ID, appId: PRIVATE_APP_ID, scopes: [...SCOPES].sort(),
            platformAuthenticationScopes: actual.has('oauth') ? ['oauth'] : [] };
        })
        .catch(error => { this.verified = null; throw error; });
    }
    return this.verified;
  }

  async request(method, url, data, params) {
    await this.verifyAccount();
    return this.send(method, url, data, params);
  }

  async listSchemas() {
    return (await this.request('GET', '/crm-object-schemas/v3/schemas')).results;
  }

  validateSchema(schema) {
    if (schema.name !== OBJECT_NAME || schema.primaryDisplayProperty !== 'name') {
      throw new HubSpotError('The custom object does not match the Trail Kit practicum schema.');
    }
    for (const [name, type] of [['name', 'string'], ['category', 'string'], ['capacity', 'number']]) {
      const property = schema.properties?.find(p => p.name === name);
      if (!property || property.type !== type) throw new HubSpotError('The custom object properties do not match the practicum schema.');
    }
    if (!schema.associations?.some(a => a.toObjectTypeId === '0-1' && a.fromObjectTypeId === schema.objectTypeId)) {
      throw new HubSpotError('The custom object is missing its contact association definition.');
    }
    if (this.objectType && this.objectType !== schema.objectTypeId) {
      throw new HubSpotError('The configured object ID does not match the practicum custom object.');
    }
    return schema;
  }

  async getSchema() {
    if (!this.objectType) throw new HubSpotError('Run the practicum setup to configure the custom object ID.');
    return this.validateSchema(await this.request('GET', `/crm-object-schemas/v3/schemas/${encodeURIComponent(this.objectType)}`));
  }

  async listKits() {
    await this.getSchema();
    const records = [], seen = new Set();
    let after;
    do {
      const page = await this.request('GET', `/crm/v3/objects/${encodeURIComponent(this.objectType)}`, undefined,
        { limit: 100, properties: PROPERTY_NAMES.join(','), after, archived: false });
      records.push(...page.results);
      after = page.paging?.next?.after;
      if (after !== undefined) {
        if (seen.has(String(after)) || seen.size >= 100) throw new HubSpotError('HubSpot pagination did not finish normally.');
        seen.add(String(after));
      }
    } while (after !== undefined);
    return records;
  }

  async createKit(properties) {
    await this.getSchema();
    return this.request('POST', `/crm/v3/objects/${encodeURIComponent(this.objectType)}`, { properties });
  }
}

module.exports = { HubSpotClient, HubSpotError, safeError };
