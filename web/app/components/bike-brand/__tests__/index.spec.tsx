import type { ComponentType, ReactNode } from 'react'
import type { BikeBrandAssetCategory, BikeBrandAssetsResponse, BikeBrandSummaryResponse } from '@/contract/console/bike-brand'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as BikeBrandModule from '../index'

const {
  mockAssets,
  mockChat,
  mockFeedback,
  mockSummary,
} = vi.hoisted(() => ({
  mockAssets: vi.fn(),
  mockChat: vi.fn(),
  mockFeedback: vi.fn(),
  mockSummary: vi.fn(),
}))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')

  return createReactI18nextMock({
    'bikeBrand.actions.refresh': 'Refresh',
    'bikeBrand.assets.category.frontend': 'Frontend',
    'bikeBrand.assets.category.integration': 'Integration',
    'bikeBrand.assets.category.knowledge': 'Knowledge',
    'bikeBrand.assets.category.workflows': 'Workflows',
    'bikeBrand.assets.files': 'Files',
    'bikeBrand.assets.issues': 'Issues',
    'bikeBrand.assets.valid': 'Valid',
    'bikeBrand.business.compatibility': 'Compatibility check',
    'bikeBrand.business.crmCustomer': 'CRM customer',
    'bikeBrand.business.crmLeads': 'CRM lead capture',
    'bikeBrand.business.dealersNearby': 'Nearby dealers',
    'bikeBrand.business.feedbackEscalation': 'Feedback escalation',
    'bikeBrand.business.orderStatus': 'Order status',
    'bikeBrand.business.productDetail': 'Product detail',
    'bikeBrand.business.products': 'Product catalog',
    'bikeBrand.business.serialDetail': 'Serial lookup',
    'bikeBrand.business.serviceAppointment': 'Service appointment',
    'bikeBrand.business.serviceCenters': 'Nearby service centers',
    'bikeBrand.business.testRide': 'Test ride appointment',
    'bikeBrand.business.tickets': 'Ticket creation',
    'bikeBrand.business.warrantyPrecheck': 'Warranty precheck',
    'bikeBrand.business.warrantyRules': 'Warranty rules check',
    'bikeBrand.chat.assistant': 'Assistant',
    'bikeBrand.chat.description': 'Ask the local demo assistant',
    'bikeBrand.chat.empty': 'No chat yet',
    'bikeBrand.chat.errorFallback': 'Unable to send message',
    'bikeBrand.chat.messageLabel': 'Message',
    'bikeBrand.chat.messagePlaceholder': 'Ask about sizing, compatibility, service, warranty, or order help',
    'bikeBrand.chat.send': 'Send',
    'bikeBrand.chat.sending': 'Sending',
    'bikeBrand.chat.title': 'Bike assistant',
    'bikeBrand.chat.user': 'You',
    'bikeBrand.citations.empty': 'No citations',
    'bikeBrand.citations.title': 'Sources',
    'bikeBrand.common.empty': '-',
    'bikeBrand.common.placeholderCount': '-/-',
    'bikeBrand.context.language': 'Language',
    'bikeBrand.context.market': 'Market',
    'bikeBrand.context.sessionId': 'Session ID',
    'bikeBrand.context.sku': 'SKU',
    'bikeBrand.context.userType': 'User type',
    'bikeBrand.context.userTypes.consumer': 'Consumer',
    'bikeBrand.context.userTypes.dealer': 'Dealer',
    'bikeBrand.context.userTypes.internalAgent': 'Internal agent',
    'bikeBrand.escalation.notRequired': 'No manual review',
    'bikeBrand.escalation.queue.customer_support': 'Customer support',
    'bikeBrand.escalation.required': 'Manual review required',
    'bikeBrand.escalation.requiredFields': 'Required fields',
    'bikeBrand.escalation.title': 'Human support',
    'bikeBrand.feedback.comment': 'Feedback comment',
    'bikeBrand.feedback.commentPlaceholder': 'Optional comment',
    'bikeBrand.feedback.failed': 'Feedback failed',
    'bikeBrand.feedback.helpful': 'Helpful',
    'bikeBrand.feedback.notHelpful': 'Not helpful',
    'bikeBrand.feedback.sent': 'Feedback sent',
    'bikeBrand.feedback.waiting': 'Send a message to enable feedback',
    'bikeBrand.intent.accessory_compatibility': 'Accessory compatibility',
    'bikeBrand.interfaces.columns.method': 'Method',
    'bikeBrand.interfaces.columns.name': 'Name',
    'bikeBrand.interfaces.columns.path': 'Path',
    'bikeBrand.interfaces.columns.status': 'Status',
    'bikeBrand.interfaces.count': '15 / 15 business interfaces',
    'bikeBrand.interfaces.title': 'Business interfaces',
    'bikeBrand.nextActions.confirmationRequired': '(confirmation required)',
    'bikeBrand.nextActions.empty': 'No next actions',
    'bikeBrand.nextActions.title': 'Next actions',
    'bikeBrand.overview.assetCoverage': 'Asset coverage',
    'bikeBrand.overview.assetCoverageDetail': 'Static asset categories',
    'bikeBrand.overview.coverageValue': '4 / 4',
    'bikeBrand.overview.notLoaded': 'Not loaded',
    'bikeBrand.overview.openapiOperations': 'OpenAPI operations',
    'bikeBrand.overview.openapiOperationsDetail': 'Business API operations',
    'bikeBrand.overview.solutionChecks': 'Solution checks',
    'bikeBrand.overview.solutionChecksDetail': 'Static gates',
    'bikeBrand.overview.summaryLoaded': 'Summary loaded',
    'bikeBrand.overview.title': 'Solution kit summary',
    'bikeBrand.page.description': 'Local demo status and assistant test surface',
    'bikeBrand.page.title': 'Bike Brand Solution Kit',
    'bikeBrand.response.confidence': 'Confidence',
    'bikeBrand.response.intent': 'Intent',
    'bikeBrand.response.messageId': 'Message ID',
    'bikeBrand.response.source': 'Source',
    'bikeBrand.sourceType.manual': 'Manual',
    'bikeBrand.status.error': 'Error',
    'bikeBrand.status.missing': 'Missing',
    'bikeBrand.status.pending': 'Pending',
    'bikeBrand.status.ready': 'Ready',
    'bikeBrand.status.unknown': 'Unknown',
    'bikeBrand.status.warning': 'Warning',
    'bikeBrand.workflows.count': '3 / 3 workflows',
    'bikeBrand.workflows.datasets': 'Datasets',
    'bikeBrand.workflows.empty': 'No workflows',
    'bikeBrand.workflows.title': 'Workflows',
    'bikeBrand.workflows.tools': 'Tools',
  })
})

