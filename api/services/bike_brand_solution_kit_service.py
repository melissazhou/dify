"""Read-only demo service for the bike brand solution kit assets.

This module intentionally stays outside tenant, database, Redis, and session
state. It exists only to expose the machine-readable P0 assets under
``dev/bike_brand_solution_kit`` to a local frontend demo and to simulate the
browser-facing BFF chat and feedback contracts.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Literal, cast

from pydantic import BaseModel, ConfigDict, Field


REPO_ROOT = Path(__file__).resolve().parents[2]
KIT_ROOT = REPO_ROOT / "dev" / "bike_brand_solution_kit"
ASSET_SECTIONS = ("knowledge", "integration", "workflows", "frontend")
MACHINE_READABLE_SUFFIXES = {".json", ".yaml", ".yml"}
OPENAPI_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
HIGH_RISK_TERMS = (
    "battery smoke",
    "smoke",
    "fire",
    "swelling",
    "water ingress",
    "brake failure",
    "frame crack",
)
LIVE_TOOL_TERMS = (
    "price",
    "pricing",
    "inventory",
    "stock",
    "available",
    "availability",
    "order",
    "shipment",
    "shipping status",
    "warranty decision",
    "warranty approval",
    "covered by warranty",
    "eligible for warranty",
)


AssetSection = Literal["knowledge", "integration", "workflows", "frontend"]
ChatIntent = Literal[
    "pre_sales",
    "product_recommendation",
    "accessory_compatibility",
    "order_status",
    "return_refund",
    "warranty",
    "troubleshooting",
    "battery_safety",
    "dealer_service",
    "human_escalation",
    "other",
]
FeedbackRating = Literal["up", "down"]


class BikeBrandSolutionKitError(RuntimeError):
    """Raised when the local demo assets cannot be read or parsed."""


class StrictDTO(BaseModel):
    """Base DTO for local demo API payloads."""

    model_config = ConfigDict(extra="forbid")


class SectionSummary(StrictDTO):
    section: AssetSection
    path: str
    file_count: int
    machine_readable_count: int


class WorkflowTemplateSummary(StrictDTO):
    id: str
    file: str
    mode: str
    purpose: str
    required_datasets: list[str]
    required_tools: list[str]


class SolutionKitSummary(StrictDTO):
    sections: list[SectionSummary]
    asset_counts: dict[str, int]
    openapi_operation_count: int
    workflow_templates: list[WorkflowTemplateSummary]
    acceptance_points: list[str]
    warnings: list[str]


class AssetMetadata(StrictDTO):
    top_level_keys: list[str]
    title: str | None = None
    version: str | None = None
    openapi_version: str | None = None
    path_count: int | None = None
    operation_count: int | None = None
    domain_count: int | None = None
    checklist_count: int | None = None
    template_count: int | None = None
    schema_id: str | None = None


class AssetFile(StrictDTO):
    path: str
    name: str
    extension: str
    size_bytes: int
    machine_readable: bool
    metadata: AssetMetadata | None


class AssetsResponse(StrictDTO):
    section: AssetSection
    root: str
    files: list[AssetFile]
    warnings: list[str]


class ChatContext(StrictDTO):
    sku: str | None = Field(default=None, max_length=120)
    market: str | None = Field(default=None, max_length=80)
    language: str | None = Field(default="en-US", max_length=32)
    user_type: str | None = Field(default="consumer", max_length=80)
    session_id: str | None = Field(default=None, max_length=128)


class ChatRequest(StrictDTO):
    message: str = Field(..., min_length=1, max_length=4000)
    context: ChatContext = Field(default_factory=ChatContext)


class Citation(StrictDTO):
    id: str
    title: str
    source_type: Literal["knowledge_base", "manual", "policy", "service_bulletin", "business_api"]
    source_uri: str
    document_version: str | None = None
    market: str | None = None
    language: str | None = None
    snippet: str


class NextAction(StrictDTO):
    type: Literal[
        "book_service",
        "create_ticket",
        "start_warranty_precheck",
        "find_dealer",
        "request_human",
        "collect_missing_context",
    ]
    label: str
    requires_confirmation: bool


class Escalation(StrictDTO):
    required: bool
    reason: str | None
    queue: Literal["customer_support", "warranty", "battery_safety", "dealer_support"] | None = None
    required_fields: list[str]


class ChatResponse(StrictDTO):
    answer: str
    intent: ChatIntent
    confidence: float = Field(..., ge=0, le=1)
    citations: list[Citation]
    next_actions: list[NextAction]
    escalation: Escalation
    source: Literal["local_demo"] = "local_demo"
    message_id: str
    session_id: str | None


class FeedbackRequest(StrictDTO):
    message_id: str = Field(..., min_length=1, max_length=128)
    rating: FeedbackRating
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackResponse(StrictDTO):
    accepted: bool
    audit_id: str
    source: Literal["local_demo"] = "local_demo"


class BikeBrandSolutionKitService:
    """Coordinates read-only access to local bike brand demo assets."""

    root: Path

    def __init__(self, root: Path = KIT_ROOT) -> None:
        self.root = root

    def get_summary(self) -> SolutionKitSummary:
        """Return aggregate status for the solution kit without loading large file bodies into the response."""

        warnings = self._base_warnings()
        sections = [self._section_summary(section) for section in ASSET_SECTIONS]
        manifest = self._load_manifest(warnings)

        return SolutionKitSummary(
            sections=sections,
            asset_counts={summary.section: summary.file_count for summary in sections},
            openapi_operation_count=self._openapi_operation_count(warnings),
            workflow_templates=self._workflow_templates(manifest),
            acceptance_points=self._acceptance_points(manifest),
            warnings=warnings,
        )

    def get_assets(self, section: AssetSection) -> AssetsResponse:
        """Return a section file listing plus compact parsed metadata for JSON, YAML, and OpenAPI assets."""

        warnings = self._base_warnings()
        section_root = self.root / section
        if not section_root.is_dir():
            warnings.append(f"Missing solution kit section: {self._relative_path(section_root)}")
            return AssetsResponse(section=section, root=self._relative_path(section_root), files=[], warnings=warnings)

        files: list[AssetFile] = []
        for path in sorted(item for item in section_root.rglob("*") if item.is_file()):
            metadata: AssetMetadata | None = None
            machine_readable = path.suffix.lower() in MACHINE_READABLE_SUFFIXES
            if machine_readable:
                parsed = self._parse_asset(path)
                metadata = self._metadata_for(parsed)
            files.append(
                AssetFile(
                    path=self._relative_path(path),
                    name=path.name,
                    extension=path.suffix.lower(),
                    size_bytes=path.stat().st_size,
                    machine_readable=machine_readable,
                    metadata=metadata,
                )
            )

        return AssetsResponse(section=section, root=self._relative_path(section_root), files=files, warnings=warnings)

    def chat(self, request: ChatRequest) -> ChatResponse:
        """Simulate a local BFF chat turn using deterministic policy and asset citations."""

        normalized_message = request.message.lower()
        high_risk_terms = [term for term in HIGH_RISK_TERMS if term in normalized_message]
        requires_live_tool = any(term in normalized_message for term in LIVE_TOOL_TERMS)
        intent = self._classify_intent(normalized_message, high_risk=bool(high_risk_terms))

        if high_risk_terms:
            answer = (
                "This is a safety-sensitive issue. Stop using the bike or affected component, keep it away from "
                "charging or riding use, and contact an authorized service provider for inspection. This local demo "
                "routes the case to manual review instead of giving repair steps."
            )
            is_battery_safety = any(term in normalized_message for term in ("battery", "smoke", "fire"))
            escalation = Escalation(
                required=True,
                reason="safety_risk:" + ",".join(high_risk_terms),
                queue="battery_safety" if is_battery_safety else "customer_support",
                required_fields=["model", "model_year", "serial_no", "country_or_market", "photos_or_video"],
            )
            next_actions = [
                NextAction(type="book_service", label="Find authorized service", requires_confirmation=False),
                NextAction(type="request_human", label="Request manual review", requires_confirmation=True),
            ]
            confidence = 0.92
        elif requires_live_tool:
            answer = (
                "The solution kit separates static knowledge from live business state. Price, inventory, order status, "
                "serial checks, and final warranty decisions must come from a live tool or business API before the "
                "assistant can give an authoritative answer."
            )
            escalation = Escalation(required=False, reason=None, queue=None, required_fields=[])
            next_actions = self._live_tool_actions(intent)
            confidence = 0.84
        else:
            answer = (
                "This local demo can answer from the P0 solution kit structure and cite the relevant knowledge, "
                "workflow, and integration assets. For production, the Dify app should retrieve metadata-filtered "
                "knowledge and call business tools for dynamic state."
            )
            escalation = Escalation(required=False, reason=None, queue=None, required_fields=[])
            next_actions = [
                NextAction(
                    type="collect_missing_context",
                    label="Collect model and market context",
                    requires_confirmation=False,
                )
            ]
            confidence = 0.76

        return ChatResponse(
            answer=answer,
            intent=intent,
            confidence=confidence,
            citations=self._citations(intent, request.context),
            next_actions=next_actions,
            escalation=escalation,
            message_id=self._message_id(request.message, request.context.session_id),
            session_id=request.context.session_id,
        )

    def feedback(self, request: FeedbackRequest) -> FeedbackResponse:
        """Accept local demo feedback without persistence and return an audit correlation id."""

        seed = f"{request.message_id}:{request.rating}:{request.comment or ''}:{uuid.uuid4().hex}"
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]
        return FeedbackResponse(accepted=True, audit_id=f"bike_demo_feedback_{digest}")

    def _section_summary(self, section: AssetSection) -> SectionSummary:
        section_root = self.root / section
        files = [path for path in section_root.rglob("*") if path.is_file()] if section_root.is_dir() else []
        return SectionSummary(
            section=section,
            path=self._relative_path(section_root),
            file_count=len(files),
            machine_readable_count=sum(1 for path in files if path.suffix.lower() in MACHINE_READABLE_SUFFIXES),
        )

    def _base_warnings(self) -> list[str]:
        if self.root.is_dir():
            return []
        return [f"Solution kit root is missing: {self._relative_path(self.root)}"]

    def _load_manifest(self, warnings: list[str]) -> Mapping[str, object]:
        path = self.root / "workflows" / "workflow_manifest.json"
        if not path.is_file():
            warnings.append(f"Workflow manifest is missing: {self._relative_path(path)}")
            return {}
        parsed = self._parse_asset(path)
        if isinstance(parsed, Mapping):
            return {str(key): value for key, value in parsed.items()}
        warnings.append(f"Workflow manifest must be a JSON object: {self._relative_path(path)}")
        return {}

    def _workflow_templates(self, manifest: Mapping[str, object]) -> list[WorkflowTemplateSummary]:
        templates = manifest.get("templates")
        if not isinstance(templates, Sequence) or isinstance(templates, str | bytes | bytearray):
            return []

        result: list[WorkflowTemplateSummary] = []
        for template in templates:
            if not isinstance(template, Mapping):
                continue
            result.append(
                WorkflowTemplateSummary(
                    id=self._string_value(template, "id"),
                    file=self._string_value(template, "file"),
                    mode=self._string_value(template, "mode"),
                    purpose=self._string_value(template, "purpose"),
                    required_datasets=self._string_list(template.get("required_datasets")),
                    required_tools=self._tool_names(template.get("required_tools")),
                )
            )
        return result

    def _acceptance_points(self, manifest: Mapping[str, object]) -> list[str]:
        return self._string_list(manifest.get("p0_acceptance_points"))

    def _openapi_operation_count(self, warnings: list[str]) -> int:
        count = 0
        for path in self.root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in MACHINE_READABLE_SUFFIXES:
                continue
            parsed = self._parse_asset(path)
            if not self._is_openapi_document(parsed):
                continue
            count += self._count_openapi_operations(parsed)
        if count == 0:
            warnings.append("No OpenAPI operations were discovered in solution kit assets.")
        return count

    def _parse_asset(self, path: Path) -> object:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            message = f"Unable to read solution kit asset {self._relative_path(path)}: {exc}"
            raise BikeBrandSolutionKitError(message) from exc

        suffix = path.suffix.lower()
        try:
            if suffix == ".json":
                return cast(object, json.loads(text))
            if suffix in {".yaml", ".yml"}:
                safe_load = self._yaml_safe_load()
                return safe_load(text)
        except (json.JSONDecodeError, BikeBrandSolutionKitError):
            raise
        except Exception as exc:
            raise BikeBrandSolutionKitError(f"Unable to parse asset {self._relative_path(path)}: {exc}") from exc

        return None

    def _yaml_safe_load(self) -> Callable[[str], object]:
        try:
            import yaml
        except ImportError as exc:
            raise BikeBrandSolutionKitError(
                "PyYAML is required to parse bike brand solution kit YAML assets. "
                "Install or enable the repository's existing yaml package before calling this demo API."
            ) from exc
        return cast(Callable[[str], object], yaml.safe_load)

    def _metadata_for(self, parsed: object) -> AssetMetadata:
        if not isinstance(parsed, Mapping):
            return AssetMetadata(top_level_keys=[])

        string_keys = sorted(str(key) for key in parsed.keys())
        title = self._title(parsed)
        version = self._version(parsed)
        openapi_version = self._optional_string(parsed.get("openapi"))
        operation_count = self._count_openapi_operations(parsed) if self._is_openapi_document(parsed) else None
        paths = parsed.get("paths")
        domains = parsed.get("domains")
        checklist = parsed.get("checklist")
        templates = parsed.get("templates")

        return AssetMetadata(
            top_level_keys=string_keys,
            title=title,
            version=version,
            openapi_version=openapi_version,
            path_count=len(paths) if isinstance(paths, Mapping) else None,
            operation_count=operation_count,
            domain_count=len(domains) if isinstance(domains, Mapping) else None,
            checklist_count=len(checklist) if self._is_sequence(checklist) else None,
            template_count=len(templates) if self._is_sequence(templates) else None,
            schema_id=self._optional_string(parsed.get("$schema")),
        )

    def _title(self, parsed: Mapping[object, object]) -> str | None:
        info = parsed.get("info")
        if isinstance(info, Mapping):
            return self._optional_string(info.get("title"))
        return self._optional_string(parsed.get("title"))

    def _version(self, parsed: Mapping[object, object]) -> str | None:
        info = parsed.get("info")
        if isinstance(info, Mapping):
            value = self._optional_string(info.get("version"))
            if value is not None:
                return value
        return self._optional_string(parsed.get("version"))

    def _is_openapi_document(self, parsed: object) -> bool:
        return isinstance(parsed, Mapping) and "openapi" in parsed and isinstance(parsed.get("paths"), Mapping)

    def _count_openapi_operations(self, parsed: Mapping[object, object]) -> int:
        paths = parsed.get("paths")
        if not isinstance(paths, Mapping):
            return 0

        count = 0
        for operations in paths.values():
            if not isinstance(operations, Mapping):
                continue
            count += sum(
                1
                for method in operations.keys()
                if isinstance(method, str) and method.lower() in OPENAPI_METHODS
            )
        return count

    def _classify_intent(self, normalized_message: str, *, high_risk: bool) -> ChatIntent:
        if high_risk:
            if any(term in normalized_message for term in ("battery", "smoke", "fire")):
                return "battery_safety"
            return "troubleshooting"
        if "order" in normalized_message or "shipment" in normalized_message:
            return "order_status"
        if "warranty" in normalized_message:
            return "warranty"
        if "price" in normalized_message or "inventory" in normalized_message or "stock" in normalized_message:
            return "product_recommendation"
        if "compatib" in normalized_message or "fit" in normalized_message:
            return "accessory_compatibility"
        if "dealer" in normalized_message or "service center" in normalized_message:
            return "dealer_service"
        if "return" in normalized_message or "refund" in normalized_message:
            return "return_refund"
        if "recommend" in normalized_message:
            return "product_recommendation"
        if "troubleshoot" in normalized_message or "error code" in normalized_message:
            return "troubleshooting"
        return "other"

    def _live_tool_actions(self, intent: ChatIntent) -> list[NextAction]:
        if intent == "order_status":
            return [
                NextAction(
                    type="collect_missing_context",
                    label="Collect order verification",
                    requires_confirmation=False,
                )
            ]
        if intent == "warranty":
            return [
                NextAction(type="start_warranty_precheck", label="Start warranty precheck", requires_confirmation=True),
                NextAction(type="request_human", label="Request warranty review", requires_confirmation=True),
            ]
        return [NextAction(type="find_dealer", label="Check live price and availability", requires_confirmation=False)]

    def _citations(self, intent: ChatIntent, context: ChatContext) -> list[Citation]:
        citations = [
            Citation(
                id="workflow_manifest",
                title="Workflow manifest",
                source_type="knowledge_base",
                source_uri="dev/bike_brand_solution_kit/workflows/workflow_manifest.json",
                document_version="1.0",
                market=context.market,
                language=context.language,
                snippet="Defines workflow templates, safety policies, business tool handoff, and P0 acceptance points.",
            )
        ]

        if intent in {"battery_safety", "troubleshooting", "warranty"}:
            citations.append(
                Citation(
                    id="annotation_guardrails",
                    title="Annotation guardrails",
                    source_type="policy",
                    source_uri="dev/bike_brand_solution_kit/knowledge/annotation_guardrails.json",
                    document_version="1.0.0",
                    market=context.market,
                    language=context.language,
                    snippet=(
                        "Routes high-risk safety and warranty categories to annotations, rules services, "
                        "or human review."
                    ),
                )
            )

        if intent in {"order_status", "product_recommendation", "accessory_compatibility", "warranty"}:
            citations.append(
                Citation(
                    id="integration_openapi",
                    title="Bike brand business integration API",
                    source_type="business_api",
                    source_uri="dev/bike_brand_solution_kit/integration/bike_brand_integration.openapi.yaml",
                    document_version="1.0.0",
                    market=context.market,
                    language=context.language,
                    snippet=(
                        "Defines live business API tools for product, order, serial, warranty, ticket, "
                        "appointment, and feedback state."
                    ),
                )
            )

        return citations

    def _message_id(self, message: str, session_id: str | None) -> str:
        seed = f"{session_id or 'anonymous'}:{message}:{uuid.uuid4().hex}"
        return "bike_demo_msg_" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]

    def _relative_path(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()
        except ValueError:
            return path.as_posix()

    @staticmethod
    def _is_sequence(value: object) -> bool:
        return isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray)

    @staticmethod
    def _optional_string(value: object) -> str | None:
        return value if isinstance(value, str) else None

    @staticmethod
    def _string_value(mapping: Mapping[object, object], key: str) -> str:
        value = mapping.get(key)
        return value if isinstance(value, str) else ""

    @classmethod
    def _string_list(cls, value: object) -> list[str]:
        if not cls._is_sequence(value):
            return []
        return [item for item in value if isinstance(item, str)]

    @classmethod
    def _tool_names(cls, value: object) -> list[str]:
        if not cls._is_sequence(value):
            return []
        names: list[str] = []
        for item in value:
            if isinstance(item, Mapping):
                name = item.get("name")
                if isinstance(name, str):
                    names.append(name)
            elif isinstance(item, str):
                names.append(item)
        return names
