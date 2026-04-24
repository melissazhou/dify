import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  BikeAssistantBffTransport,
} from './bffContract'
import type {
  BikeAssistantChatResponse,
  BikeAssistantErrorResponse,
  BikeAssistantFeedbackRequest,
  BikeAssistantRequestContext,
  BikeAssistantTransport,
} from './bffContract'

export interface BikeAssistantWidgetProps {
  context: BikeAssistantRequestContext
  initialPrompt?: string
  transport?: BikeAssistantTransport
}

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  response?: BikeAssistantChatResponse
  error?: BikeAssistantErrorResponse
}

export function BikeAssistantWidget({
  context,
  initialPrompt = '',
  transport,
}: BikeAssistantWidgetProps) {
  const bff = useMemo(() => transport ?? new BikeAssistantBffTransport(), [transport])
  const [input, setInput] = useState(initialPrompt)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [isSending, setIsSending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const message = input.trim()
    if (!message || isSending)
      return

    const clientTraceId = crypto.randomUUID()
    setInput('')
    setIsSending(true)
    setTurns(current => [
      ...current,
      { id: clientTraceId, role: 'user', text: message },
    ])

    try {
      const response = await bff.chat({
        message,
        context,
        client_trace_id: clientTraceId,
      })

      setTurns(current => [
        ...current,
        {
          id: response.message_id,
          role: 'assistant',
          text: response.answer,
          response,
        },
      ])
    }
    catch (error) {
      const assistantError = error as BikeAssistantErrorResponse
      setTurns(current => [
        ...current,
        {
          id: `${clientTraceId}-error`,
          role: 'assistant',
          text: assistantError.error.message,
          error: assistantError,
        },
      ])
    }
    finally {
      setIsSending(false)
    }
  }

  async function sendFeedback(response: BikeAssistantChatResponse, rating: 'up' | 'down') {
    const request: BikeAssistantFeedbackRequest = {
      message_id: response.message_id,
      conversation_id: response.conversation_id,
      rating,
      reason: rating === 'down' ? 'not_helpful' : undefined,
      client_trace_id: crypto.randomUUID(),
    }

    await bff.sendFeedback(request)
  }

  return (
    <section className="bike-assistant" aria-label="Bike assistant">
      <header className="bike-assistant__header">
        <h2>Bike assistant</h2>
        <p>
          {context.market.market} · {context.market.language}
          {context.product?.sku ? ` · SKU ${context.product.sku}` : ''}
        </p>
      </header>

      <div className="bike-assistant__turns" aria-live="polite">
        {turns.map(turn => (
          <article key={turn.id} className={`bike-assistant__turn bike-assistant__turn--${turn.role}`}>
            <p>{turn.text}</p>

            {turn.response && (
              <>
                <CitationList response={turn.response} />
                <NextActions response={turn.response} />
                <EscalationStatus response={turn.response} />
                <FeedbackControls response={turn.response} onFeedback={sendFeedback} />
              </>
            )}

            {turn.error?.error.escalation && (
              <p className="bike-assistant__handoff">
                Handoff: {turn.error.error.escalation.status}
                {turn.error.error.escalation.reason ? ` (${turn.error.error.escalation.reason})` : ''}
              </p>
            )}
          </article>
        ))}
      </div>

      <form className="bike-assistant__composer" onSubmit={submit}>
        <label htmlFor="bike-assistant-message">Message</label>
        <textarea
          id="bike-assistant-message"
          value={input}
          placeholder="Ask about sizing, compatibility, service, warranty, or order help"
          rows={3}
          onChange={event => setInput(event.currentTarget.value)}
        />
        <button type="submit" disabled={isSending}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  )
}

function CitationList({ response }: { response: BikeAssistantChatResponse }) {
  if (response.citations.length === 0)
    return <p className="bike-assistant__citations-empty">No citations returned.</p>

  return (
    <ol className="bike-assistant__citations" aria-label="Sources">
      {response.citations.map(citation => (
        <li key={citation.id}>
          {citation.source_uri
            ? <a href={citation.source_uri}>{citation.title}</a>
            : <span>{citation.title}</span>}
          {citation.document_version ? <small> v{citation.document_version}</small> : null}
          {citation.snippet ? <blockquote>{citation.snippet}</blockquote> : null}
        </li>
      ))}
    </ol>
  )
}

function NextActions({ response }: { response: BikeAssistantChatResponse }) {
  if (response.next_actions.length === 0)
    return null

  return (
    <div className="bike-assistant__actions" aria-label="Next actions">
      {response.next_actions.map(action => (
        action.href
          ? (
            <a key={action.type} href={action.href} data-action={action.type}>
              {action.label}
            </a>
          )
          : (
            <button key={action.type} type="button" data-action={action.type}>
              {action.label}
            </button>
          )
      ))}
    </div>
  )
}

function EscalationStatus({ response }: { response: BikeAssistantChatResponse }) {
  if (response.escalation.status === 'not_needed')
    return null

  return (
    <aside className="bike-assistant__handoff" aria-label="Human support status">
      <strong>Human support:</strong> {response.escalation.status}
      {response.escalation.queue ? ` · ${response.escalation.queue}` : ''}
      {response.escalation.ticket_id ? ` · Ticket ${response.escalation.ticket_id}` : ''}
      {response.escalation.eta_minutes ? ` · ETA ${response.escalation.eta_minutes} min` : ''}
    </aside>
  )
}

function FeedbackControls({
  response,
  onFeedback,
}: {
  response: BikeAssistantChatResponse
  onFeedback: (response: BikeAssistantChatResponse, rating: 'up' | 'down') => Promise<void>
}) {
  if (!response.feedback.enabled)
    return null

  return (
    <div className="bike-assistant__feedback" aria-label="Answer feedback">
      <button type="button" onClick={() => void onFeedback(response, 'up')}>
        Helpful
      </button>
      <button type="button" onClick={() => void onFeedback(response, 'down')}>
        Not helpful
      </button>
    </div>
  )
}
