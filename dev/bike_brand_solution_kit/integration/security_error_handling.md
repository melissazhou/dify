# Bike Brand Integration Security and Error Handling

Version: 1.0.0

Scope: `bike_brand_integration.openapi.yaml` and Dify tool calls configured from `dify_tool_call_mapping.yaml`.

This specification defines the minimum behavior for the business integration layer used by Dify workflows. It is written as implementation acceptance criteria for a brand BFF, integration gateway, Dify HTTP Request nodes, Dify tool plugins, and downstream business services.

## Security Baseline

### Authentication

- Every endpoint must require a server-side bearer token and `X-Gateway-Api-Key`.
- Browser clients and public Dify WebApp clients must never receive `X-Gateway-Api-Key`.
- Tokens must include tenant, market, actor type, subject, scopes, expiry, issuer, and audience.
- The gateway must reject expired, unsigned, wrong-audience, wrong-issuer, or replayed tokens.
- Write endpoints must support `idempotency_key` in the JSON body and reject conflicting retries with `409`.

### Authorization

- The integration service must enforce scopes from the OpenAPI operation security block.
- Consumer actors may only read their own authorized order, serial, appointment, ticket, or CRM context.
- Dealer actors may only access resources assigned to their dealer account, market, and brand tenant.
- Support and internal actors require explicit role scopes and must be audited.
- `404` may be returned instead of `403` when revealing resource existence would leak data.

### Tenant, Market, and Audience Isolation

- `X-Tenant-Id`, `X-Market`, `X-Actor-Type`, and `X-Request-Id` are required for every endpoint.
- Header values must match token claims. Header-only isolation is not sufficient.
- Downstream queries must include tenant and market predicates, not just filter results after querying.
- Product, warranty, dealer, service-center, CRM, and order data must not cross tenant or market boundaries.
- Consumer, dealer, and internal knowledge or business data must not be mixed in the same answer unless the actor is authorized for both audiences.

### PII Minimization

- Read endpoints must return masked contact data only, for example `email_masked`, `phone_masked`, or `tracking_no_masked`.
- Raw email, phone, proof of purchase, exact address, photos, and free-form transcripts may only be sent to write endpoints that require them.
- Dify context fields must use redacted summaries, not raw conversation transcripts.
- Serial numbers, order numbers, customer IDs, and attachment IDs must be treated as sensitive identifiers and redacted in logs.
- Location coordinates must be transient unless a separate consent system records permission to store them.

### Dynamic Data and Knowledge Base Rules

The following data must never be imported into Dify static knowledge bases:

- Price, discount, promotion, quote, stock, inventory, and dealer availability.
- Order status, shipping status, tracking, return, refund, or payment state.
- CRM customer state, customer contact details, membership tier, lead ownership, or consent state.
- Serial registration, recall hit, theft report, or owner relationship.
- Warranty rule result, warranty precheck, claim evidence, photos, or final claim outcome.
- Ticket status, appointment slots, appointment confirmations, and service-center capacity.

Dify may summarize dynamic API output in the current answer. Future answers must perform a fresh tool call unless the workflow has an explicit short-lived session cache outside the knowledge base.

## Error Contract

All errors must use the OpenAPI `ErrorResponse` schema:

- `error.code`: stable machine-readable code.
- `error.message`: user-safe or operator-safe message depending on channel.
- `error.details[]`: field-level validation issues when safe.
- `error.retryable`: whether automated retry is allowed.
- `error.retry_after_seconds`: present when retry timing is known.
- `error.escalation_required`: whether Dify must route to human handling.
- `error.escalation_reason`: normalized reason for handoff.
- `meta.request_id`: correlation ID.
- `meta.kb_cache_allowed`: always `false`.
- `meta.audit`: redacted audit context.

## Status Code Behavior

### 401 Unauthorized

Use when authentication is missing, invalid, expired, wrong-audience, or cannot be verified.

Dify behavior:

- Do not ask the user for credentials in chat.
- Tell the user the session cannot access the requested account data.
- Trigger `feedback_escalation_create` only if the workflow requires account support or the user requests a human.

### 403 Forbidden

Use when the actor is authenticated but lacks scope, tenant, market, dealer, role, or resource permission.

Dify behavior:

- Do not disclose hidden resource details.
- Offer a safe next step such as signing in with the correct account, contacting the dealer, or human support.
- Escalate for dealer/internal workflows where access looks misconfigured.

### 404 Not Found

Use when the resource does not exist or is intentionally hidden from this actor.

Dify behavior:

- Ask the user to verify the identifier once when appropriate.
- Do not enumerate possible matching resources.
- Escalate after repeated failure for order, serial, recall, warranty, or ticket workflows.

### 409 Conflict

Use for duplicate idempotency key with different payload, appointment slot race, duplicate lead, existing ticket, or invalid state transition.

