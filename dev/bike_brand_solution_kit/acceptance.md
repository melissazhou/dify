# Bike Brand Solution Kit Acceptance

Source proposal: `dify_bike_brand_transformation.md` v1.0, dated 2026-04-24.

This document converts the remaining proposal items into a local acceptance
checklist for frontend, BFF, Dify workflow, and business integration validation.

## Status Summary

| Phase | Proposal target | Delivery status in this kit | Acceptance status |
|---|---|---|---|
| P0 | 4-week demo-ready public support and pre-sales baseline | Delivered as static assets: knowledge governance, metadata schema, integration contracts, workflow templates, frontend BFF contract, widget sample, and local demo cases | Acceptable for local static validation and mocked full-stack validation |
| P1 | 8-week business loop with OMS, CRM, dealer locator, warranty precheck, sales recommendation, ticket creation, and basic vision intake | Contract-ready. API shapes, tool mapping, workflows, and demo cases exist, but live business systems are not connected in this kit | Requires brand OMS/CRM/dealer/ticket/warranty systems or mocks that conform to the OpenAPI contracts |
| P2 | 12-week dealer and internal Copilot with internal portal, service bulletin retrieval, parts compatibility, escalation, and multi-role permissions | Partially defined by audience metadata, dealer/internal actor headers, service bulletin domains, and tool contracts | Requires dealer/internal portal, SSO or role claims, row-level authorization, and real internal knowledge approval |
| P3 | Continuous optimization with GraphRAG, stronger recall/safety rules, event automation, automated eval, and multi-region rollout | Acceptance criteria only. No production automation or rollout machinery is included | Requires production telemetry, eval runners, event bus, recall/safety rule services, and regional operations |

## Completed This Round

- Added this acceptance checklist at `dev/bike_brand_solution_kit/acceptance.md`.
- Added `tests/demo_chat_cases.json` with local chat cases for pre-sales,
  recommendation, dynamic price and stock, order state, warranty precheck,
  battery smoke/fire/swelling/water ingress, brake failure, frame crack,
  manual review, dealer locator, and service-center routing.
- Added `tests/local_health_contract.json` to declare the frontend, BFF, Dify,
  and business integration URLs, expected HTTP status, and key response fields
  needed for local full-stack validation.
- Updated the top-level README "Local Full-Stack Demo" section to point to the
  demo cases, example page, health contract, static validation command, and this
  acceptance file.

## P0 Acceptance Checklist

- [x] Knowledge domains are split by audience, market, document type, and risk.
- [x] Metadata schema includes brand, series, model, model year, language,
  country, market, audience, channel, components, warranty region, status,
  safety, legal approval, compatibility, and version fields.
- [x] Static knowledge and dynamic business state are separated. Price, stock,
  order, serial, warranty, ticket, appointment, CRM, and dealer state must come
  from tools or business APIs.
- [x] Consumer support chatflow includes intent routing, metadata-filtered
  retrieval, tool placeholders, citations, feedback, safety escalation, and
  low-confidence handoff.
- [x] Sales workflow requires shopper needs and live price/inventory tool output
  before recommending purchasable options.
- [x] Warranty workflow collects model, model year, serial number, purchase
  proof, photos, component, region, and usage description before rule checking.
- [x] Frontend sample uses a BFF boundary and does not expose Dify credentials in
  browser contracts.
- [x] Local demo cases cover the highest-risk and highest-value validation paths.

## P1 Acceptance Checklist

- [ ] BFF `POST /api/bike-assistant/chat` forwards trusted tenant, market,
  audience, session, and product context to Dify without exposing Dify API keys.
- [ ] BFF normalizes every Dify response into `answer`, `conversation_id`,
  `message_id`, `intent`, `confidence`, `citations`, `next_actions`,
  `escalation`, `feedback`, and `server_trace_id`.
- [ ] Price and inventory answers call `listProducts`, `getProductBySku`, or the
  recommendation-context business API and cite `source_type=business_api`.
- [ ] Order answers call `getOrderByNumber`, mask tracking/customer identifiers,
  and never answer from static knowledge.
