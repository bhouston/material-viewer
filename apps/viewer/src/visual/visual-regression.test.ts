import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  assertViewerHealthy,
  computeBaselineDiffRatio,
  ensureViewerBuild,
  getViewerSamples,
  loadSampleInViewer,
  openViewerBrowserPage,
  readViewerHealthReport,
  resetViewerRuntimeState,
  startViewerPreviewServer,
} from './playwright-harness'
import type { ViewerServerHandle } from './playwright-harness'

describe('viewer visual regression', () => {
  let server: ViewerServerHandle | undefined
  let stopBrowser: (() => Promise<void>) | undefined
  let page = null as Awaited<ReturnType<typeof openViewerBrowserPage>>['page'] | null

  beforeAll(async () => {
    await ensureViewerBuild()
    server = await startViewerPreviewServer()
    const browserSession = await openViewerBrowserPage(server.url)
    page = browserSession.page
    stopBrowser = async () => {
      await browserSession.page.close()
      await browserSession.browser.close()
    }
  }, 180_000)

  afterAll(async () => {
    if (stopBrowser) {
      await stopBrowser()
      stopBrowser = undefined
    }
    if (server) {
      await server.stop()
      server = undefined
    }
  })

  test(
    'every sample matches preview.webp and stays healthy',
    async () => {
      if (!page) {
        throw new Error('Playwright page was not initialized')
      }
      const samples = await getViewerSamples()
      expect(samples.length).toBeGreaterThan(0)
      const sampleIdsFilter = process.env.VIEWER_SAMPLE_IDS
        ?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
      const filteredSamples = sampleIdsFilter ? samples.filter((sample) => sampleIdsFilter.includes(sample.id)) : samples
      const sampleLimitRaw = process.env.VIEWER_SAMPLE_LIMIT
      const sampleLimit = sampleLimitRaw ? Number.parseInt(sampleLimitRaw, 10) : undefined
      const targetSamples =
        sampleLimit !== undefined && Number.isFinite(sampleLimit) ? filteredSamples.slice(0, sampleLimit) : filteredSamples
      for (const sample of targetSamples) {
        await resetViewerRuntimeState(page)
        await loadSampleInViewer(page, sample)
        const report = await readViewerHealthReport(page)
        assertViewerHealthy(sample, report)
        const diffRatio = await computeBaselineDiffRatio(page, sample)
        expect(diffRatio, `visual mismatch for sample ${sample.id}`).toBeLessThanOrEqual(0.01)
      }
    },
    600_000,
  )
})
