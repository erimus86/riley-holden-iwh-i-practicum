# Integrating With HubSpot I: Foundations Practicum

This is assistant-prepared code for Riley Holden to inspect, understand, and complete under the course's assessment rules. Codex authored the added implementation and commits; it is not represented as Riley's independent work. Riley reports permission for assistance, but that provider permission has not been independently verified. Nothing has been submitted for grading.

The original starter and its history come from [HubSpot Academy](https://github.com/HubSpot-Academy/integrating-with-hubspot-i-foundations-practicum). The required GitHub fork is still pending browser sign-in; this local checkout is preparation, not a completed fork.

## Actual setup

- [Dedicated developer test account 149590534](https://app-eu1.hubspot.com/dashboard/149590534), named **Riley Holden - Integrating With HubSpot Practicum**, created October 19, 2026.
- [Riley's Practicum Private App, ID 57763541](https://app-eu1.hubspot.com/private-apps/149590534/57763541/auth), created with exactly the six approved scopes in `config.js`.
- Token capture is pending. Copy is disabled until Show token; automatic approval review denied revealing it under the instruction that it never be displayed. No token has been captured, stored, or used by this checkout.
- Custom object, synthetic records, associations, and live API behavior remain **unverified and not yet created by this code**.

**Developer test account custom-object URL:**

<!--OBJECT_URL_PENDING-->

The setup command replaces the marker above with the real object URL after successful creation. No object ID is invented.

## Run locally after the token handoff

Requires Node.js 20 or later.

1. Run `npm ci --ignore-scripts`.
2. Copy `.env.example` to `.env`. Riley supplies the approved test app token directly in this local file; do not paste it into chat or commit it.
3. Run `npm run setup:plan` to inspect the schema and fictional fixtures. This makes no API calls.
4. Run `npm run setup:apply` to verify the token's portal, app, and exact scopes, then create or reuse the practicum schema and fixtures. It records successful steps in `evidence/setup-state.json`, fills the object ID in `.env`, and inserts the real object link above.
5. Run `npm start`, then open `http://127.0.0.1:3000`.

The app listens only on the local loopback interface. The fixed portal and app IDs are checked before CRM operations. `.env` is ignored, with file permissions restricted by the setup script. Error handling does not print Axios request headers, bodies, or token values. No production data, email sends, workflows, purchases, or deployment are part of this exercise.

## Implementation

The fictional **Trail Kit** custom object has three properties: string **Name** (`name`), string **Category** (`category`), and numeric **Capacity** (`capacity`). Name is unique so repeated setup can find prior fixtures. The schema defines associations with contacts. Setup prepares three fictional kits and three contacts using reserved example.com addresses, then associates each kit with its contact. No real contact data is copied.

| Route | Behavior |
| --- | --- |
| `GET /` | Fetch all pages of Trail Kit records and render the three custom properties in `homepage.pug`; includes **Add to this table**. |
| `GET /update-cobj` | Render `updates.pug` with the exact required page title, three inputs, and **Return to homepage**. |
| `POST /update-cobj` | Validate the values, create a record through the API, and redirect to `/` with HTTP 303. |

Node, Express, Axios, dotenv, and Pug are used. Styling is in `public/css/style.css`. The API client never automatically retries a creation after an uncertain response; check the portal and saved setup checkpoint first.

## Verification and remaining course requirements

Run `npm test` for isolated transport and route tests. Tests use synthetic in-memory responses and do not contact HubSpot or prove live API completion. See `../evidence/practicum-test-results.tap` for the recorded preparation run, and the parent workspace's progress ledger for Academy results and screenshots.

Still required: resolve local token handoff, run live setup and verify the app against the test portal, create the actual fork named `riley-holden-iwh-i-practicum`, push the honest commit history and merge the working branch into main, then reconcile the course's own-work rule with provider permission before submitting the public repository URL. The exam remains unopened and is for Riley to complete independently; the course requires at least 75%. Practicum grading can take seven business days. Personal surveys and attestations are left to Riley.

Official references used: [private app token information](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [custom object schemas](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/schemas/guide), and [custom object records](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/custom-objects/guide).
