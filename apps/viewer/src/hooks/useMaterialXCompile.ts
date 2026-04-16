import { parseMaterialX } from '@materialx-js/materialx/dist/xml.js'
import { createThreeMaterialFromDocument } from '@materialx-js/materialx-three'
import { useMemo } from 'react'
import { createBrowserTextureResolver } from '../lib/browser-texture-resolver'

interface UseMaterialXCompileOptions {
  xml: string
  assetUrls: Record<string, string>
  hydrated: boolean
}

export const useMaterialXCompile = ({ xml, assetUrls, hydrated }: UseMaterialXCompileOptions) => {
  return useMemo(() => {
    if (!hydrated || !xml.trim()) {
      return { error: undefined, result: undefined, material: undefined }
    }

    try {
      const document = parseMaterialX(xml)
      const { material, result } = createThreeMaterialFromDocument(document, {
        textureResolver: createBrowserTextureResolver(assetUrls),
      })
      return { error: undefined, result, material }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to compile document',
        result: undefined,
        material: undefined,
      }
    }
  }, [assetUrls, hydrated, xml])
}
