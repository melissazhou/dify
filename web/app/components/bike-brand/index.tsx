'use client'

import type {
  BikeBrandAssetCategory,
  BikeBrandAssetsResponse,
  BikeBrandAudience,
  BikeBrandChatResponse,
  BikeBrandEscalation,
  BikeBrandFeedbackRequest,
  BikeBrandRequestContext,
  BikeBrandStatus,
  BikeBrandSummaryResponse,
  BikeBrandWorkflowTemplateSummary,
} from '@/contract/console/bike-brand'
import type { ChangeEvent, FormEvent } from 'react'
import { RiRefreshLine, RiSendPlane2Line, RiThumbDownLine, RiThumbUpLine } from '@remixicon/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { consoleQuery } from '@/service/client'

type ChatTurn = {
  id: string
  role: 'user' | 'assistant'
  text: string
  response?: BikeBrandChatResponse
  error?: string
}

type ContextForm = {
  sku: string
  market: string
  language: string
  userType: BikeBrandAudience
  sessionId: string
}

type ViewAssetStat = {
  category: BikeBrandAssetCategory
  status: BikeBrandStatus
  files: number
  validFiles: number
  issues: number
}

type BusinessInterfaceKey =
  | 'business.products'
  | 'business.productDetail'
  | 'business.compatibility'
  | 'business.orderStatus'
  | 'business.dealersNearby'
  | 'business.serialDetail'
  | 'business.warrantyRules'
  | 'business.serviceCenters'
  | 'business.crmCustomer'
  | 'business.crmLeads'
  | 'business.tickets'
  | 'business.warrantyPrecheck'
  | 'business.testRide'
  | 'business.serviceAppointment'
  | 'business.feedbackEscalation'

type BusinessInterfaceStatus = {
  id: string
  nameKey: BusinessInterfaceKey
  method: 'GET' | 'POST'
  path: string
  status: BikeBrandStatus
}

type ViewWorkflowStatus = BikeBrandWorkflowTemplateSummary & {
  status: BikeBrandStatus
}

const assetSections = ['knowledge', 'integration', 'workflows', 'frontend'] as const satisfies readonly BikeBrandAssetCategory[]

const businessOperations = [
  { id: 'products', nameKey: 'business.products', method: 'GET', path: '/products' },
  { id: 'product-detail', nameKey: 'business.productDetail', method: 'GET', path: '/products/{sku}' },
  { id: 'compatibility-check', nameKey: 'business.compatibility', method: 'GET', path: '/compatibility/check' },
  { id: 'order-status', nameKey: 'business.orderStatus', method: 'GET', path: '/orders/{order_no}' },
  { id: 'dealers-nearby', nameKey: 'business.dealersNearby', method: 'GET', path: '/dealers/nearby' },
  { id: 'serial-detail', nameKey: 'business.serialDetail', method: 'GET', path: '/serials/{serial_no}' },
  { id: 'warranty-rules', nameKey: 'business.warrantyRules', method: 'GET', path: '/warranty/rules/check' },
  { id: 'service-centers', nameKey: 'business.serviceCenters', method: 'GET', path: '/service-centers/nearby' },
  { id: 'crm-customer', nameKey: 'business.crmCustomer', method: 'GET', path: '/crm/customers/{id}' },
  { id: 'crm-leads', nameKey: 'business.crmLeads', method: 'POST', path: '/crm/leads' },
  { id: 'tickets', nameKey: 'business.tickets', method: 'POST', path: '/tickets' },
  { id: 'warranty-precheck', nameKey: 'business.warrantyPrecheck', method: 'POST', path: '/warranty/precheck' },
  { id: 'test-ride', nameKey: 'business.testRide', method: 'POST', path: '/appointments/test-ride' },
  { id: 'service-appointment', nameKey: 'business.serviceAppointment', method: 'POST', path: '/appointments/service' },
  { id: 'feedback-escalation', nameKey: 'business.feedbackEscalation', method: 'POST', path: '/feedback/escalation' },
] as const satisfies ReadonlyArray<Omit<BusinessInterfaceStatus, 'status'>>

