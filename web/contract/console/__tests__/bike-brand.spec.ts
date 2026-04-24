import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const readContractSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

describe('bike brand console contract', () => {
  // Contract source should expose all service-layer operations used by the component.
  describe('Routes', () => {
    it('should define summary, assets, chat, and feedback routes', () => {
      const source = readContractSource('../bike-brand.ts')

      expect(source).toContain('bikeBrandSummaryContract')
      expect(source).toContain('bikeBrandAssetsContract')
      expect(source).toContain('bikeBrandChatContract')
      expect(source).toContain('bikeBrandFeedbackContract')
      expect(source).toContain("path: '/bike-brand/solution-kit/summary'")
      expect(source).toContain("path: '/bike-brand/solution-kit/assets/{section}'")
      expect(source).toContain("path: '/bike-brand/assistant/chat'")
      expect(source).toContain("path: '/bike-brand/assistant/feedback'")
      expect(source).toContain("method: 'GET'")
      expect(source).toContain("method: 'POST'")
    })
  })

  // Router wiring ensures consoleQuery/client can reach the contract in component tests.
  describe('Router wiring', () => {
    it('should mount bikeBrand on the console router contract', () => {
      const routerSource = readContractSource('../../router.ts')

      expect(routerSource).toContain("from './console/bike-brand'")
      expect(routerSource).toContain('bikeBrand:')
      expect(routerSource).toContain('bikeBrandSummaryContract')
      expect(routerSource).toContain('bikeBrandFeedbackContract')
    })
  })
})
