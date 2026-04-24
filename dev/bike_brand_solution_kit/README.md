# Bike Brand Solution Kit

This kit is the P0 implementation baseline for adapting Dify to a bicycle or
electric bicycle brand. It follows the source proposal at
`C:/Users/tester/Downloads/dify_bike_brand_transformation.md` version 1.0.

The P0 scope keeps brand-specific business logic outside Dify core. Dify remains
the AI orchestration and knowledge-answering layer, while product, order,
dealer, warranty, serial-number, and ticket data stay behind business APIs.

## Acceptance Criteria

- Knowledge domains are split by audience and risk, not stored in one mixed
  dataset.
- Metadata is machine-readable and covers model, model year, market, language,
  audience, risk, warranty region, safety, and version fields.
- Static knowledge and dynamic business state are separated. Prices, inventory,
  orders, tickets, appointments, serial numbers, and warranty decisions must be
  queried through tools or external APIs.
- Workflow templates define intent routing, metadata-filtered retrieval, tool
  handoff, citations, feedback, low-confidence handling, and human escalation.
- High-risk safety and warranty paths must not rely on free-form LLM judgment.
- The frontend sample must call a BFF endpoint and must not expose Dify API keys.
- Tests can parse every JSON/YAML/OpenAPI asset and verify the required safety
  and workflow gates.

## Development Standards

- Keep brand-specific assets under `dev/bike_brand_solution_kit/`.
- Do not patch Dify core for P0 unless a reusable platform bug blocks validation.
- Use stable snake_case keys in JSON/YAML and avoid ambiguous free-text contract
  fields where enums or structured objects are clearer.
- Treat tenant, market, language, audience, and source system as required routing
  context for any business integration.
- Record uncertainty explicitly with confidence, escalation reason, or blocking
  missing fields.
- Do not store personal data in sample assets unless it is synthetic and clearly
  marked.

## Documentation Requirements

- Each subfolder must include a README or manifest explaining purpose, inputs,
  outputs, and how Dify is expected to consume the assets.
- Workflow and integration assets must document required datasets, tools,
  environment variables, and manual escalation conditions.
- Knowledge assets must document required metadata, allowed audiences, chunking
  strategy, and prohibited cross-domain mixing.
- Frontend assets must document BFF boundaries, context injection, citation
  rendering, feedback, and handoff actions.

## Unit Test Requirements

- Add tests in `api/tests/unit_tests/test_bike_brand_solution_kit.py`.
- The test command is:

```bash
uv run --project api pytest api/tests/unit_tests/test_bike_brand_solution_kit.py
```

- Tests must validate:
  - required files exist;
  - JSON and YAML parse successfully;
  - OpenAPI paths from the proposal exist;
  - metadata schema includes all required P0 fields;
  - workflow manifest entries point to existing templates;
  - safety escalation terms exist in workflow and knowledge assets;
  - frontend contracts do not expose Dify API keys to browser callers.

## Local Full-Stack Demo

Use these assets to wire a local storefront page, BFF, Dify app, and mocked or
real business integration service:

- Demo chat cases: `tests/demo_chat_cases.json`.
- Health and connectivity contract: `tests/local_health_contract.json`.
- Startup script: `local/start-local-demo.ps1`.
- Health-check script: `local/healthcheck-local-demo.ps1`.
- Frontend page sample: `frontend/examples/product-page.tsx`.
- Runtime local page after startup: `http://localhost:3000/bike-brand`.
- Browser-facing BFF contract:
  `frontend/contracts/bike-assistant-bff.openapi.yaml`.
- Business API contract: `integration/bike_brand_integration.openapi.yaml`.
- Dify tool mapping: `integration/dify_tool_call_mapping.yaml`.
- Acceptance checklist: `acceptance.md`.

Static validation should still run through:

```bash
uv run --project api pytest api/tests/unit_tests/test_bike_brand_solution_kit.py
```

For local full-stack validation, mount the example product page in the brand
frontend, expose the BFF chat and feedback endpoints, point the BFF to the local
Dify API, and back dynamic product, price, inventory, order, warranty, dealer,
and service-center calls with a mock or real service that follows the business
OpenAPI contract. Then replay `tests/demo_chat_cases.json` against
`POST /api/bike-assistant/chat` and compare the status codes and key fields in
`tests/local_health_contract.json`.

## P0 Deliverables

- `knowledge/`: metadata schema, knowledge domain definitions, ingestion
  checklist, and annotation guardrails.
- `integration/`: business API OpenAPI contract, Dify tool mapping, and safety
  and error handling rules.
- `workflows/`: consumer support, sales recommendation, and warranty precheck
  workflow templates plus a manifest.
- `frontend/`: embeddable assistant sample, BFF request and response contract,
  and integration notes.
- `tests/`: optional local fixtures used by the unit tests.

## Local Demo Startup

Windows PowerShell scripts for local integration startup and health checks live
under `local/`.

```powershell
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\start-local-demo.ps1
powershell -ExecutionPolicy Bypass -File .\dev\bike_brand_solution_kit\local\healthcheck-local-demo.ps1
```

See `local/README-local.md` for prerequisites, options such as `-SkipDocker`,
`-SkipInstall`, `-ApiPort`, and `-WebPort`, log locations, and troubleshooting.
