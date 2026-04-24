import { type } from '@orpc/contract'
import { base } from '../base'

export type BikeBrandStatus = 'ready' | 'warning' | 'error' | 'missing' | 'pending' | 'unknown'

export type BikeBrandAssetCategory = 'knowledge' | 'integration' | 'workflows' | 'frontend'

export type BikeBrandSectionSummary = {
  section: BikeBrandAssetCategory
  path: string
  file_count: number
  machine_readable_count: number
}

export type BikeBrandWorkflowTemplateSummary = {
  id: string
  file: string
  mode: string
  purpose: string
  required_datasets: string[]
  required_tools: string[]
}

export type BikeBrandSummaryResponse = {
  sections: BikeBrandSectionSummary[]
  asset_counts: Record<string, number>
  openapi_operation_count: number
  workflow_templates: BikeBrandWorkflowTemplateSummary[]
  acceptance_points: string[]
  warnings: string[]
}

export type BikeBrandAssetMetadata = {
  top_level_keys: string[]
  title?: string | null
  version?: string | null
  openapi_version?: string | null
  path_count?: number | null
  operation_count?: number | null
  domain_count?: number | null
  checklist_count?: number | null
  template_count?: number | null
  schema_id?: string | null
}

export type BikeBrandAssetFile = {
  path: string
  name: string
  extension: string
  size_bytes: number
  machine_readable: boolean
  metadata: BikeBrandAssetMetadata | null
}

export type BikeBrandAssetsResponse = {
  section: BikeBrandAssetCategory
  root: string
  files: BikeBrandAssetFile[]
  warnings: string[]
}

export type BikeBrandIntent =
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

export type BikeBrandActionType =
  | 'book_service'
  | 'create_ticket'
  | 'start_warranty_precheck'
  | 'find_dealer'
  | 'request_human'
  | 'collect_missing_context'

export type BikeBrandAudience = 'consumer' | 'dealer' | 'internal_agent'

export type BikeBrandRequestContext = {
  sku?: string | null
  market?: string | null
  language?: string | null
  user_type?: BikeBrandAudience | string | null
  session_id?: string | null
}

export type BikeBrandChatRequest = {
  message: string
  context: BikeBrandRequestContext
}

export type BikeBrandCitation = {
  id: string
  title: string
  source_type: 'knowledge_base' | 'manual' | 'policy' | 'service_bulletin' | 'business_api'
  source_uri: string
  document_version?: string
  market?: string
  language?: string
  snippet: string
}

export type BikeBrandNextAction = {
  type: BikeBrandActionType
  label: string
  requires_confirmation: boolean
}

export type BikeBrandEscalation = {
  required: boolean
  reason: string | null
  queue?: 'customer_support' | 'warranty' | 'battery_safety' | 'dealer_support' | null
  required_fields?: string[]
}

export type BikeBrandChatResponse = {
  answer: string
  intent: BikeBrandIntent
  confidence: number
  citations: BikeBrandCitation[]
  next_actions: BikeBrandNextAction[]
  escalation: BikeBrandEscalation
  source: 'local_demo'
  message_id: string
  session_id?: string | null
}

export type BikeBrandFeedbackRequest = {
  message_id: string
  rating: 'up' | 'down'
  comment?: string | null
}

export type BikeBrandFeedbackResponse = {
  accepted: boolean
  audit_id: string
  source: 'local_demo'
}

export const bikeBrandSummaryContract = base
  .route({
    path: '/bike-brand/solution-kit/summary',
    method: 'GET',
  })
  .output(type<BikeBrandSummaryResponse>())

export const bikeBrandAssetsContract = base
  .route({
    path: '/bike-brand/solution-kit/assets/{section}',
    method: 'GET',
  })
  .input(type<{
    params: {
      section: BikeBrandAssetCategory
    }
  }>())
  .output(type<BikeBrandAssetsResponse>())

export const bikeBrandChatContract = base
  .route({
    path: '/bike-brand/assistant/chat',
    method: 'POST',
  })
  .input(type<{
    body: BikeBrandChatRequest
  }>())
  .output(type<BikeBrandChatResponse>())

export const bikeBrandFeedbackContract = base
  .route({
    path: '/bike-brand/assistant/feedback',
    method: 'POST',
  })
  .input(type<{
    body: BikeBrandFeedbackRequest
  }>())
  .output(type<BikeBrandFeedbackResponse>())
