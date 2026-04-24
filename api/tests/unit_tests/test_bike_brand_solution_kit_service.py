"""Unit gates for the bike brand solution kit service layer.

These tests intentionally avoid database and Redis dependencies. The service is
expected to coordinate static kit metadata, dynamic business tools, safety
escalation, and feedback persistence through injectable collaborators.
"""

from __future__ import annotations

import importlib
import inspect
import sys
from collections.abc import Mapping, Sequence
from dataclasses import asdict, is_dataclass

import pytest


SERVICE_MODULE_CANDIDATES = (
    "services.bike_brand_solution_kit_service",
    "services.bike_brand.solution_kit_service",
    "services.bike_brand_solution_kit",
)


def _load_service_class() -> type[object]:
    import_errors: list[str] = []
    for module_name in SERVICE_MODULE_CANDIDATES:
        try:
            module = importlib.import_module(module_name)
        except ModuleNotFoundError as exc:
            import_errors.append(f"{module_name}: {exc}")
            continue

        service_class = getattr(module, "BikeBrandSolutionKitService", None)
        if inspect.isclass(service_class):
            return service_class

        import_errors.append(f"{module_name}: missing BikeBrandSolutionKitService")

    pytest.fail("Bike brand solution kit service is missing. Tried: " + "; ".join(import_errors))


def _instantiate_service() -> object:
    service_class = _load_service_class()
    signature = inspect.signature(service_class)
    kwargs = {"trace_id_factory": lambda: "srv-test-trace"} if "trace_id_factory" in signature.parameters else {}
    return service_class(**kwargs)


def _to_mapping(value: object) -> Mapping[str, object]:
    if isinstance(value, Mapping):
        return value
    if is_dataclass(value) and not isinstance(value, type):
        return asdict(value)
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        assert isinstance(dumped, Mapping)
        return dumped
    if hasattr(value, "dict"):
        dumped = value.dict()
        assert isinstance(dumped, Mapping)
        return dumped
    if hasattr(value, "__dict__"):
        return vars(value)
    raise AssertionError(f"Expected mapping-like response, got {type(value)!r}")


def _nested_values(value: object) -> list[object]:
    if isinstance(value, Mapping):
        nested: list[object] = []
        for key, child in value.items():
            nested.append(key)
            nested.extend(_nested_values(child))
        return nested
    if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        nested = []
        for child in value:
            nested.extend(_nested_values(child))
        return nested
    if is_dataclass(value) and not isinstance(value, type):
        return _nested_values(asdict(value))
    if hasattr(value, "model_dump"):
        return _nested_values(value.model_dump())
    if hasattr(value, "__dict__") and not isinstance(value, type):
        return _nested_values(vars(value))
    return [value]


def _combined_text(value: object) -> str:
    return " ".join(str(item).lower() for item in _nested_values(value))


def _call_first(service: object, method_names: Sequence[str], payload: object | None = None) -> object:
    for method_name in method_names:
        method = getattr(service, method_name, None)
        if not callable(method):
            continue
        if payload is None:
            return method()
        return method(payload)

    pytest.fail(f"Service is missing one of methods: {', '.join(method_names)}")


@pytest.fixture
def service_fixture() -> object:
    return _instantiate_service()


def _service_module(service: object) -> object:
    return sys.modules[service.__class__.__module__]


def _chat_payload(service: object, message: str) -> object:
    module = _service_module(service)
    context_data = {
        "sku": "URB-E-500-2025-M",
        "market": "north-america",
        "language": "en-US",
        "user_type": "consumer",
        "session_id": "bike-test-session",
    }
    context_class = getattr(module, "ChatContext", None)
    request_class = getattr(module, "ChatRequest", None)
    if inspect.isclass(context_class) and inspect.isclass(request_class):
        return request_class(message=message, context=context_class(**context_data))
    return {"message": message, "context": context_data}


def _feedback_payload(service: object) -> object:
    module = _service_module(service)
    request_class = getattr(module, "FeedbackRequest", None)
    payload = {
        "message_id": "msg-1",
        "rating": "up",
        "comment": "Helpful citation list",
    }
    if inspect.isclass(request_class):
        return request_class(**payload)
    return payload


def test_service_summary_exposes_required_solution_kit_capabilities(
    service_fixture: object,
) -> None:
    service = service_fixture

    summary = _call_first(service, ("get_summary", "summary", "summarize"))
    text = _combined_text(summary)

    for required in ("knowledge", "integration", "workflow", "frontend", "feedback"):
        assert required in text
    assert "dynamic" in text or "business api" in text
    assert "escalation" in text or "human" in text


def test_service_assets_include_static_kit_files_by_section(
    service_fixture: object,
) -> None:
    service = service_fixture

    get_assets = getattr(service, "get_assets", None) or getattr(service, "list_assets", None)
    assert callable(get_assets), "Service is missing get_assets/list_assets"
    assets = [get_assets(section) for section in ("knowledge", "integration", "workflows", "frontend")]

    text = _combined_text(assets)
    for required in ("knowledge", "integration", "workflows", "frontend"):
        assert required in text
    assert ".json" in text
    assert ".yaml" in text or ".yml" in text
    assert "openapi" in text


def test_chat_escalates_battery_safety_requests_without_db_or_redis(
    service_fixture: object,
) -> None:
    service = service_fixture

    response = _call_first(
        service,
        ("chat", "create_chat_turn", "respond"),
        _chat_payload(service, "My e-bike battery is swelling, smells like smoke, and feels hot."),
    )
    mapped = _to_mapping(response)
    text = _combined_text(mapped)

    assert "battery" in text or mapped.get("intent") == "battery_safety"
    assert "escalation" in text
    assert "required" in text or "battery_safety" in text
    assert "authorized" in text or "manual review" in text or "stop" in text


def test_chat_uses_dynamic_business_tool_message_for_order_status(
    service_fixture: object,
) -> None:
    service = service_fixture

    response = _call_first(
        service,
        ("chat", "create_chat_turn", "respond"),
        _chat_payload(service, "Where is order BKE-1001?"),
    )
    text = _combined_text(response)

    assert "live tool" in text or "business api" in text
    assert "business_api" in text or "order_status" in text
    assert "static knowledge" in text


def test_feedback_submission_returns_accepted_status(
    service_fixture: object,
) -> None:
    service = service_fixture

    result = _call_first(
        service,
        ("submit_feedback", "create_feedback", "record_feedback", "feedback"),
        _feedback_payload(service),
    )
    text = _combined_text(result)

    assert "accepted" in text or _to_mapping(result).get("accepted") is True
