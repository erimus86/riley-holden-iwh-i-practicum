'use strict';

// Fixed IDs restrict this implementation to the approved developer test account.
const TEST_PORTAL_ID = 149590534;
const PRIVATE_APP_ID = 57763541;
const OBJECT_NAME = 'practicum_trail_kits';
const SCOPES = Object.freeze([
  'crm.objects.contacts.read', 'crm.objects.contacts.write',
  'crm.objects.custom.read', 'crm.objects.custom.write',
  'crm.schemas.custom.read', 'crm.schemas.custom.write'
]);
const PROPERTY_NAMES = Object.freeze(['name', 'category', 'capacity']);
const SCHEMA = Object.freeze({
  name: OBJECT_NAME,
  description: 'Fictional Trail Kit records for an isolated HubSpot Academy practicum.',
  labels: { singular: 'Trail Kit', plural: 'Trail Kits' },
  primaryDisplayProperty: 'name',
  secondaryDisplayProperties: ['category', 'capacity'],
  searchableProperties: ['name', 'category'],
  requiredProperties: PROPERTY_NAMES,
  properties: [
    { name: 'name', label: 'Name', type: 'string', fieldType: 'text', hasUniqueValue: true },
    { name: 'category', label: 'Category', type: 'string', fieldType: 'text' },
    { name: 'capacity', label: 'Capacity', type: 'number', fieldType: 'number' }
  ],
  associatedObjects: ['0-1']
});
const FIXTURES = Object.freeze([
  { properties: { name: 'Practice Kit A', category: 'Hiking', capacity: '12' }, contact: { firstname: 'Synthetic', lastname: 'Participant One', email: 'riley-practicum-001@example.com' } },
  { properties: { name: 'Practice Kit B', category: 'Cycling', capacity: '8' }, contact: { firstname: 'Synthetic', lastname: 'Participant Two', email: 'riley-practicum-002@example.com' } },
  { properties: { name: 'Practice Kit C', category: 'Camping', capacity: '20' }, contact: { firstname: 'Synthetic', lastname: 'Participant Three', email: 'riley-practicum-003@example.com' } }
]);

module.exports = { TEST_PORTAL_ID, PRIVATE_APP_ID, OBJECT_NAME, SCOPES, PROPERTY_NAMES, SCHEMA, FIXTURES };
