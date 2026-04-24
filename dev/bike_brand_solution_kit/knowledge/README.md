# Bike Brand Knowledge Assets

This directory contains P0 knowledge-engineering assets for the bicycle and e-bike Dify transformation work.

## Files

- `metadata.schema.json`: strict JSON Schema for per-chunk metadata.
- `knowledge_domains.schema.json`: JSON Schema for the domain definition file.
- `knowledge_domains.json`: six P0 knowledge domains, audience boundaries, chunking strategy, retrieval strategy, required metadata, and prohibited mixing rules.
- `annotation_guardrails.schema.json`: JSON Schema for annotation-first guardrail categories.
- `annotation_guardrails.json`: high-risk Annotation fallback rules for safety, recall, and warranty topics.
- `ingestion_checklist.schema.json`: JSON Schema for the P0 ingestion checklist.
- `ingestion_checklist.json`: blocking checklist for metadata completeness, redaction, approval, lifecycle, chunking, retrieval, and annotation readiness.

## Static Validation Expectations

1. Validate every JSON file is syntactically valid UTF-8 JSON.
2. Validate `knowledge_domains.json` against `knowledge_domains.schema.json`.
3. Validate `annotation_guardrails.json` against `annotation_guardrails.schema.json`.
4. Validate `ingestion_checklist.json` against `ingestion_checklist.schema.json`.
5. Validate each future chunk metadata object against `metadata.schema.json`.
6. Cross-check future chunk metadata with `knowledge_domains.json`:
   - `knowledge_domain` exists.
   - `audience` is allowed by that domain.
   - `document_type` is allowed by that domain.
   - all domain-level `required_metadata` fields are present.
7. Enforce `annotation_guardrails.json` before production retrieval for matched high-risk safety, recall, and warranty questions.
