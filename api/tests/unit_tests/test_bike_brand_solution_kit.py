"""Quality gates for the bike brand solution kit P0 machine-readable assets."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Iterator, Mapping, Sequence
from pathlib import Path

import pytest
import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
KIT_ROOT = REPO_ROOT / "dev" / "bike_brand_solution_kit"

ASSET_EXTENSIONS = {".json", ".yaml", ".yml"}
REQUIRED_SECTIONS = ("knowledge", "integration", "workflows", "frontend")

REQUIRED_METADATA_FIELDS = {
    "brand",
    "series",
    "model",
    "model_year",
    "language",
    "country",
    "market",
    "audience",
    "channel",
    "bike_type",
    "drive_system_vendor",
    "battery_model",
    "display_model",
    "component_vendor",
    "document_type",
    "policy_type",
    "issue_category",
    "warranty_region",
    "effective_date",
    "valid_until",
    "version",
    "status",
    "risk_level",
    "legal_approved",
    "safety_related",
    "related_part_ids",
    "compatible_model_ids",
}

REQUIRED_OPENAPI_OPERATIONS = {
    ("GET", "/products"),
    ("GET", "/products/{sku}"),
    ("GET", "/compatibility/check"),
    ("GET", "/orders/{order_no}"),
    ("GET", "/dealers/nearby"),
    ("GET", "/serials/{serial_no}"),
    ("GET", "/warranty/rules/check"),
    ("GET", "/service-centers/nearby"),
    ("GET", "/crm/customers/{id}"),
    ("POST", "/crm/leads"),
    ("POST", "/tickets"),
    ("POST", "/warranty/precheck"),
    ("POST", "/appointments/test-ride"),
    ("POST", "/appointments/service"),
    ("POST", "/feedback/escalation"),
}

REQUIRED_WORKFLOW_THEMES = {
    "consumer_support": ("consumer", "support"),
    "sales_recommendation": ("sales", "recommend"),
    "warranty_precheck": ("warranty", "precheck"),
}

SAFETY_TRIGGER_TERMS = {
    "battery",
    "swelling",
    "smoke",
    "fire",
    "burning",
    "odor",
    "water ingress",
    "brake failure",
    "frame crack",
}

ESCALATION_TERMS = {
    "human",
    "escalation",
    "authorized service",
    "dealer",
    "manual review",
    "safety",
}

DIFY_SECRET_PATTERNS = (
    re.compile(r"\bapp-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"dify[_-]?api[_-]?key\s*[:=]\s*['\"][^'\"${<]+['\"]", re.IGNORECASE),
    re.compile(r"authorization\s*[:=]\s*['\"]bearer\s+(?!<|\$\{)[^'\"]+['\"]", re.IGNORECASE),
)


def _asset_files(section: str | None = None) -> list[Path]:
    root = KIT_ROOT / section if section else KIT_ROOT
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in ASSET_EXTENSIONS)


def _text_files(section: str) -> list[Path]:
    root = KIT_ROOT / section
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*") if path.is_file())


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _parse_asset(path: Path) -> object:
    text = _read_text(path)
    if path.suffix.lower() == ".json":
        return json.loads(text)
    return yaml.safe_load(text)


def _walk_values(value: object) -> Iterator[object]:
    yield value
    if isinstance(value, Mapping):
        for key, child in value.items():
            yield key
            yield from _walk_values(child)
    elif isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        for child in value:
            yield from _walk_values(child)


def _all_words(value: object) -> set[str]:
    words: set[str] = set()
    for item in _walk_values(value):
        if isinstance(item, str):
            words.update(re.findall(r"[a-z0-9_/-]+", item.lower()))
    return words


def _combined_text(paths: Iterable[Path]) -> str:
    return "\n".join(_read_text(path).lower() for path in paths)


def _find_openapi_documents() -> list[tuple[Path, Mapping[object, object]]]:
    documents: list[tuple[Path, Mapping[object, object]]] = []
    for path in _asset_files("integration"):
        parsed = _parse_asset(path)
        if isinstance(parsed, Mapping) and "openapi" in parsed and isinstance(parsed.get("paths"), Mapping):
            documents.append((path, parsed))
    return documents


def _find_workflow_manifest() -> tuple[Path, Mapping[object, object]]:
    candidates: list[tuple[Path, Mapping[object, object]]] = []
    for path in _asset_files("workflows"):
        parsed = _parse_asset(path)
        if not isinstance(parsed, Mapping):
            continue
        if "manifest" in path.stem.lower() or "workflows" in parsed or "templates" in parsed:
            candidates.append((path, parsed))

    assert candidates, "workflows must include a machine-readable manifest file"
    return candidates[0]


def _manifest_entries(manifest: Mapping[object, object]) -> list[Mapping[object, object]]:
    raw_entries = manifest.get("workflows", manifest.get("templates"))
    if isinstance(raw_entries, Sequence) and not isinstance(raw_entries, str | bytes | bytearray):
        assert all(isinstance(entry, Mapping) for entry in raw_entries), "workflow manifest entries must be objects"
        return list(raw_entries)

    if isinstance(raw_entries, Mapping):
        entries: list[Mapping[object, object]] = []
        for key, value in raw_entries.items():
            if isinstance(value, Mapping):
                entries.append({"id": key, **value})
            elif isinstance(value, str):
                entries.append({"id": key, "path": value})
        return entries

    raise AssertionError("workflow manifest must define a workflows or templates collection")


def _entry_path(entry: Mapping[object, object]) -> str:
    for key in ("path", "file", "template", "template_path"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
    raise AssertionError(f"workflow manifest entry is missing a template path: {entry}")


def _entry_name(entry: Mapping[object, object]) -> str:
    values = [value for key, value in entry.items() if key in {"id", "name", "type", "slug"} and isinstance(value, str)]
    return " ".join(values).lower()


def test_required_kit_sections_have_machine_readable_assets() -> None:
    assert KIT_ROOT.exists(), f"solution kit root is missing: {KIT_ROOT}"

    for section in REQUIRED_SECTIONS:
        section_root = KIT_ROOT / section
        assert section_root.is_dir(), f"missing required solution kit section: {section_root}"
        assert _asset_files(section), f"{section} must contain at least one JSON or YAML asset"


def test_all_json_yaml_assets_parse_as_utf8() -> None:
    assets = _asset_files()
    assert assets, "solution kit must contain JSON or YAML assets"

    for path in assets:
        try:
            parsed = _parse_asset(path)
        except (UnicodeDecodeError, json.JSONDecodeError, yaml.YAMLError) as exc:
            pytest.fail(f"{path.relative_to(REPO_ROOT)} is not valid UTF-8 {path.suffix} content: {exc}")
        assert parsed is not None, f"{path.relative_to(REPO_ROOT)} must not be empty"


def test_knowledge_metadata_schema_declares_required_p0_fields() -> None:
    parsed_assets = [_parse_asset(path) for path in _asset_files("knowledge")]
    assert parsed_assets, "knowledge must include a machine-readable metadata schema or domain definition"

    discovered_fields: set[str] = set()
    for parsed in parsed_assets:
        discovered_fields.update(_all_words(parsed))

    missing_fields = sorted(REQUIRED_METADATA_FIELDS - discovered_fields)
    assert not missing_fields, "knowledge metadata is missing required fields: " + ", ".join(missing_fields)


def test_integration_openapi_contract_contains_required_business_operations() -> None:
    openapi_documents = _find_openapi_documents()
    assert openapi_documents, "integration must include an OpenAPI JSON/YAML contract"

    available_operations: set[tuple[str, str]] = set()
    for _path, document in openapi_documents:
        paths = document["paths"]
        assert isinstance(paths, Mapping)
        for route, operations in paths.items():
            if not isinstance(route, str) or not isinstance(operations, Mapping):
                continue
            for method, operation in operations.items():
                if not isinstance(method, str) or method.lower() not in {"get", "post", "put", "patch", "delete"}:
                    continue
                assert isinstance(operation, Mapping), f"{method.upper()} {route} must define an operation object"
                assert "operationId" in operation, f"{method.upper()} {route} must define operationId"
                assert "responses" in operation, f"{method.upper()} {route} must define responses"
                available_operations.add((method.upper(), route))

    missing_operations = sorted(REQUIRED_OPENAPI_OPERATIONS - available_operations)
    assert not missing_operations, "OpenAPI contract is missing operations: " + ", ".join(
        f"{method} {route}" for method, route in missing_operations
    )


def test_workflow_manifest_entries_match_existing_templates() -> None:
    manifest_path, manifest = _find_workflow_manifest()
    entries = _manifest_entries(manifest)
    assert entries, "workflow manifest must include at least one workflow template entry"

    entry_names = " ".join(_entry_name(entry) for entry in entries)
    missing_themes = [
        theme
        for theme, required_terms in REQUIRED_WORKFLOW_THEMES.items()
        if not all(term in entry_names for term in required_terms)
    ]
    assert not missing_themes, "workflow manifest is missing required P0 workflows: " + ", ".join(missing_themes)

    for entry in entries:
        template_path = (manifest_path.parent / _entry_path(entry)).resolve()
        assert template_path.exists(), f"workflow manifest points to a missing template: {template_path}"
        assert template_path.is_relative_to((KIT_ROOT / "workflows").resolve())
        assert template_path.suffix.lower() in ASSET_EXTENSIONS, f"workflow template must be JSON/YAML: {template_path}"
        parsed = _parse_asset(template_path)
        assert parsed is not None, f"workflow template must not be empty: {template_path}"


def test_workflow_and_knowledge_assets_define_dangerous_safety_escalation_branch() -> None:
    workflow_text = _combined_text(_text_files("workflows"))
    knowledge_text = _combined_text(_text_files("knowledge"))

    for label, text in (("workflow", workflow_text), ("knowledge", knowledge_text)):
        assert text, f"{label} assets are missing"
        missing_triggers = sorted(term for term in SAFETY_TRIGGER_TERMS if term not in text)
        missing_escalation_terms = sorted(term for term in ESCALATION_TERMS if term not in text)
        assert not missing_triggers, f"{label} assets are missing safety trigger terms: {missing_triggers}"
        assert not missing_escalation_terms, f"{label} assets are missing escalation terms: {missing_escalation_terms}"

    workflow_safety_sentences = re.findall(r"[^.\n]*(?:safety|battery|brake|fire)[^.\n]*", workflow_text)
    assert any(
        any(escalation in sentence for escalation in ESCALATION_TERMS) for sentence in workflow_safety_sentences
    ), "workflow safety branch must explicitly route dangerous cases to escalation or manual review"


def test_frontend_contract_uses_bff_boundary_without_exposing_dify_secrets() -> None:
    frontend_files = _text_files("frontend")
    assert frontend_files, "frontend assets are missing"

    frontend_text = _combined_text(frontend_files)
    for required_term in ("bff", "citation", "feedback"):
        assert required_term in frontend_text, f"frontend assets must document or model {required_term}"
    assert "handoff" in frontend_text or "escalation" in frontend_text, "frontend must model handoff/escalation"

    for path in frontend_files:
        text = _read_text(path)
        leaked_patterns = [pattern.pattern for pattern in DIFY_SECRET_PATTERNS if pattern.search(text)]
        assert not leaked_patterns, f"frontend asset exposes a Dify secret pattern: {path}: {leaked_patterns}"


def test_optional_eval_sets_are_structured_when_present() -> None:
    tests_root = KIT_ROOT / "tests"
    eval_assets = [
        path
        for path in _asset_files("tests")
        if "eval" in path.name.lower() or "evaluation" in path.name.lower() or "golden" in path.name.lower()
    ]
    if not tests_root.exists() or not eval_assets:
        return

    for path in eval_assets:
        parsed = _parse_asset(path)
        records: object
        if isinstance(parsed, Mapping) and isinstance(parsed.get("cases"), Sequence):
            records = parsed["cases"]
        else:
            records = parsed

        assert isinstance(records, Sequence) and not isinstance(records, str | bytes | bytearray)
        assert records, f"eval set must include at least one case: {path}"

        for record in records:
            assert isinstance(record, Mapping), f"eval case must be an object in {path}"
            assert record.get("id"), f"eval case is missing id in {path}"
            assert record.get("input") or record.get("question"), f"eval case is missing input/question in {path}"
            assert record.get("expected") or record.get("expected_answer"), f"eval case is missing expected output in {path}"
            assert isinstance(record.get("metadata"), Mapping), f"eval case is missing metadata object in {path}"
