import {
  assertViewerHealthy,
  captureViewerWebp,
  ensureViewerBuild,
  getViewerSamples,
  loadSampleInViewer,
  openViewerBrowserPage,
  readViewerHealthReport,
  resetViewerRuntimeState,
  startViewerPreviewServer,
  writeSamplePreview,
} from '../src/visual/playwright-harness.ts'

const main = async (): Promise<void> => {
  await ensureViewerBuild()
  const server = await startViewerPreviewServer()
  try {
    const { browser, page } = await openViewerBrowserPage(server.url)
    try {
      const samples = await getViewerSamples(page)
      if (samples.length === 0) {
        throw new Error('No samples were found in the viewer sample selector')
      }
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
        const webp = await captureViewerWebp(page)
        await writeSamplePreview(sample, webp)
        console.log(`wrote preview.webp for ${sample.directory}`)
      }
    } finally {
      await page.close()
      await browser.close()
    }
  } finally {
    await server.stop()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