- [ ] Dealer and service-center answers call `findNearbyDealers` or
  `findNearbyServiceCenters` with market and location context.
- [ ] Warranty precheck calls `checkWarrantyRules` and creates a ticket or review
  case only when the required evidence and consent are present.
- [ ] CRM lead creation, test-ride booking, service booking, ticket creation, and
  warranty precheck writes use idempotency keys.
- [ ] Feedback events are accepted through `POST /api/bike-assistant/feedback`
  and are traceable by `client_trace_id`, `server_trace_id`, and message ID.

## P2 Acceptance Checklist

- [ ] Dealer and internal users authenticate through the brand portal or BFF,
  with actor type and role claims enforced server-side.
- [ ] Dealer users can only access assigned dealer, tenant, market, order,
  ticket, appointment, serial, and service data.
- [ ] Internal-agent answers can retrieve internal-approved knowledge while
  consumer answers cannot use dealer/internal-only documents.
- [ ] Service bulletin, replacement part, and compatibility answers call
  structured compatibility or parts services instead of relying on RAG alone.
- [ ] Human review queues are available for warranty, safety, dealer support, and
  customer support escalations.
- [ ] Audit records include operation, actor, tenant, market, resource hash,
  escalation status, and Dify conversation/message identifiers.

## P3 Acceptance Checklist

- [ ] Automated eval runs the demo case set and production regression cases on a
  schedule, then reports pass/fail by intent, market, language, and risk level.
- [ ] Recall and safety rules are maintained in an authoritative service with
  versioned approvals and stop-ride escalation behavior.
- [ ] GraphRAG or external retrieval is evaluated only after P0/P1 metadata,
  tool routing, and dynamic data boundaries are passing.
- [ ] Event-driven automations can react to ticket, order, appointment, recall,
  and warranty events without storing dynamic state in Dify knowledge bases.
- [ ] Multi-region rollout verifies market/language policies, legal approvals,
  data residency, and fallback queues per region.

## Data Items Requiring Real External Systems

These data items cannot be accepted from static files alone:

- Product catalog master data: SKU, model, model year, specs, market visibility,
  accessory relationships, and approved product copy.
- Live commercial state: price, discount, promotion, inventory, dealer
  availability, and appointment slots.
- OMS and logistics state: order status, shipment status, tracking status,
  return/refund status, and payment-safe status.
- Dealer and service network: authorized dealer list, service-center
  capabilities, booking URLs, capacity, and geographic coverage.
- Serial and recall state: serial registration, ownership relationship, recall
  hit, theft report, safety flags, and batch rules.
- Warranty rule state: policy version, region, proof of purchase validation,
  evidence/photo references, exclusion rules, decision result, and manual review
  reason.
- Ticket and CRM state: customer profile, lead ownership, consent, ticket ID,
  ticket status, escalation queue, and operator assignment.
- Identity and permission context: storefront session, dealer/internal SSO,
  role claims, tenant/market claims, and row-level access predicates.
- File and vision inputs: uploaded photos/videos, redacted attachment IDs, and
  any approved vision classification output.

## Local Acceptance Standard

Local validation is accepted when all of the following pass:

1. Static asset parsing passes for JSON, YAML, and OpenAPI files.
2. The frontend sample can submit the cases in `tests/demo_chat_cases.json` to
   the configured BFF chat URL.
3. The BFF chat response matches the key fields declared in
   `tests/local_health_contract.json`.
4. Dynamic cases cite `business_api` sources and do not invent price, stock,
   order, warranty, serial, dealer, or appointment state.
5. Battery smoke, fire, swelling, water ingress, brake failure, frame crack,
   recall, and low-confidence warranty cases return non-`not_needed`
   escalation and do not provide unsafe repair instructions.
6. Warranty answers do not approve or reject final coverage without a warranty
   rules service result.
7. Manual review cases expose required missing fields or review reasons and
   route to the correct queue.
8. Feedback can be posted for a returned message and correlated by trace ID.
