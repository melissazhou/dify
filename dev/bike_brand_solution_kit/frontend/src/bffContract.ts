export const BIKE_ASSISTANT_CHAT_PATH = '/api/bike-assistant/chat'
export const BIKE_ASSISTANT_FEEDBACK_PATH = '/api/bike-assistant/feedback'

export type BikeAssistantAudience = 'consumer' | 'dealer' | 'internal_agent'

export type BikeAssistantChannel =
  | 'brand_site'
  | 'product_detail_page'
  | 'dealer_portal'
  | 'support_center'

export type BikeAssistantIntent =
  | 'pre_sales'
  | 'product_recommendation'
  | 'accessory_compatibility'
  | 'order_status'
  | 'return_refund'
  | 'warranty'
  | 'troubleshooting'
  | 'battery_safety'
  | 'dealer_service'
  | 'human_escalation'
  | 'other'

export type BikeAssistantActionType =
  | 'book_test_ride'
  | 'book_service'
  | 'create_ticket'
  | 'start_warranty_precheck'
  | 'find_dealer'
  | 'request_human'
  | 'open_product'
  | 'collect_missing_context'

export type BikeAssistantEscalationStatus =
  | 'not_needed'
  | 'recommended'
  | 'requested'
  | 'queued'
  | 'accepted'
  | 'failed'

export type BikeAssistantErrorCode =
  | 'validation_error'
  | 'unauthenticated'
  | 'forbidden'
  | 'rate_limited'
  | 'dify_unavailable'
  | 'business_system_unavailable'
  | 'upstream_timeout'
  | 'safety_escalation_required'
  | 'unknown_error'

export interface BikeAssistantProductContext {
  sku?: string
  model?: string
  model_year?: number
  product_url?: string
  battery_model?: string
  drive_system_vendor?: string
}

export interface BikeAssistantUserContext {
  user_id?: string
  anonymous_id?: string
  audience: BikeAssistantAudience
  consent_to_store_chat: boolean
  locale?: string
}

export interface BikeAssistantSessionContext {
  session_id: string
  conversation_id?: string
  page_url: string
  referrer?: string
}

export interface BikeAssistantMarketContext {
  market: string
  country: string
  language: string
  currency?: string
}

export interface BikeAssistantRequestContext {
  tenant_id: string
  channel: BikeAssistantChannel
  product?: BikeAssistantProductContext
  user: BikeAssistantUserContext
  session: BikeAssistantSessionContext
  market: BikeAssistantMarketContext
}

export interface BikeAssistantChatRequest {
  message: string
  intent_hint?: BikeAssistantIntent
  context: BikeAssistantRequestContext
  client_trace_id: string
}

export interface BikeAssistantCitation {
  id: string
  title: string
  source_type: 'knowledge_base' | 'manual' | 'policy' | 'service_bulletin' | 'business_api'
  source_uri?: string
  document_version?: string
  market?: string
  language?: string
  snippet?: string
}

export interface BikeAssistantNextAction {
  type: BikeAssistantActionType
  label: string
  href?: string
  payload?: Record<string, string | number | boolean>
  requires_confirmation: boolean
}

export interface BikeAssistantEscalation {
  status: BikeAssistantEscalationStatus
  reason?: string
  ticket_id?: string
  queue?: 'customer_support' | 'warranty' | 'battery_safety' | 'dealer_support'
  eta_minutes?: number
  required_fields?: string[]
}

export interface BikeAssistantChatResponse {
  answer: string
  conversation_id: string
  message_id: string
  intent: BikeAssistantIntent
  confidence: number
  citations: BikeAssistantCitation[]
  next_actions: BikeAssistantNextAction[]
  escalation: BikeAssistantEscalation
  feedback: {
    enabled: boolean
    endpoint: typeof BIKE_ASSISTANT_FEEDBACK_PATH
    message_id: string
  }
  server_trace_id: string
}

export interface BikeAssistantFeedbackRequest {
  message_id: string
  conversation_id: string
  rating: 'up' | 'down'
  reason?: 'incorrect' | 'unsafe' | 'missing_context' | 'not_helpful' | 'other'
  comment?: string
  client_trace_id: string
}

export interface BikeAssistantErrorResponse {
  error: {
    code: BikeAssistantErrorCode
    message: string
    retryable: boolean
    escalation?: BikeAssistantEscalation
    missing_fields?: string[]
  }
  server_trace_id: string
}

export interface BikeAssistantTransport {
  chat(request: BikeAssistantChatRequest): Promise<BikeAssistantChatResponse>
  sendFeedback(request: BikeAssistantFeedbackRequest): Promise<void>
}

export class BikeAssistantBffTransport implements BikeAssistantTransport {
  constructor(private readonly baseUrl = '') {}

  async chat(request: BikeAssistantChatRequest): Promise<BikeAssistantChatResponse> {
    const response = await fetch(`${this.baseUrl}${BIKE_ASSISTANT_CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': request.context.market.language,
        'X-Bike-Brand-Tenant': request.context.tenant_id,
        'X-Bike-Brand-Session': request.context.session.session_id,
        'X-Client-Trace-Id': request.client_trace_id,
      },
      credentials: 'include',
      body: JSON.stringify(request),
    })

    if (!response.ok)
      throw await toBikeAssistantError(response)

    return response.json() as Promise<BikeAssistantChatResponse>
  }

  async sendFeedback(request: BikeAssistantFeedbackRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}${BIKE_ASSISTANT_FEEDBACK_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Trace-Id': request.client_trace_id,
      },
      credentials: 'include',
      body: JSON.stringify(request),
    })

    if (!response.ok)
      throw await toBikeAssistantError(response)
  }
}

export async function toBikeAssistantError(response: Response): Promise<BikeAssistantErrorResponse> {
  try {
    return await response.json() as BikeAssistantErrorResponse
  }
  catch {
    return {
      error: {
        code: 'unknown_error',
        message: `Unexpected BFF response: ${response.status}`,
        retryable: response.status >= 500,
      },
      server_trace_id: response.headers.get('X-Server-Trace-Id') ?? 'unavailable',
    }
  }
}
