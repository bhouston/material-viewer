import { WebGLRenderer } from 'three';

interface RendererFactoryOptions {
  canvas: unknown;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: WebGLPowerPreference;
}

export const createViewerRenderer = async (
  options: RendererFactoryOptions,
  onRendererLabelChange: (label: string) => void,
) => {
  if (!(options.canvas instanceof HTMLCanvasElement)) {
    onRendererLabelChange('WebGL fallback');
    return new WebGLRenderer({
      ...options,
      canvas: options.canvas as never,
    });
  }

  const useWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  if (useWebGPU) {
    try {
      const webgpu = await import('three/webgpu');
      const renderer = new webgpu.WebGPURenderer(options);
      await renderer.init();
      onRendererLabelChange('WebGPU + TSL');
      return renderer;
    } catch {
      // Fall through to WebGL when WebGPU initialization fails.
    }
  }

  onRendererLabelChange('WebGL fallback');
  return new WebGLRenderer(options);
};
