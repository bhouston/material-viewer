import { Canvas, type RootState } from '@react-three/fiber';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ViewerScene } from './viewer/ViewerScene';
import { createViewerRenderer } from './viewer/renderer-factory';

export type PreviewGeometry = 'totem' | 'sphere' | 'cube' | 'plane';

export interface ViewerHandle {
  resetView: () => void;
}

interface ViewerProps {
  nodeMaterial?: MeshPhysicalNodeMaterial;
  backgroundMaterial?: MeshPhysicalNodeMaterial;
  previewGeometry: PreviewGeometry;
  fixedSize?: number;
  enableControls?: boolean;
  idleAutoRotate?: boolean;
  viewportClassName?: string;
  onRendererLabelChange: (label: string) => void;
  onPreviewGeometryErrorChange: (message?: string) => void;
  onPreviewGeometryFallback: (geometry: PreviewGeometry) => void;
}

const DEFAULT_CAMERA_POSITION = { x: 0, y: 0, z: 3.2 };

const Viewer = forwardRef<ViewerHandle, ViewerProps>(function ViewerImpl(
  {
    nodeMaterial,
    backgroundMaterial,
    previewGeometry,
    fixedSize,
    enableControls = true,
    idleAutoRotate = true,
    viewportClassName,
    onRendererLabelChange,
    onPreviewGeometryErrorChange,
    onPreviewGeometryFallback,
  },
  ref,
) {
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const onRendererLabelChangeRef = useRef(onRendererLabelChange);
  const onPreviewGeometryErrorChangeRef = useRef(onPreviewGeometryErrorChange);
  const onPreviewGeometryFallbackRef = useRef(onPreviewGeometryFallback);

  useEffect(() => {
    onRendererLabelChangeRef.current = onRendererLabelChange;
  }, [onRendererLabelChange]);

  useEffect(() => {
    onPreviewGeometryErrorChangeRef.current = onPreviewGeometryErrorChange;
  }, [onPreviewGeometryErrorChange]);

  useEffect(() => {
    onPreviewGeometryFallbackRef.current = onPreviewGeometryFallback;
  }, [onPreviewGeometryFallback]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) {
        return;
      }
      camera.position.set(DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.y, DEFAULT_CAMERA_POSITION.z);
      controls.target.set(0, 0, 0);
      controls.update();
    },
  }));

  const setCameraRef = useCallback((camera: PerspectiveCamera | null) => {
    cameraRef.current = camera;
  }, []);
  const setControlsRef = useCallback((controls: OrbitControlsImpl | null) => {
    controlsRef.current = controls;
  }, []);

  const handleCanvasCreated = useCallback((state: RootState) => {
    state.gl.domElement.setAttribute('data-testid', 'viewer-canvas');
  }, []);

  return (
    <div
      className={
        viewportClassName ??
        'h-[420px] w-full overflow-hidden rounded-lg border border-border/90 bg-background shadow-inner'
      }
      data-testid="viewer-render-target"
      style={fixedSize ? { width: fixedSize, height: fixedSize } : undefined}
    >
      <Canvas
        camera={{
          fov: 40,
          near: 0.1,
          far: 100,
          position: [DEFAULT_CAMERA_POSITION.x, DEFAULT_CAMERA_POSITION.y, DEFAULT_CAMERA_POSITION.z],
        }}
        className="block h-full w-full"
        dpr={[1, 2]}
        gl={async (rendererOptions) =>
          createViewerRenderer(rendererOptions, (label) => onRendererLabelChangeRef.current(label))
        }
        onCreated={handleCanvasCreated}
      >
        <ViewerScene
          backgroundMaterial={backgroundMaterial}
          enableControls={enableControls}
          idleAutoRotate={idleAutoRotate}
          nodeMaterial={nodeMaterial}
          onCameraReady={setCameraRef}
          onControlsReady={setControlsRef}
          onPreviewGeometryErrorChange={(message) => onPreviewGeometryErrorChangeRef.current(message)}
          onPreviewGeometryFallback={(geometry) => {
            if (previewGeometry === 'totem') {
              onPreviewGeometryFallbackRef.current(geometry);
            }
          }}
          previewGeometry={previewGeometry}
        />
      </Canvas>
    </div>
  );
});

export default Viewer;
