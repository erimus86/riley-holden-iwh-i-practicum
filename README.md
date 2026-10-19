# Integrating With HubSpot I: Foundations Practicum

This is assistant-prepared code for Riley Holden to inspect, understand, and complete under the course's assessment rules. Codex authored the added implementation and commits; it is not represented as Riley's independent work. Riley reports permission for assistance, but that provider permission has not been independently verified. Nothing has been submitted for grading.

The original starter and its history come from [HubSpot Academy](https://github.com/HubSpot-Academy/integrating-with-hubspot-i-foundations-practicum). The GitHub connector is authenticated as `erimus86` and can read the upstream starter. The intended public fork `erimus86/riley-holden-iwh-i-practicum` returned 404 (absent or inaccessible); no fork or publication has occurred. The connector exposes no fork-creation tool. Publication and grading submission await scoped approval and a supported fork-creation path.

## Actual setup

- [Dedicated developer test account 149590534](https://app-eu1.hubspot.com/dashboard/149590534), named **Riley Holden - Integrating With HubSpot Practicum**, created October 19, 2026.
- [Riley's Practicum Private App, ID 57763541](https://app-eu1.hubspot.com/private-apps/149590534/57763541/auth), created with exactly the six approved scopes in `config.js`.
- Riley explicitly approved token visibility solely within HubSpot and local ignored storage. The token is now in local `.env` with mode 0600, Git-ignored and untracked; its value was never emitted in chat, logs, screenshots, or commits. It was hidden again after capture.
- Custom object **2-255182120** (`practicum_trail_kits`), three fictional kit records, three fictional contacts, and all three associations were created and verified through the normal test-portal UI. See [live UI setup evidence](evidence/live-ui-setup.json). The read-only live API check verified all three fixture records and their contact associations; the actual app also created a fourth fictional kit through its POST form. See [API verification](evidence/live-api-verification.json) and [live app verification](evidence/live-app-verification.json).

**Developer test account custom-object URL:**

[Open the Trail Kit records in the developer test account](https://app-eu1.hubspot.com/contacts/149590534/objects/2-255182120/views/all/list)

The link above uses the object ID observed in the test portal. The environment example already contains that verified ID.

## Run locally

Requires Node.js 20 or later.

1. Run `npm ci --ignore-scripts`.
2. Use the existing local `.env`, which already contains the approved test app token. In a fresh checkout, create `.env` from `.env.example` and supply its authorized token locally. Never paste a token into chat or commit it.
3. Run `npm run setup:plan` to inspect the schema and fictional fixtures. This makes no API calls.
4. Run `npm run setup:apply` to verify the token's portal, app, and exact scopes, then create or reuse the practicum schema and fixtures. It records successful steps in `evidence/setup-state.json` and fills the object ID in `.env`. Existing fixtures are reused by name/email; existing associations are written idempotently.
5. Run `npm run verify:api` for a read-only API comparison with the recorded UI fixtures.
6. Run `npm start`, then open `http://127.0.0.1:3000`.

The app listens only on the local loopback interface. The fixed portal and app IDs are checked before CRM operations. Exactly the six configured CRM permissions are required. HubSpot token introspection additionally reports its basic `oauth` authentication marker; the client records it separately, and rejects every other unapproved scope. The app UI was independently checked to still list only the six configured CRM scopes. No OAuth app installation or new permission grant was performed. `.env` is ignored, with file permissions restricted by the setup script. Error handling does not print Axios request headers, bodies, or token values. No production data, email sends, workflows, purchases, or deployment are part of this exercise.

## Implementation

The fictional **Trail Kit** custom object has three properties: string **Name** (`name`), string **Category** (`category`), and numeric **Capacity** (`capacity`). Name is unique so repeated setup can find prior fixtures. The schema defines associations with contacts. Setup prepares three fictional kits and three contacts using reserved example.com addresses, then associates each kit with its contact. No real contact data is copied.

| Route | Behavior |
| --- | --- |
| `GET /` | Fetch all pages of Trail Kit records and render the three custom properties in `homepage.pug`; includes **Add to this table**. |
| `GET /update-cobj` | Render `updates.pug` with the exact required page title, three inputs, and **Return to homepage**. |
| `POST /update-cobj` | Validate the values, create a record through the API, and redirect to `/` with HTTP 303. |

Node, Express, Axios, dotenv, and Pug are used. Styling is in `public/css/style.css`. The API client never automatically retries a creation after an uncertain response; check the portal and saved setup checkpoint first.

## Verification and remaining course requirements

Run `npm test` for isolated transport and route tests. Tests use synthetic in-memory responses and do not contact HubSpot or prove live API completion. All **18 tests passed**, including authentication-marker handling and rejection of any additional data scope. See [recorded test results](evidence/practicum-test-results.tap). Unit tests alone do not prove live API behavior. The separate API and live app evidence linked above records that verification; no course certification is claimed.

Token handling and live API/app verification are complete. Still required: create the actual fork named `riley-holden-iwh-i-practicum`, push the honest commit history, including the working branch merge into local main, then reconcile the course's own-work rule with provider permission before submitting the public repository URL. The exam remains unopened and is for Riley to complete independently; the course requires at least 75%. Practicum grading can take seven business days. Personal surveys and attestations are left to Riley.

Official references used: [private app token information](https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview), [custom object schemas](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/schemas/guide), and [custom object records](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/custom-objects/guide).
