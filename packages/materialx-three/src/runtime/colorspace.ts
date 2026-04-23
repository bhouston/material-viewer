import { mx_srgb_texture_to_lin_rec709 } from 'three/tsl';

type ColorSpaceTransform = (sampleNode: unknown) => unknown;

const colorSpaceTransforms: Record<string, ColorSpaceTransform> = {
  'srgb_texture->lin_rec709': (sampleNode) => mx_srgb_texture_to_lin_rec709(sampleNode as never),
};

export const applyTextureColorSpace = (
  sourceColorSpace: string | undefined,
  targetColorSpace: string | undefined,
  sampleNode: unknown,
): unknown => {
  if (!sourceColorSpace || !targetColorSpace || sourceColorSpace === targetColorSpace) {
    return sampleNode;
  }

  const transformKey = `${sourceColorSpace}->${targetColorSpace}`;
  const transform = colorSpaceTransforms[transformKey];
  return transform ? transform(sampleNode) : sampleNode;
};
