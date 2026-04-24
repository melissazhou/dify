# Frontend Embeddable Bike Assistant

This folder contains the P0 storefront entry sample for a bicycle or e-bike
brand. It is intentionally outside `web/` so brand-specific customer support UI
does not become Dify console code.

## Boundary

The browser calls the brand BFF at `POST /api/bike-assistant/chat`.

The browser must not call Dify directly or hold the Dify application bearer
token. The BFF is responsible for authenticating the storefront session,
validating market and audience access, adding trusted user and business context,
calling Dify from the server side, and normalizing the response for the widget.

## Files

- `src/BikeAssistantWidget.tsx`: lightweight React widget showing chat,
  citations, next actions, human support state, and feedback controls.
- `src/bffContract.ts`: TypeScript request and response contract plus a small
  fetch transport for the BFF endpoints.
- `contracts/bike-assistant-bff.openapi.yaml`: OpenAPI contract for the BFF
  request, response, headers, error states, and handoff states.
- `examples/product-page.tsx`: product-detail-page embed example with SKU,
  market, language, user, and session context injection.

## Embedding On A Brand Site

Add a mount point to the product detail page:

```html
<div id="bike-assistant-root"></div>
```

Render the widget from the brand frontend bundle:

```tsx
import { BikeAssistantWidget } from './src/BikeAssistantWidget'
import { BikeAssistantRequestContext } from './src/bffContract'

const context: BikeAssistantRequestContext = {
  tenant_id: 'example-bike',
  channel: 'product_detail_page',
  product: {
    sku: 'URB-E-500-2025-M',
    model: 'Urban E 500',
    model_year: 2025,
    product_url: window.location.href,
  },
  user: {
    audience: 'consumer',
    anonymous_id: 'anon_123',
    consent_to_store_chat: true,
    locale: navigator.language,
  },
  session: {
    session_id: 'session_123',
    page_url: window.location.href,
  },
  market: {
    market: 'north-america',
    country: 'US',
    language: 'en-US',
    currency: 'USD',
  },
}

<BikeAssistantWidget context={context} />
```

For a logged-in member, pass `user.user_id` from the storefront session. For an
anonymous shopper, pass `user.anonymous_id` and a stable `session.session_id`.
The BFF should verify or replace sensitive user fields before forwarding to
Dify.

## Context Injection

Required routing context:

- `tenant_id`: brand or tenant slug.
- `channel`: `brand_site`, `product_detail_page`, `dealer_portal`, or
  `support_center`.
- `market.market`, `market.country`, `market.language`: used for policy,
  language, and knowledge metadata filtering.
- `user.audience`: `consumer`, `dealer`, or `internal_agent`.
- `session.session_id` and `session.page_url`: used for continuity, rate
  limits, and analytics.

Product context is optional for generic support pages but should be present on
product and compatibility pages:

- `product.sku`
- `product.model`
- `product.model_year`
- `product.battery_model`
- `product.drive_system_vendor`

Compatibility, warranty, recall, and battery-safety flows should fail closed
when required fields are missing. The BFF should return `validation_error` with
`missing_fields`, or `safety_escalation_required` with an escalation object.

## Rendering Citations

The BFF response includes `citations[]` with source type, title, optional source
URI, document version, market, language, and snippet. The widget renders them
below each assistant answer. Production sites should keep citation links visible
for warranty, safety, service bulletin, and compatibility answers.

The assistant should not claim final compatibility, warranty approval, recall
status, order state, inventory, or appointment availability from static text
alone. Those must come from Dify tool calls or business APIs and be represented
as `source_type: business_api` when cited.

## Next Actions

`next_actions[]` drives executable UI. Supported P0 actions are:

- `book_test_ride`: open a dealer or test-ride appointment flow.
- `book_service`: open a service booking flow.
- `create_ticket`: create or continue a support ticket.
- `start_warranty_precheck`: collect proof of purchase, photos, serial number,
  and issue details.
- `find_dealer`: open a dealer locator with market and location context.
- `request_human`: ask the BFF to move the conversation to a human queue.
- `open_product`: link to a product or accessory page.
- `collect_missing_context`: ask for SKU, model year, serial number, order
  number, photos, or market before answering.

Actions with `requires_confirmation: true` should show a confirmation step
before the storefront performs writes such as ticket creation, warranty
precheck, or appointment booking.

## Human Escalation

The response always includes `escalation.status`:

- `not_needed`: self-service answer is acceptable.
- `recommended`: answer can be shown, but human help is recommended.
- `requested`: user requested human help.
- `queued`: handoff was accepted by the BFF or ticketing system.
- `accepted`: an agent or downstream system accepted ownership.
- `failed`: handoff was attempted but failed; show a fallback contact path.

High-risk battery, brake, frame-crack, smoke, fire, recall, legal complaint, and
low-confidence warranty cases should return a non-`not_needed` status and a
queue such as `battery_safety` or `warranty`.

## Feedback

If `feedback.enabled` is true, the widget sends thumbs-up or thumbs-down events
to `POST /api/bike-assistant/feedback` with the `message_id`,
`conversation_id`, rating, optional reason, and `client_trace_id`.

The BFF should forward feedback to Dify logs or the brand LLMOps pipeline and
use low-rated answers to improve annotations, metadata filters, tool routing,
or workflow prompts.

## BFF Responsibilities

The BFF should:

- Authenticate storefront, app, or dealer portal callers.
- Enforce tenant, market, language, and audience access.
- Rate-limit by tenant, session, user, and IP.
- Keep server-side Dify credentials out of browser bundles and responses.
- Validate required context for compatibility, warranty, order, appointment,
  recall, and battery-safety paths.
- Call Dify chatflow or workflow APIs server-side.
- Normalize Dify outputs into `answer`, `citations`, `next_actions`,
  `escalation`, and `feedback`.
- Convert upstream failures into typed errors such as `dify_unavailable`,
  `business_system_unavailable`, or `upstream_timeout`.
- Record `client_trace_id` and `server_trace_id` for support debugging.

## Static Verification Ideas

Testing agents can validate this folder without running a browser:

- Confirm every file lives under `dev/bike_brand_solution_kit/frontend/`.
- Parse `contracts/bike-assistant-bff.openapi.yaml`.
- Confirm `/api/bike-assistant/chat` and `/api/bike-assistant/feedback` exist.
- Confirm request context contains SKU, market, language, user, and session
  fields.
- Confirm response schemas contain `citations`, `next_actions`, `escalation`,
  and `feedback`.
- Confirm no browser-facing contract requires an upstream Dify authorization
  header.
