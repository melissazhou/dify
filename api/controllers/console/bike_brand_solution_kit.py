"""FastOpenAPI routes for the bike brand solution kit local demo.

These endpoints are intentionally unauthenticated and stateless because they
serve only local demo assets from ``dev/bike_brand_solution_kit``. Controllers
must keep business rules in the service layer and avoid database/session access.
"""

from controllers.fastopenapi import console_router
from services.bike_brand_solution_kit_service import (
    AssetSection,
    AssetsResponse,
    BikeBrandSolutionKitService,
    ChatRequest,
    ChatResponse,
    FeedbackRequest,
    FeedbackResponse,
    SolutionKitSummary,
)


service = BikeBrandSolutionKitService()


@console_router.get(
    "/bike-brand/solution-kit/summary",
    response_model=SolutionKitSummary,
    tags=["console", "bike-brand"],
)
def get_bike_brand_solution_kit_summary() -> SolutionKitSummary:
    """Return local solution kit section status, workflow templates, and static validation pointers."""

    return service.get_summary()


@console_router.get(
    "/bike-brand/solution-kit/assets/{section}",
    response_model=AssetsResponse,
    tags=["console", "bike-brand"],
)
def get_bike_brand_solution_kit_assets(section: AssetSection) -> AssetsResponse:
    """Return compact file metadata for one local solution kit section."""

    return service.get_assets(section)


@console_router.post(
    "/bike-brand/assistant/chat",
    response_model=ChatResponse,
    tags=["console", "bike-brand"],
)
def create_bike_brand_assistant_chat(payload: ChatRequest) -> ChatResponse:
    """Simulate a BFF chat response for local frontend integration testing."""

    return service.chat(payload)


@console_router.post(
    "/bike-brand/assistant/feedback",
    response_model=FeedbackResponse,
    tags=["console", "bike-brand"],
)
def create_bike_brand_assistant_feedback(payload: FeedbackRequest) -> FeedbackResponse:
    """Accept local demo feedback and return an audit correlation id without persistence."""

    return service.feedback(payload)
