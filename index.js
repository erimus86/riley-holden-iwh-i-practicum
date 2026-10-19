'use strict';

require('dotenv').config({ quiet: true });
const path = require('node:path');
const express = require('express');
const { HubSpotClient, safeError } = require('./lib/hubspot');
const { TEST_PORTAL_ID } = require('./config');

function validateKit(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const capacity = typeof body.capacity === 'string' ? body.capacity.trim() : '';
  if (!name || name.length > 120 || !category || category.length > 60 ||
      !/^\d{1,3}$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 100) {
    return { error: 'Enter a name (up to 120 characters), a category (up to 60 characters), and a whole-number capacity from 1 to 100.' };
  }
  return { properties: { name, category, capacity: String(Number(capacity)) } };
}

function createApp({ hubspot }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.portalId = TEST_PORTAL_ID;
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
    });
    next();
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false, limit: '4kb', parameterLimit: 10 }));

  // Route 1: retrieve all pages of the custom object's three user-defined properties.
  app.get('/', async (req, res) => {
    try {
      const data = await hubspot.listKits();
      res.render('homepage', { title: 'Trail Kits | Integrating With HubSpot I Practicum', data });
    } catch (error) {
      res.status(502).render('error', { title: 'Unable to load Trail Kits', message: safeError(error) });
    }
  });

  // Route 2: display the form specified by the course.
  app.get('/update-cobj', (req, res) => {
    res.render('updates', { title: 'Update Custom Object Form | Integrating With HubSpot I Practicum', values: {}, error: null });
  });

  // Route 3: validate, create one custom-object record, then return to the table.
  app.post('/update-cobj', async (req, res) => {
    if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) {
      return res.status(403).render('error', { title: 'Request rejected', message: 'Please submit the form from this app.' });
    }
    const result = validateKit(req.body);
    const form = { title: 'Update Custom Object Form | Integrating With HubSpot I Practicum', values: req.body };
    if (result.error) return res.status(400).render('updates', { ...form, error: result.error });
    try {
      await hubspot.createKit(result.properties);
      res.redirect(303, '/');
    } catch (error) {
      res.status(502).render('updates', { ...form, error: safeError(error) });
    }
  });

  app.use((error, req, res, next) => {
    res.status(error.status === 413 ? 413 : 400).render('error', {
      title: 'Request could not be read', message: 'Please use the form and keep the input within its limits.'
    });
  });
  return app;
}

if (require.main === module) {
  try {
    if (!process.env.HUBSPOT_CUSTOM_OBJECT_TYPE) throw new Error('Custom object ID is not configured.');
    const hubspot = new HubSpotClient({ token: process.env.HUBSPOT_ACCESS_TOKEN, objectType: process.env.HUBSPOT_CUSTOM_OBJECT_TYPE });
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port.');
    createApp({ hubspot }).listen(port, '127.0.0.1', () => console.log(`Listening on http://127.0.0.1:${port}`));
  } catch {
    console.error('Configure the ignored local .env and run the isolated practicum setup before starting the app.');
    process.exitCode = 1;
  }
}

module.exports = { createApp, validateKit };