type QueryInput = {
  params?: {
    section?: BikeBrandAssetCategory
  }
}

type MutationInput = {
  body?: Record<string, unknown>
}

vi.mock('@/service/client', () => {
  const queryOptions = (key: string, queryFn: (input?: QueryInput) => unknown) =>
    (options: { input?: QueryInput } & Record<string, unknown> = {}) => ({
      queryKey: ['console', 'bikeBrand', key, options.input],
      queryFn: () => queryFn(options.input),
      ...options,
    })
  const mutationOptions = (key: string, mutationFn: (input: MutationInput) => unknown) =>
    (options: Record<string, unknown> = {}) => ({
      mutationKey: ['console', 'bikeBrand', key],
      mutationFn,
      ...options,
    })

  return {
    consoleQuery: {
      bikeBrand: {
        assets: {
          queryOptions: queryOptions('assets', mockAssets),
        },
        chat: {
          mutationOptions: mutationOptions('chat', mockChat),
        },
        feedback: {
          mutationOptions: mutationOptions('feedback', mockFeedback),
        },
        summary: {
          queryOptions: queryOptions('summary', mockSummary),
        },
      },
    },
  }
})

const BikeBrandWorkbench = BikeBrandModule.default as ComponentType

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  })

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )

  return Wrapper
}

const renderBikeBrandWorkbench = () => {
  const Wrapper = createWrapper()
  return render(<BikeBrandWorkbench />, { wrapper: Wrapper })
}

const summaryResponse: BikeBrandSummaryResponse = {
  acceptance_points: [
    'knowledge metadata is complete',
    'business API boundary is defined',
    'safety escalation requires manual review',
  ],
  asset_counts: {
    frontend: 2,
    integration: 3,
    knowledge: 4,
    workflows: 4,
  },
  openapi_operation_count: 15,
  sections: [
    { file_count: 4, machine_readable_count: 4, path: 'dev/bike_brand_solution_kit/knowledge', section: 'knowledge' },
    { file_count: 3, machine_readable_count: 3, path: 'dev/bike_brand_solution_kit/integration', section: 'integration' },
    { file_count: 4, machine_readable_count: 4, path: 'dev/bike_brand_solution_kit/workflows', section: 'workflows' },
    { file_count: 2, machine_readable_count: 2, path: 'dev/bike_brand_solution_kit/frontend', section: 'frontend' },
  ],
  warnings: [],
  workflow_templates: [
    {
      file: 'consumer_support.yaml',
      id: 'consumer_support',
      mode: 'advanced-chat',
      purpose: 'Consumer support chatflow with citations and escalation.',
      required_datasets: ['consumer_docs'],
      required_tools: ['order_status_lookup'],
    },
    {
      file: 'sales_recommendation.yaml',
      id: 'sales_recommendation',
      mode: 'workflow',
      purpose: 'Sales recommendation flow using live stock and price tools.',
      required_datasets: ['product_docs'],
      required_tools: ['product_catalog_lookup'],
    },
    {
      file: 'warranty_precheck.yaml',
      id: 'warranty_precheck',
      mode: 'workflow',
      purpose: 'Warranty precheck with evidence collection and manual review.',
      required_datasets: ['warranty_docs'],
      required_tools: ['warranty_rules_check'],
    },
  ],
}