const statusStyles: Record<BikeBrandStatus, string> = {
  ready: 'border-util-colors-green-green-200 bg-util-colors-green-green-50 text-util-colors-green-green-700',
  warning: 'border-util-colors-warning-warning-200 bg-util-colors-warning-warning-50 text-util-colors-warning-warning-700',
  error: 'border-util-colors-red-red-200 bg-util-colors-red-red-50 text-util-colors-red-red-700',
  missing: 'border-components-badge-gray-border bg-components-badge-gray-bg text-text-tertiary',
  pending: 'border-components-badge-blue-border bg-components-badge-blue-bg text-text-accent',
  unknown: 'border-components-badge-gray-border bg-components-badge-gray-bg text-text-tertiary',
}

const buildContext = (form: ContextForm): BikeBrandRequestContext => ({
  sku: form.sku.trim() || null,
  market: form.market.trim() || 'north-america',
  language: form.language.trim() || 'en-US',
  user_type: form.userType,
  session_id: form.sessionId.trim() || 'bike-demo-session',
})

const toAssetStat = (section: BikeBrandAssetCategory, data: BikeBrandAssetsResponse | undefined, isLoading: boolean, isError: boolean): ViewAssetStat => {
  const files = data?.files ?? []
  const warnings = data?.warnings ?? []

  return {
    category: section,
    status: isError ? 'error' : isLoading ? 'pending' : warnings.length ? 'warning' : files.length ? 'ready' : 'missing',
    files: files.length,
    validFiles: files.filter(file => file.machine_readable && file.metadata).length,
    issues: warnings.length,
  }
}

const toBusinessStatuses = (summary?: BikeBrandSummaryResponse): BusinessInterfaceStatus[] => {
  const readyCount = summary?.openapi_operation_count ?? 0
  return businessOperations.map((operation, index) => ({
    ...operation,
    status: readyCount > index ? 'ready' : summary ? 'missing' : 'pending',
  }))
}

const toWorkflowStatuses = (summary?: BikeBrandSummaryResponse): ViewWorkflowStatus[] => {
  return (summary?.workflow_templates ?? []).map(workflow => ({
    ...workflow,
    status: workflow.id && workflow.file && workflow.mode ? 'ready' : 'missing',
  }))
}

const solutionStatus = (summary?: BikeBrandSummaryResponse, isLoading?: boolean, isError?: boolean): BikeBrandStatus => {
  if (isError)
    return 'error'
  if (isLoading)
    return 'pending'
  if (!summary)
    return 'unknown'
  if (summary.warnings.length)
    return 'warning'
  return 'ready'
}