Dify behavior:

- For duplicate create operations, use the returned safe status if available.
- For appointment conflicts, ask the user to choose another slot.
- For warranty, safety, legal, or complaint conflicts, escalate.

### 422 Validation Error

Use when required fields, formats, ranges, business prerequisites, consent, or attachment redaction status are invalid.

Dify behavior:

- Ask only for the missing fields needed to continue.
- Do not request excessive PII.
- Do not create CRM leads, tickets, warranty prechecks, or appointments without required consent where applicable.

### 429 Rate Limited

Use when actor, tenant, IP, endpoint, or abuse-protection limits are exceeded.

Dify behavior:

- Respect `Retry-After`.
- Do not loop retries inside a workflow.
- Offer human support for urgent safety, warranty, or order exception scenarios.

### 5xx Server or Upstream Error

Use for internal failures, upstream dependency failures, and upstream timeouts. Prefer specific `error.code` values:

- `UPSTREAM_TIMEOUT`
- `UPSTREAM_UNAVAILABLE`
- `INTERNAL_ERROR`

Dify behavior:

- Retry at most once for idempotent `GET` calls when `retryable=true`.
- Do not retry non-idempotent write calls unless the same `idempotency_key` is used.
- Escalate if the failed operation blocks order, warranty, safety, appointment, or CRM write completion.

## Timeout Policy

- Dify HTTP/tool node timeout: 10 seconds default.
- Product, dealer, and service-center reads: 3 second target, 8 second hard timeout.
- Order, serial, compatibility, and warranty rule reads: 5 second target, 10 second hard timeout.
- CRM, ticket, warranty precheck, and appointment writes: 8 second target, 15 second hard timeout.
- Gateway must return `UPSTREAM_TIMEOUT` rather than allowing Dify workflow execution to hang.
- Tool responses must be bounded in size. Large transcripts, photos, documents, and evidence files must be passed as attachment references only.

## Redaction and Logging

### Must Redact

- Email, phone, full name when not required for the operator view.
- Full street address and exact geolocation.
- Full order number in general logs where partial masking is sufficient.
- Full serial number except in the downstream system that needs it.
- Tracking numbers, proof of purchase, payment references, and uploaded photo metadata.
- Access tokens, API keys, cookies, authorization headers, and signed URLs.

### Audit Fields

Every successful and failed call must record:

- `request_id`
- `tenant_id`
- `market`
- `actor_type`
- `actor_id_hash`
- `channel`
- `operation_id`
- `resource_type`
- `resource_id_hash`
- `decision_result` when a rule service returns a decision
- `escalation_required`
- `error.code` when failed
- `dify_conversation_id` and `dify_message_id` when present

Audit records must be append-only, access-controlled, and retained according to brand policy. They must not be used as Dify KB source documents.

## Low Confidence and Human Escalation

Dify must escalate instead of generating an unverified answer when:

- Compatibility result is `unknown`, confidence is below `0.8`, or the result is safety-related.
- Warranty result is `needs_review`, confidence is below `0.8`, or evidence is missing.
- Serial response indicates recall, theft report, safety flags, or confidence below `0.8`.
- Any safety issue involves battery swelling, smoke, fire, burning smell, water ingress, short circuit, brake failure, frame crack, injury, crash, or stop-ride guidance.
- A legal complaint, accident, injury, chargeback, or regulator-related topic appears.
- User explicitly requests a human.
- Upstream system is unavailable and the blocked workflow involves order, warranty, safety, CRM write, ticket creation, or appointment booking.

The answer must clearly state that a human handoff is being started and avoid unsupported final decisions.

## Dify Workflow Requirements

- Use parameter extraction for SKU, serial number, order number, postal code, dates, part category, and issue category.
- Use question classification before tool selection.
- Prefer rule-backed tools over RAG for compatibility, warranty, serial, recall, order, CRM, and appointment state.
- Use RAG only for static policies, manuals, FAQs, safety-approved statements, and service guidance.
- Include citations or source references for static policy answers.
- For dynamic tool answers, cite the business source type or system label, not hidden internal IDs.
- Never let an LLM override structured rule results from compatibility, serial, warranty, or safety tools.

## Implementation Checklist

- OpenAPI validates as 3.1 and every path has an `operationId`.
- Every operation has tenant, market, actor, request ID, auth, and error responses.
- Every response includes `meta.kb_cache_allowed=false`.
- Write request schemas include idempotency and consent when PII/contact is collected.
- Responses expose masked PII only unless the endpoint is a controlled write input.
- Error handling maps 401, 403, 404, 409, 422, 429, and 5xx to deterministic workflow behavior.
- Mapping file defines intent, input source, answer usage, forbidden use, and escalation rules for each operation.
