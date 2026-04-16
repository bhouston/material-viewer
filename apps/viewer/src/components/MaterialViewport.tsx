import { useEffect, useRef, useState } from 'react';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { MaterialXBackgroundPack } from '../lib/backgrounds';
import Viewer from './Viewer';
import type { PreviewGeometry, ViewerHandle } from './Viewer';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select } from './ui/select';

interface MaterialViewportProps {
  nodeMaterial?: MeshPhysicalNodeMaterial;
  backgroundMaterial?: MeshPhysicalNodeMaterial;
  backgroundPacks: MaterialXBackgroundPack[];
  selectedBackground: string;
  onBackgroundChange: (backgroundId: string) => void;
  onPreviewGeometryChange?: (geometry: PreviewGeometry) => void;
  backgroundError?: string;
  initialPreviewGeometry?: PreviewGeometry;
  lockPreviewGeometry?: boolean;
  lockBackground?: boolean;
  showControls?: boolean;
  variant?: 'panel' | 'bare';
  viewerClassName?: string;
  viewerFixedSize?: number;
}

export default function MaterialViewport({
  nodeMaterial,
  backgroundMaterial,
  backgroundPacks,
  selectedBackground,
  onBackgroundChange,
  onPreviewGeometryChange,
  backgroundError,
  initialPreviewGeometry = 'totem',
  lockPreviewGeometry = false,
  lockBackground = false,
  showControls = true,
  variant = 'panel',
  viewerClassName,
  viewerFixedSize,
}: MaterialViewportProps) {
  const viewerRef = useRef<ViewerHandle | null>(null);
  const [rendererLabel, setRendererLabel] = useState('WebGL fallback');
  const [previewGeometry, setPreviewGeometry] = useState<PreviewGeometry>(initialPreviewGeometry);
  const [previewGeometryError, setPreviewGeometryError] = useState<string>();

  useEffect(() => {
    setPreviewGeometry(initialPreviewGeometry);
  }, [initialPreviewGeometry]);

  const handlePreviewGeometryChange = (geometry: PreviewGeometry) => {
    setPreviewGeometry(geometry);
    onPreviewGeometryChange?.(geometry);
  };

  const handleResetView = () => {
    viewerRef.current?.resetView();
  };

  const viewerElement = (
    <Viewer
      ref={viewerRef}
      backgroundMaterial={backgroundMaterial}
      fixedSize={viewerFixedSize}
      nodeMaterial={nodeMaterial}
      onPreviewGeometryErrorChange={setPreviewGeometryError}
      onPreviewGeometryFallback={handlePreviewGeometryChange}
      onRendererLabelChange={setRendererLabel}
      previewGeometry={previewGeometry}
      viewportClassName={viewerClassName}
    />
  );

  const controlBlock = showControls ? (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Preview</CardTitle>
        <span className="rounded-md border border-border/80 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
          {rendererLabel}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,140px)_minmax(0,220px)_auto] md:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.12em] text-muted-foreground" htmlFor="preview-geometry">
            Model
          </Label>
          <Select
            className="text-xs"
            id="preview-geometry"
            data-testid="preview-geometry-select"
            disabled={lockPreviewGeometry}
            onChange={(event) => handlePreviewGeometryChange(event.target.value as PreviewGeometry)}
            value={previewGeometry}
          >
            <option value="totem">Totem</option>
            <option value="sphere">Sphere</option>
            <option value="cube">Cube</option>
            <option value="plane">Plane</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.12em] text-muted-foreground" htmlFor="background">
            Background
          </Label>
          <Select
            className="text-xs"
            id="background"
            data-testid="background-select"
            disabled={lockBackground}
            onChange={(event) => onBackgroundChange(event.target.value)}
            value={selectedBackground}
          >
            {backgroundPacks.map((background) => (
              <option key={background.id} value={background.id}>
                {background.directory}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:justify-self-end">
          <Button
            className="w-full md:w-auto"
            data-testid="preview-reset-view"
            onClick={handleResetView}
            size="sm"
            type="button"
            variant="outline"
          >
            Reset view
          </Button>
        </div>
      </div>
    </>
  ) : null;

  const errorBlock = (
    <>
      {backgroundError ? (
        <p className="m-0 text-xs text-destructive" data-testid="background-error-message">
          {backgroundError}
        </p>
      ) : null}
      {previewGeometryError ? (
        <p className="m-0 text-xs text-destructive" data-testid="preview-geometry-error-message">
          {previewGeometryError}
        </p>
      ) : null}
    </>
  );

  if (variant === 'bare') {
    return (
      <div className="h-full w-full space-y-2">
        {errorBlock}
        {viewerElement}
      </div>
    );
  }

  return (
    <Card className="panel-surface">
      {showControls ? <CardHeader className="space-y-4">{controlBlock}</CardHeader> : null}
      <CardContent className="space-y-2">
        {errorBlock}
        {viewerElement}
      </CardContent>
    </Card>
  );
}