const BikeBrandWorkbench = () => {
  const { t } = useTranslation('bikeBrand')
  const [contextForm, setContextForm] = useState<ContextForm>({
    sku: 'URB-E-500-2025-M',
    market: 'north-america',
    language: 'en-US',
    userType: 'consumer',
    sessionId: 'bike-demo-session',
  })
  const [message, setMessage] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sent' | 'error'>('idle')

  const summaryQuery = useQuery(consoleQuery.bikeBrand.summary.queryOptions({
    staleTime: 30 * 1000,
  }))
  const knowledgeAssetsQuery = useQuery(consoleQuery.bikeBrand.assets.queryOptions({
    input: { params: { section: 'knowledge' } },
    staleTime: 30 * 1000,
  }))
  const integrationAssetsQuery = useQuery(consoleQuery.bikeBrand.assets.queryOptions({
    input: { params: { section: 'integration' } },
    staleTime: 30 * 1000,
  }))
  const workflowsAssetsQuery = useQuery(consoleQuery.bikeBrand.assets.queryOptions({
    input: { params: { section: 'workflows' } },
    staleTime: 30 * 1000,
  }))
  const frontendAssetsQuery = useQuery(consoleQuery.bikeBrand.assets.queryOptions({
    input: { params: { section: 'frontend' } },
    staleTime: 30 * 1000,
  }))

  const chatMutation = useMutation(consoleQuery.bikeBrand.chat.mutationOptions())
  const feedbackMutation = useMutation(consoleQuery.bikeBrand.feedback.mutationOptions())

  const assetQueries = [knowledgeAssetsQuery, integrationAssetsQuery, workflowsAssetsQuery, frontendAssetsQuery]
  const assets = assetSections.map((section, index) =>
    toAssetStat(section, assetQueries[index]?.data, !!assetQueries[index]?.isLoading, !!assetQueries[index]?.isError),
  )
  const businessInterfaces = toBusinessStatuses(summaryQuery.data)
  const workflows = toWorkflowStatuses(summaryQuery.data)

  const latestAssistantResponse = useMemo(() => {
    return [...turns].reverse().find(turn => turn.response)?.response
  }, [turns])

  const handleContextChange = (field: keyof ContextForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.currentTarget.value
    setContextForm(current => ({
      ...current,
      [field]: field === 'userType' ? value as BikeBrandAudience : value,
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedMessage = message.trim()
    if (!trimmedMessage || chatMutation.isPending)
      return

    const turnId = `${Date.now()}-${turns.length}`
    setMessage('')
    setFeedbackState('idle')
    setTurns(current => [
      ...current,
      {
        id: turnId,
        role: 'user',
        text: trimmedMessage,
      },
    ])

    chatMutation.mutate({
      body: {
        message: trimmedMessage,
        context: buildContext(contextForm),
      },
    }, {
      onSuccess: (response) => {
        setTurns(current => [
          ...current,
          {
            id: response.message_id,
            role: 'assistant',
            text: response.answer,
            response,
          },
        ])
      },
      onError: (error) => {
        setTurns(current => [
          ...current,
          {
            id: `${turnId}-error`,
            role: 'assistant',
            text: error instanceof Error ? error.message : t('chat.errorFallback'),
            error: error instanceof Error ? error.message : t('chat.errorFallback'),
          },
        ])
      },
    })
  }

  const sendFeedback = (rating: BikeBrandFeedbackRequest['rating']) => {
    if (!latestAssistantResponse || feedbackMutation.isPending)
      return

    setFeedbackState('idle')
    feedbackMutation.mutate({
      body: {
        message_id: latestAssistantResponse.message_id,
        rating,
        comment: feedbackComment.trim() || null,
      },
    }, {
      onSuccess: () => {
        setFeedbackState('sent')
        setFeedbackComment('')
      },
      onError: () => setFeedbackState('error'),
    })
  }

  const refresh = () => {
    void summaryQuery.refetch()
    assetQueries.forEach(query => void query.refetch())
  }

  return (
    <main className="h-full overflow-auto bg-background-body p-4 text-text-primary md:p-6">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4">
        <header className="flex flex-col gap-3 border-b border-divider-subtle pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="system-2xl-semibold text-text-primary">{t('page.title')}</h1>
            <p className="system-sm-regular mt-1 text-text-tertiary">{t('page.description')}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-components-button-secondary-border bg-components-button-secondary-bg px-3 system-sm-medium text-components-button-secondary-text hover:bg-components-button-secondary-bg-hover disabled:opacity-50"
            disabled={summaryQuery.isFetching || assetQueries.some(query => query.isFetching)}
            onClick={refresh}
          >
            <RiRefreshLine className="size-4" aria-hidden />
            {t('actions.refresh')}
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <OverviewPanel
              assets={assets}
              isError={summaryQuery.isError}
              isLoading={summaryQuery.isLoading}
              summary={summaryQuery.data}
            />
            <InterfaceStatusTable interfaces={businessInterfaces} />
            <WorkflowStatusGrid workflows={workflows} />
          </div>
          <ChatPanel
            contextForm={contextForm}
            feedbackComment={feedbackComment}
            feedbackState={feedbackState}
            isFeedbackPending={feedbackMutation.isPending}
            isSending={chatMutation.isPending}
            latestAssistantResponse={latestAssistantResponse}
            message={message}
            turns={turns}
            onContextChange={handleContextChange}
            onFeedbackCommentChange={setFeedbackComment}
            onMessageChange={setMessage}
            onSendFeedback={sendFeedback}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    </main>
  )
}

const OverviewPanel = ({
  summary,
  assets,
  isLoading,
  isError,
}: {
  summary?: BikeBrandSummaryResponse
  assets: ViewAssetStat[]
  isLoading: boolean
  isError: boolean
}) => {
  const { t } = useTranslation('bikeBrand')
  const acceptanceTotal = summary?.acceptance_points.length ?? 0
  const acceptancePassed = summary ? Math.max(acceptanceTotal - summary.warnings.length, 0) : 0

  return (
    <div className="rounded-lg border border-components-panel-border bg-components-panel-bg">
      <div className="flex flex-col gap-2 border-b border-divider-subtle px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="system-md-semibold text-text-primary">{t('overview.title')}</h2>
          <p className="system-xs-regular mt-0.5 text-text-tertiary">
            {summary ? t('overview.summaryLoaded') : t('overview.notLoaded')}
          </p>
        </div>
        <StatusPill status={solutionStatus(summary, isLoading, isError)} />
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
        <Metric
          label={t('overview.solutionChecks')}
          value={summary ? `${acceptancePassed}/${acceptanceTotal}` : t('common.placeholderCount')}
          detail={t('overview.solutionChecksDetail')}
        />
        <Metric
          label={t('overview.assetCoverage')}
          value={t('overview.coverageValue', { count: assets.filter(asset => asset.status === 'ready' || asset.status === 'warning').length, total: assetSections.length })}
          detail={t('overview.assetCoverageDetail')}
        />
        <Metric
          label={t('overview.openapiOperations')}
          value={summary ? `${summary.openapi_operation_count}` : t('common.empty')}
          detail={t('overview.openapiOperationsDetail')}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 border-t border-divider-subtle p-4 lg:grid-cols-4">
        {assets.map(asset => (
          <AssetStatCard key={asset.category} asset={asset} />
        ))}
      </div>
      {!!summary?.warnings.length && (
        <div className="border-t border-divider-subtle px-4 py-3">
          <div className="system-xs-semibold text-text-secondary">{t('overview.warnings')}</div>
          <ul className="mt-2 space-y-1">
            {summary.warnings.map(warning => (
              <li key={warning} className="system-xs-regular rounded-md bg-background-section px-3 py-2 text-text-tertiary">{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const Metric = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="rounded-md bg-background-section px-3 py-2">
    <div className="system-xs-medium uppercase text-text-tertiary">{label}</div>
    <div className="system-xl-semibold mt-1 text-text-primary">{value}</div>
    <div className="system-xs-regular mt-0.5 text-text-tertiary">{detail}</div>
  </div>
)

const AssetStatCard = ({ asset }: { asset: ViewAssetStat }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <div className="min-w-0 rounded-md border border-components-panel-border-subtle bg-background-default p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="system-sm-semibold truncate text-text-primary">{t(`assets.category.${asset.category}`)}</div>
          <div className="system-xs-regular mt-0.5 text-text-tertiary">{asset.category}</div>
        </div>
        <StatusPill status={asset.status} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniMetric label={t('assets.files')} value={asset.files} />
        <MiniMetric label={t('assets.valid')} value={asset.validFiles} />
        <MiniMetric label={t('assets.issues')} value={asset.issues} />
      </div>
    </div>
  )
}

const MiniMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded bg-background-section px-2 py-1.5">
    <div className="system-sm-semibold text-text-primary">{value}</div>
    <div className="system-xs-regular text-text-tertiary">{label}</div>
  </div>
)

const InterfaceStatusTable = ({ interfaces }: { interfaces: BusinessInterfaceStatus[] }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <div className="rounded-lg border border-components-panel-border bg-components-panel-bg">
      <div className="border-b border-divider-subtle px-4 py-3">
        <h2 className="system-md-semibold text-text-primary">{t('interfaces.title')}</h2>
        <p className="system-xs-regular mt-0.5 text-text-tertiary">
          {t('interfaces.count', { count: interfaces.filter(item => item.status === 'ready').length, total: businessOperations.length })}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed">
          <thead className="bg-background-section">
            <tr className="system-xs-medium text-left uppercase text-text-tertiary">
              <th className="w-[30%] px-4 py-2">{t('interfaces.columns.name')}</th>
              <th className="w-[12%] px-4 py-2">{t('interfaces.columns.method')}</th>
              <th className="w-[40%] px-4 py-2">{t('interfaces.columns.path')}</th>
              <th className="w-[18%] px-4 py-2">{t('interfaces.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider-subtle">
            {interfaces.map(item => (
              <tr key={item.id} className="system-sm-regular text-text-secondary">
                <td className="px-4 py-2">
                  <div className="truncate font-medium text-text-primary">{t(item.nameKey)}</div>
                </td>
                <td className="px-4 py-2">
                  <span className="rounded bg-background-section px-1.5 py-0.5 system-xs-medium text-text-secondary">{item.method}</span>
                </td>
                <td className="truncate px-4 py-2 font-mono text-xs text-text-secondary">{item.path}</td>
                <td className="px-4 py-2"><StatusPill status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const WorkflowStatusGrid = ({ workflows }: { workflows: ViewWorkflowStatus[] }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <div className="rounded-lg border border-components-panel-border bg-components-panel-bg">
      <div className="border-b border-divider-subtle px-4 py-3">
        <h2 className="system-md-semibold text-text-primary">{t('workflows.title')}</h2>
        <p className="system-xs-regular mt-0.5 text-text-tertiary">
          {t('workflows.count', { count: workflows.length, total: 3 })}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
        {workflows.map(workflow => (
          <div key={workflow.id} className="rounded-md border border-components-panel-border-subtle bg-background-default p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="system-sm-semibold truncate text-text-primary">{workflow.id}</div>
                <div className="system-xs-regular mt-0.5 truncate text-text-tertiary">{workflow.mode} / {workflow.file}</div>
              </div>
              <StatusPill status={workflow.status} />
            </div>
            <p className="system-xs-regular mt-2 line-clamp-2 text-text-tertiary">{workflow.purpose}</p>
            <ListSummary label={t('workflows.datasets')} items={workflow.required_datasets} />
            <ListSummary label={t('workflows.tools')} items={workflow.required_tools} />
          </div>
        ))}
        {!workflows.length && <EmptyState label={t('workflows.empty')} />}
      </div>
    </div>
  )
}

const ListSummary = ({ label, items }: { label: string; items: string[] }) => (
  <div className="mt-3">
    <div className="system-xs-medium text-text-tertiary">{label}</div>
    <div className="mt-1 flex flex-wrap gap-1">
      {items.slice(0, 4).map(item => (
        <span key={item} className="rounded bg-background-section px-1.5 py-0.5 system-xs-regular text-text-secondary">{item}</span>
      ))}
      {items.length > 4 && <span className="rounded bg-background-section px-1.5 py-0.5 system-xs-regular text-text-tertiary">+{items.length - 4}</span>}
    </div>
  </div>
)

const ChatPanel = ({
  contextForm,
  feedbackComment,
  feedbackState,
  isFeedbackPending,
  isSending,
  latestAssistantResponse,
  message,
  turns,
  onContextChange,
  onFeedbackCommentChange,
  onMessageChange,
  onSendFeedback,
  onSubmit,
}: {
  contextForm: ContextForm
  feedbackComment: string
  feedbackState: 'idle' | 'sent' | 'error'
  isFeedbackPending: boolean
  isSending: boolean
  latestAssistantResponse?: BikeBrandChatResponse
  message: string
  turns: ChatTurn[]
  onContextChange: (field: keyof ContextForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onFeedbackCommentChange: (value: string) => void
  onMessageChange: (value: string) => void
  onSendFeedback: (rating: BikeBrandFeedbackRequest['rating']) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <aside className="flex min-h-[720px] min-w-0 flex-col rounded-lg border border-components-panel-border bg-components-panel-bg">
      <div className="border-b border-divider-subtle px-4 py-3">
        <h2 className="system-md-semibold text-text-primary">{t('chat.title')}</h2>
        <p className="system-xs-regular mt-0.5 text-text-tertiary">{t('chat.description')}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-divider-subtle p-4 sm:grid-cols-2">
        <Field label={t('context.sku')} value={contextForm.sku} onChange={onContextChange('sku')} />
        <Field label={t('context.market')} value={contextForm.market} onChange={onContextChange('market')} />
        <Field label={t('context.language')} value={contextForm.language} onChange={onContextChange('language')} />
        <label className="min-w-0">
          <span className="system-xs-medium text-text-tertiary">{t('context.userType')}</span>
          <select
            className="mt-1 h-9 w-full rounded-md border border-components-input-border bg-components-input-bg-normal px-3 system-sm-regular text-components-input-text-filled outline-none focus:border-components-input-border-active"
            value={contextForm.userType}
            onChange={onContextChange('userType')}
          >
            <option value="consumer">{t('context.userTypes.consumer')}</option>
            <option value="dealer">{t('context.userTypes.dealer')}</option>
            <option value="internal_agent">{t('context.userTypes.internalAgent')}</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Field label={t('context.sessionId')} value={contextForm.sessionId} onChange={onContextChange('sessionId')} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3" aria-live="polite">
          {!turns.length && <EmptyState label={t('chat.empty')} />}
          {turns.map(turn => (
            <article
              key={turn.id}
              className={turn.role === 'user'
                ? 'ml-auto max-w-[92%] rounded-lg bg-components-button-primary-bg px-3 py-2 text-components-button-primary-text'
                : 'max-w-[96%] rounded-lg border border-components-panel-border-subtle bg-background-default px-3 py-2 text-text-primary'}
            >
              <div className="system-xs-medium mb-1 opacity-75">
                {turn.role === 'user' ? t('chat.user') : t('chat.assistant')}
              </div>
              <p className="system-sm-regular whitespace-pre-wrap break-words">{turn.text}</p>
              {turn.response && (
                <div className="mt-3 space-y-3">
                  <ResponseMeta response={turn.response} />
                  <Citations citations={turn.response.citations} />
                  <NextActions actions={turn.response.next_actions} />
                  <EscalationStatus escalation={turn.response.escalation} />
                </div>
              )}
              {turn.error && <div className="system-xs-regular mt-2 text-text-warning">{turn.error}</div>}
            </article>
          ))}
        </div>
      </div>

      <form className="border-t border-divider-subtle p-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="system-xs-medium text-text-tertiary">{t('chat.messageLabel')}</span>
          <textarea
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-components-input-border bg-components-input-bg-normal px-3 py-2 system-sm-regular text-components-input-text-filled outline-none focus:border-components-input-border-active"
            placeholder={t('chat.messagePlaceholder')}
            value={message}
            onChange={event => onMessageChange(event.currentTarget.value)}
          />
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <FeedbackControls
            comment={feedbackComment}
            feedbackState={feedbackState}
            isPending={isFeedbackPending}
            response={latestAssistantResponse}
            onCommentChange={onFeedbackCommentChange}
            onSendFeedback={onSendFeedback}
          />
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-components-button-primary-bg px-4 system-sm-medium text-components-button-primary-text hover:bg-components-button-primary-bg-hover disabled:opacity-50"
            disabled={!message.trim() || isSending}
          >
            <RiSendPlane2Line className="size-4" aria-hidden />
            {isSending ? t('chat.sending') : t('chat.send')}
          </button>
        </div>
      </form>
    </aside>
  )
}

const Field = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) => (
  <label className="min-w-0">
    <span className="system-xs-medium text-text-tertiary">{label}</span>
    <input
      className="mt-1 h-9 w-full rounded-md border border-components-input-border bg-components-input-bg-normal px-3 system-sm-regular text-components-input-text-filled outline-none focus:border-components-input-border-active"
      value={value}
      onChange={onChange}
    />
  </label>
)

const ResponseMeta = ({ response }: { response: BikeBrandChatResponse }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-background-section p-2 system-xs-regular text-text-tertiary">
      <div>{t('response.intent')}: <span className="text-text-secondary">{t(`intent.${response.intent}`)}</span></div>
      <div>{t('response.confidence')}: <span className="text-text-secondary">{Math.round(response.confidence * 100)}%</span></div>
      <div className="truncate">{t('response.messageId')}: <span className="font-mono text-text-secondary">{response.message_id}</span></div>
      <div className="truncate">{t('response.source')}: <span className="text-text-secondary">{response.source}</span></div>
    </div>
  )
}

const Citations = ({ citations }: { citations: BikeBrandChatResponse['citations'] }) => {
  const { t } = useTranslation('bikeBrand')

  if (!citations.length)
    return <div className="system-xs-regular text-text-tertiary">{t('citations.empty')}</div>

  return (
    <div>
      <div className="system-xs-semibold text-text-secondary">{t('citations.title')}</div>
      <ol className="mt-1 space-y-2">
        {citations.map(citation => (
          <li key={citation.id} className="rounded-md border border-components-panel-border-subtle bg-background-section p-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <a className="system-xs-medium min-w-0 truncate text-text-accent" href={citation.source_uri} target="_blank" rel="noreferrer">{citation.title}</a>
              <span className="rounded bg-background-default px-1.5 py-0.5 system-2xs-medium text-text-tertiary">{t(`sourceType.${citation.source_type}`)}</span>
            </div>
            <p className="system-xs-regular mt-1 line-clamp-2 text-text-tertiary">{citation.snippet}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

const NextActions = ({ actions }: { actions: BikeBrandChatResponse['next_actions'] }) => {
  const { t } = useTranslation('bikeBrand')

  if (!actions.length)
    return <div className="system-xs-regular text-text-tertiary">{t('nextActions.empty')}</div>

  return (
    <div>
      <div className="system-xs-semibold text-text-secondary">{t('nextActions.title')}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {actions.map(action => (
          <span key={`${action.type}-${action.label}`} className="rounded-md border border-components-panel-border-subtle bg-background-section px-2 py-1 system-xs-regular text-text-secondary">
            {action.label}
            {action.requires_confirmation ? ` ${t('nextActions.confirmationRequired')}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

const EscalationStatus = ({ escalation }: { escalation: BikeBrandEscalation }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <div className="rounded-md border border-components-panel-border-subtle bg-background-section p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="system-xs-semibold text-text-secondary">{t('escalation.title')}</span>
        <span className="rounded bg-background-default px-1.5 py-0.5 system-xs-medium text-text-tertiary">
          {escalation.required ? t('escalation.required') : t('escalation.notRequired')}
        </span>
        {escalation.queue && (
          <span className="rounded bg-background-default px-1.5 py-0.5 system-xs-medium text-text-tertiary">
            {t(`escalation.queue.${escalation.queue}`)}
          </span>
        )}
      </div>
      {escalation.reason && <div className="system-xs-regular mt-1 text-text-tertiary">{escalation.reason}</div>}
      {!!escalation.required_fields?.length && (
        <div className="system-xs-regular mt-1 text-text-tertiary">
          {t('escalation.requiredFields')}: {escalation.required_fields.join(', ')}
        </div>
      )}
    </div>
  )
}

const FeedbackControls = ({
  comment,
  feedbackState,
  isPending,
  response,
  onCommentChange,
  onSendFeedback,
}: {
  comment: string
  feedbackState: 'idle' | 'sent' | 'error'
  isPending: boolean
  response?: BikeBrandChatResponse
  onCommentChange: (value: string) => void
  onSendFeedback: (rating: BikeBrandFeedbackRequest['rating']) => void
}) => {
  const { t } = useTranslation('bikeBrand')

  if (!response)
    return <div className="system-xs-regular text-text-tertiary">{t('feedback.waiting')}</div>

  return (
    <div className="min-w-0 flex-1">
      <label className="block">
        <span className="system-xs-medium text-text-tertiary">{t('feedback.comment')}</span>
        <input
          className="mt-1 h-8 w-full rounded-md border border-components-input-border bg-components-input-bg-normal px-2 system-xs-regular text-components-input-text-filled outline-none focus:border-components-input-border-active"
          value={comment}
          placeholder={t('feedback.commentPlaceholder')}
          onChange={event => onCommentChange(event.currentTarget.value)}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-components-button-secondary-border bg-components-button-secondary-bg px-2 system-xs-medium text-components-button-secondary-text hover:bg-components-button-secondary-bg-hover disabled:opacity-50"
          disabled={isPending}
          onClick={() => onSendFeedback('up')}
        >
          <RiThumbUpLine className="size-3.5" aria-hidden />
          {t('feedback.helpful')}
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-components-button-secondary-border bg-components-button-secondary-bg px-2 system-xs-medium text-components-button-secondary-text hover:bg-components-button-secondary-bg-hover disabled:opacity-50"
          disabled={isPending}
          onClick={() => onSendFeedback('down')}
        >
          <RiThumbDownLine className="size-3.5" aria-hidden />
          {t('feedback.notHelpful')}
        </button>
        {feedbackState === 'sent' && <span className="system-xs-regular text-text-success">{t('feedback.sent')}</span>}
        {feedbackState === 'error' && <span className="system-xs-regular text-text-warning">{t('feedback.failed')}</span>}
      </div>
    </div>
  )
}

const StatusPill = ({ status }: { status: BikeBrandStatus }) => {
  const { t } = useTranslation('bikeBrand')

  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 system-xs-medium ${statusStyles[status]}`}>
      {t(`status.${status}`)}
    </span>
  )
}

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-md border border-dashed border-divider-regular bg-background-section px-3 py-4 text-center system-sm-regular text-text-tertiary">
    {label}
  </div>
)

export default BikeBrandWorkbench
