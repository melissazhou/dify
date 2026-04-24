import { createRoot } from 'react-dom/client'
import { BikeAssistantWidget } from '../src/BikeAssistantWidget'
import type { BikeAssistantRequestContext } from '../src/bffContract'

const productContext: BikeAssistantRequestContext = {
  tenant_id: 'example-bike',
  channel: 'product_detail_page',
  product: {
    sku: 'URB-E-500-2025-M',
    model: 'Urban E 500',
    model_year: 2025,
    product_url: window.location.href,
    battery_model: 'PowerPack 500',
    drive_system_vendor: 'Bosch',
  },
  user: {
    audience: 'consumer',
    anonymous_id: getAnonymousVisitorId(),
    consent_to_store_chat: true,
    locale: navigator.language,
  },
  session: {
    session_id: getAssistantSessionId(),
    page_url: window.location.href,
    referrer: document.referrer || undefined,
  },
  market: {
    market: 'north-america',
    country: 'US',
    language: 'en-US',
    currency: 'USD',
  },
}

createRoot(document.getElementById('bike-assistant-root') as HTMLElement).render(
  <BikeAssistantWidget
    context={productContext}
    initialPrompt="Can this bike fit a rear child seat?"
  />,
)

function getAssistantSessionId(): string {
  const key = 'bike_assistant_session_id'
  const current = window.sessionStorage.getItem(key)
  if (current)
    return current

  const next = crypto.randomUUID()
  window.sessionStorage.setItem(key, next)
  return next
}

function getAnonymousVisitorId(): string {
  const key = 'bike_assistant_visitor_id'
  const current = window.localStorage.getItem(key)
  if (current)
    return current

  const next = crypto.randomUUID()
  window.localStorage.setItem(key, next)
  return next
}