const assetResponse = (section: BikeBrandAssetCategory): BikeBrandAssetsResponse => ({
  files: [
    {
      extension: section === 'integration' ? '.yaml' : '.json',
      machine_readable: true,
      metadata: {
        title: `${section} asset`,
        top_level_keys: ['title', 'version'],
        version: '1.0.0',
      },
      name: `${section}-asset.json`,
      path: `dev/bike_brand_solution_kit/${section}/${section}-asset.json`,
      size_bytes: 256,
    },
  ],
  root: `dev/bike_brand_solution_kit/${section}`,
  section,
  warnings: [],
})

const chatResponse = {
  answer: 'Urban E 500 can use the RackMax child seat only with the 2025 adapter.',
  citations: [
    {
      document_version: '2025.04',
      id: 'cite-1',
      snippet: 'Rear carrier child-seat compatibility requires the 2025 adapter.',
      source_type: 'manual',
      source_uri: 'https://example.com/manuals/urban-e-500',
      title: 'Urban E 500 accessory guide',
    },
  ],
  confidence: 0.91,
  escalation: {
    queue: 'customer_support',
    reason: 'safety_or_fitment_review',
    required: true,
    required_fields: ['serial_no'],
  },
  intent: 'accessory_compatibility',
  message_id: 'msg-1',
  next_actions: [
    {
      label: 'Request human support',
      requires_confirmation: false,
      type: 'request_human',
    },
  ],
  session_id: 'bike-demo-session',
  source: 'local_demo',
}

describe('BikeBrandWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssets.mockImplementation((input?: QueryInput) =>
      Promise.resolve(assetResponse(input?.params?.section ?? 'knowledge')),
    )
    mockChat.mockResolvedValue(chatResponse)
    mockFeedback.mockResolvedValue({ accepted: true, audit_id: 'audit-1', source: 'local_demo' })
    mockSummary.mockResolvedValue(summaryResponse)
  })

  // Summary rendering validates the initial consoleQuery boundary and asset fan-out.
  describe('Rendering', () => {
    it('should render solution, interface, asset, and workflow status after queries load', async () => {
      renderBikeBrandWorkbench()

      expect(await screen.findByText(/bike brand solution kit/i)).toBeInTheDocument()
      expect(await screen.findByText(/product catalog/i)).toBeInTheDocument()
      expect(screen.getAllByText(/consumer_support/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/knowledge/i).length).toBeGreaterThan(0)
      expect(mockAssets).toHaveBeenCalledTimes(4)
    })
  })

  // Chat behavior validates user input, assistant output, citations, escalation, and request context.
  describe('Chat', () => {
    it('should send chat and show citations with escalation state', async () => {
      const user = userEvent.setup()
      renderBikeBrandWorkbench()

      const messageInput = await screen.findByRole('textbox', { name: /message/i })
      await user.type(messageInput, 'Can I mount a rear child seat?')
      await user.click(screen.getByRole('button', { name: /^send$/i }))

      await waitFor(() => {
        expect(mockChat).toHaveBeenCalled()
      })
      expect(JSON.stringify(mockChat.mock.calls)).toContain('rear child seat')
      expect(JSON.stringify(mockChat.mock.calls)).toContain('URB-E-500-2025-M')
      expect(await screen.findByText(/rackmax child seat/i)).toBeInTheDocument()
      expect(screen.getByText(/urban e 500 accessory guide/i)).toBeInTheDocument()
      expect(screen.getByText(/customer support/i)).toBeInTheDocument()
      expect(screen.getByText(/safety_or_fitment_review/i)).toBeInTheDocument()
    })
  })

  // Feedback behavior validates accepted feedback is delegated to the API boundary.
  describe('Feedback', () => {
    it('should submit feedback for the assistant answer', async () => {
      const user = userEvent.setup()
      renderBikeBrandWorkbench()

      await user.type(await screen.findByRole('textbox', { name: /message/i }), 'Can I mount a rear child seat?')
      await user.click(screen.getByRole('button', { name: /^send$/i }))
      await user.click(await screen.findByRole('button', { name: /^helpful$/i }))

      await waitFor(() => {
        expect(mockFeedback).toHaveBeenCalled()
      })
      expect(JSON.stringify(mockFeedback.mock.calls)).toContain('msg-1')
      expect(JSON.stringify(mockFeedback.mock.calls)).toContain('up')
    })
  })
})
