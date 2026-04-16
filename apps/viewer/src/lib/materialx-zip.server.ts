import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { getMaterialXSamplePackByMaterialName } from './materialx-samples.server'

const EXAMPLES_DIR = fileURLToPath(new URL('../../public/examples', import.meta.url))
const MATERIAL_FILENAME = 'material.mtlx'

export interface MaterialXZipPayload {
  zip: Uint8Array
  sampleDirectory: string
}

export const createMaterialXZipPayloadByMaterialName = async (
  materialName: string,
): Promise<MaterialXZipPayload | undefined> => {
  const sample = await getMaterialXSamplePackByMaterialName(materialName)
  if (!sample) {
    return undefined
  }

  const sampleRoot = path.join(EXAMPLES_DIR, sample.directory)
  const zip = new JSZip()

  const materialXml = await fs.readFile(path.join(sampleRoot, MATERIAL_FILENAME), 'utf8')
  zip.file(MATERIAL_FILENAME, materialXml)

  for (const assetPath of sample.assets) {
    const assetBuffer = await fs.readFile(path.join(sampleRoot, assetPath))
    zip.file(assetPath, assetBuffer)
  }

  const payload = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 9 } })

  return {
    zip: payload,
    sampleDirectory: sample.directory,
  }
}
