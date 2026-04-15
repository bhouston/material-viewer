import { parseMaterialX } from '@materialx-js/materialx/dist/xml.js'
import { createThreeMaterialFromDocument } from '@materialx-js/materialx-three'
import { ClientOnly, createFileRoute, useHydrated } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MaterialViewport from '../components/MaterialViewport'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Separator } from '../components/ui/separator'
import { Textarea } from '../components/ui/textarea'
import { loadMaterialXBackgroundPack, materialXBackgroundPacks } from '../lib/backgrounds'
import { createBrowserTextureResolver } from '../lib/browser-texture-resolver'
import { importMaterialXBundle } from '../lib/materialx-import'
import { getMaterialXSamplePacks, loadMaterialXSampleById } from '../lib/materialx-samples.functions'

export const Route = createFileRoute('/')({
  loader: async () => {
    const samplePacks = await getMaterialXSamplePacks()
    const firstSampleId = samplePacks[0]?.id
    const initialSample = firstSampleId ? await loadMaterialXSampleById({ data: { id: firstSampleId } }) : undefined
    return { samplePacks, initialSample }
  },
  component: App,
})

function App() {
  const { samplePacks, initialSample } = Route.useLoaderData()
  const hydrated = useHydrated()
  const [selectedSample, setSelectedSample] = useState(samplePacks[0]?.id ?? '')
  const [xml, setXml] = useState(initialSample?.xml ?? '')
  const [sampleLabel, setSampleLabel] = useState(samplePacks[0]?.label ?? 'Custom')
  const [selectedBackground, setSelectedBackground] = useState(materialXBackgroundPacks[0]?.id ?? '')
  const [backgroundXml, setBackgroundXml] = useState('')
  const [backgroundError, setBackgroundError] = useState<string>()
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>(initialSample?.assets ?? {})
  const [loadedAssets, setLoadedAssets] = useState<string[]>(Object.keys(initialSample?.assets ?? {}))
  const [isDragging, setIsDragging] = useState(false)
  const [dropMessage, setDropMessage] = useState('Drop a .mtlx and related textures, or click to select files')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadedObjectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    return () => {
      for (const objectUrl of uploadedObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl)
      }
      uploadedObjectUrlsRef.current = []
    }
  }, [])

  const compileState = useMemo(() => {
    if (!hydrated) {
      return {
        error: 'Preparing client-side compiler...',
        result: undefined,
        material: undefined,
      }
    }
    try {
      if (!xml.trim()) {
        return {
          error: 'Loading sample...',
          result: undefined,
          material: undefined,
        }
      }
      const document = parseMaterialX(xml)
      const { material, result } = createThreeMaterialFromDocument(document, {
        textureResolver: createBrowserTextureResolver(assetUrls),
      })
      return {
        error: undefined,
        result,
        material,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to compile document',
        result: undefined,
        material: undefined,
      }
    }
  }, [assetUrls, hydrated, xml])

  const backgroundCompileState = useMemo(() => {
    if (!hydrated) {
      return {
        error: undefined,
        material: undefined,
      }
    }
    try {
      if (!backgroundXml.trim()) {
        return {
          error: undefined,
          material: undefined,
        }
      }
      const document = parseMaterialX(backgroundXml)
      const { material } = createThreeMaterialFromDocument(document)
      return {
        error: undefined,
        material,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to compile background document',
        material: undefined,
      }
    }
  }, [backgroundXml, hydrated])

  const handleSampleChange = useCallback(async (sampleId: string) => {
    setSelectedSample(sampleId)
    const sample = samplePacks.find((entry) => entry.id === sampleId)
    if (!sample) {
      return
    }
    for (const objectUrl of uploadedObjectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl)
    }
    uploadedObjectUrlsRef.current = []
    try {
      const loaded = await loadMaterialXSampleById({ data: { id: sample.id } })
      setSampleLabel(sample.label)
      setXml(loaded.xml)
      setAssetUrls(loaded.assets)
      setLoadedAssets(Object.keys(loaded.assets))
      setDropMessage('Drop a .mtlx and related textures, or click to select files')
    } catch (error) {
      setSampleLabel(sample.label)
      setXml('')
      setAssetUrls({})
      setLoadedAssets([])
      setDropMessage(error instanceof Error ? error.message : 'Could not load built-in sample')
    }
  }, [samplePacks])

  const handleBackgroundChange = useCallback(async (backgroundId: string) => {
    setSelectedBackground(backgroundId)
    const background = materialXBackgroundPacks.find((entry) => entry.id === backgroundId)
    if (!background) {
      return
    }
    try {
      const loadedXml = await loadMaterialXBackgroundPack(background)
      setBackgroundXml(loadedXml)
      setBackgroundError(undefined)
    } catch (error) {
      setBackgroundXml('')
      setBackgroundError(error instanceof Error ? error.message : 'Could not load built-in background')
    }
  }, [])

  useEffect(() => {
    const initial = materialXBackgroundPacks[0]
    void handleBackgroundChange(initial.id)
  }, [handleBackgroundChange])

  const importFiles = useCallback(async (files: File[]) => {
    try {
      const bundle = await importMaterialXBundle(files)
      for (const objectUrl of uploadedObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl)
      }
      uploadedObjectUrlsRef.current = bundle.objectUrls
      setSelectedSample('')
      setSampleLabel(bundle.label)
      setXml(bundle.xml)
      setAssetUrls(bundle.assetUrls)
      setLoadedAssets(Object.keys(bundle.assetUrls))
      setDropMessage(
        bundle.objectUrls.length > 0
          ? `Loaded ${bundle.label} with ${bundle.objectUrls.length} related file(s)`
          : `Loaded ${bundle.label} (no related texture files provided)`,
      )
    } catch (error) {
      setDropMessage(error instanceof Error ? error.message : 'Could not import dropped files')
    }
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const files = [...event.dataTransfer.files]
      if (files.length === 0) {
        return
      }
      void importFiles(files)
    },
    [importFiles],
  )

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? [...event.target.files] : []
      if (files.length === 0) {
        return
      }
      void importFiles(files)
      event.target.value = ''
    },
    [importFiles],
  )

  return (
    <div className="page-wrap space-y-6">
      <Card className="panel-surface">
        <CardHeader className="space-y-3">
          <Badge className="w-fit" variant="secondary">
            MaterialX Tooling
          </Badge>
          <div className="space-y-1">
            <CardTitle className="text-2xl md:text-3xl">MaterialX Viewer</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6">
              Load a MaterialX document, compile it with <code>@materialx-js/materialx-three</code>, and inspect
              diagnostics while previewing materials in real time.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="panel-surface">
            <CardHeader>
              <CardTitle className="text-base">Source Selection</CardTitle>
              <CardDescription>Start from a built-in sample or import your own MaterialX bundle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sample">Built-in sample</Label>
                <Select
                  className="min-w-[280px]"
                  id="sample"
                  onChange={(event) => {
                    void handleSampleChange(event.target.value)
                  }}
                  value={selectedSample}
                >
                  {samplePacks.map((sample) => (
                    <option key={sample.id} value={sample.id}>
                      {sample.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                className={`h-auto w-full justify-start border-2 border-dashed px-4 py-4 text-left ${
                  isDragging ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDrop={handleDrop}
                type="button"
                variant="outline"
              >
                <input
                  accept=".mtlx,.png,.jpg,.jpeg,.webp,.gif,.exr,.hdr"
                  className="hidden"
                  multiple
                  onChange={handleFileInput}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="space-y-1">
                  <p className="m-0 text-sm font-semibold">Drag and drop files</p>
                  <p className="m-0 text-xs font-normal text-muted-foreground">{dropMessage}</p>
                </div>
              </Button>
              <div className="panel-muted px-3 py-2 text-xs text-muted-foreground">
                Active source: <code>{sampleLabel}</code>
              </div>
            </CardContent>
          </Card>

          <ClientOnly
            fallback={
              <Card className="panel-surface">
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>Initializing 3D viewport...</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[420px] w-full rounded-lg border border-border/90 bg-muted/40" />
                </CardContent>
              </Card>
            }
          >
            <MaterialViewport
              backgroundError={backgroundError ?? backgroundCompileState.error}
              backgroundMaterial={backgroundCompileState.material}
              backgroundPacks={materialXBackgroundPacks}
              nodeMaterial={compileState.material}
              onBackgroundChange={(backgroundId) => {
                void handleBackgroundChange(backgroundId)
              }}
              selectedBackground={selectedBackground}
            />
          </ClientOnly>

          <Card className="panel-surface">
            <CardHeader>
              <CardTitle className="text-base">MaterialX Source</CardTitle>
              <CardDescription>Directly edit the active MaterialX document and recompile instantly.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[460px] text-xs leading-5"
                onChange={(event) => setXml(event.target.value)}
                rows={20}
                spellCheck={false}
                value={xml}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="panel-surface h-fit">
          <CardHeader>
            <CardTitle className="text-base">Compilation Diagnostics</CardTitle>
            <CardDescription>Inspect compiler output, warnings, unsupported categories, and imported assets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {compileState.error ? (
              <p className="m-0 text-destructive">{compileState.error}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="m-0">
                    Material: <code>{compileState.result?.materialName ?? 'n/a'}</code>
                  </p>
                  <p className="m-0">
                    Surface shader: <code>{compileState.result?.surfaceShaderName ?? 'n/a'}</code>
                  </p>
                  <p className="m-0">Supported in document: {compileState.result?.supportedCategories.length ?? 0}</p>
                  <p className="m-0">Unsupported in document: {compileState.result?.unsupportedCategories.length ?? 0}</p>
                  <p className="m-0">Related assets available: {loadedAssets.length}</p>
                </div>
                <Separator />
                <details>
                  <summary className="cursor-pointer font-medium">Warnings ({compileState.result?.warnings.length ?? 0})</summary>
                  <ul className="m-0 mt-2 space-y-1 pl-5">
                    {(compileState.result?.warnings ?? []).map((warning) => (
                      <li key={`${warning.code}-${warning.nodeName ?? warning.message}`}>{warning.message}</li>
                    ))}
                    {(compileState.result?.warnings.length ?? 0) === 0 ? <li>No warnings.</li> : null}
                  </ul>
                </details>
                <details>
                  <summary className="cursor-pointer font-medium">Unsupported categories</summary>
                  <ul className="m-0 mt-2 max-h-44 overflow-auto pl-5">
                    {(compileState.result?.unsupportedCategories ?? []).map((entry) => (
                      <li key={entry}>
                        <code>{entry}</code>
                      </li>
                    ))}
                    {(compileState.result?.unsupportedCategories.length ?? 0) === 0 ? <li>None</li> : null}
                  </ul>
                </details>
                <details>
                  <summary className="cursor-pointer font-medium">Loaded related files</summary>
                  <ul className="m-0 mt-2 max-h-44 overflow-auto pl-5">
                    {loadedAssets.map((entry) => (
                      <li key={entry}>
                        <code>{entry}</code>
                      </li>
                    ))}
                    {loadedAssets.length === 0 ? <li>None</li> : null}
                  </ul>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
