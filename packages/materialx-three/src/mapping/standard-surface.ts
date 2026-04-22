import type { MaterialXNode } from '@materialx-js/materialx';
import { clamp, float, mul } from 'three/tsl';
import type { MaterialSlotAssignments } from '../types.js';

export interface StandardSurfaceInputs {
  getInputNode(node: MaterialXNode, name: string, fallback: unknown): unknown;
}

export const buildStandardSurfaceAssignments = (
  surfaceNode: MaterialXNode,
  helpers: StandardSurfaceInputs,
): MaterialSlotAssignments => {
  const hasInput = (name: string) => surfaceNode.inputs.some((input) => input.name === name);
  const hasBaseInput = hasInput('base');
  const hasBaseColorInput = hasInput('base_color');
  const base = hasBaseInput ? helpers.getInputNode(surfaceNode, 'base', 1) : undefined;
  const baseColor = hasBaseColorInput ? helpers.getInputNode(surfaceNode, 'base_color', [0.8, 0.8, 0.8]) : undefined;
  const roughness = hasInput('specular_roughness')
    ? helpers.getInputNode(surfaceNode, 'specular_roughness', 0.2)
    : helpers.getInputNode(surfaceNode, 'roughness', 0.2);
  const metalness = helpers.getInputNode(surfaceNode, 'metalness', 0);
  const specular = helpers.getInputNode(surfaceNode, 'specular', 1);
  const specularColor = helpers.getInputNode(surfaceNode, 'specular_color', [1, 1, 1]);
  const anisotropy = helpers.getInputNode(surfaceNode, 'specular_anisotropy', 0);
  const anisotropyRotation = helpers.getInputNode(surfaceNode, 'specular_rotation', 0);
  const coat = helpers.getInputNode(surfaceNode, 'coat', 0);
  const coatColor = hasInput('coat_color') ? helpers.getInputNode(surfaceNode, 'coat_color', [1, 1, 1]) : undefined;
  const coatRoughness = helpers.getInputNode(surfaceNode, 'coat_roughness', 0.1);
  const coatNormal = helpers.getInputNode(surfaceNode, 'coat_normal', undefined);
  const sheen = helpers.getInputNode(surfaceNode, 'sheen', 0);
  const sheenColor = helpers.getInputNode(surfaceNode, 'sheen_color', [1, 1, 1]);
  const sheenRoughness = helpers.getInputNode(surfaceNode, 'sheen_roughness', 0.3);
  const hasEmissionColor = hasInput('emission_color');
  const hasLegacyEmissionColor = hasInput('emissionColor');
  const emissionColor =
    hasEmissionColor || hasLegacyEmissionColor
      ? helpers.getInputNode(surfaceNode, hasEmissionColor ? 'emission_color' : 'emissionColor', [0, 0, 0])
      : undefined;
  const emissionAmount = hasInput('emission') ? helpers.getInputNode(surfaceNode, 'emission', 0) : undefined;
  const opacity = helpers.getInputNode(surfaceNode, 'opacity', undefined);
  const transmission = helpers.getInputNode(surfaceNode, 'transmission', 0);
  const transmissionColor = helpers.getInputNode(surfaceNode, 'transmission_color', [1, 1, 1]);
  const transmissionDepth = helpers.getInputNode(surfaceNode, 'transmission_depth', 0);
  const ior = hasInput('specular_IOR')
    ? helpers.getInputNode(surfaceNode, 'specular_IOR', 1.5)
    : helpers.getInputNode(surfaceNode, 'ior', 1.5);
  const thinFilmThickness = hasInput('thin_film_thickness')
    ? helpers.getInputNode(surfaceNode, 'thin_film_thickness', 0)
    : undefined;
  const thinFilmIOR = clamp(
    helpers.getInputNode(
      surfaceNode,
      'thin_film_ior',
      helpers.getInputNode(surfaceNode, 'thin_film_IOR', 1.5),
    ) as never,
    float(1.0),
    float(2.333),
  );
  const normal = helpers.getInputNode(surfaceNode, 'normal', undefined);

  let colorNode: unknown;
  if (base !== undefined && baseColor !== undefined) {
    colorNode = mul(base as never, baseColor as never);
  } else if (base !== undefined) {
    colorNode = base;
  } else if (baseColor !== undefined) {
    colorNode = baseColor;
  }
  if (coatColor !== undefined) {
    colorNode = colorNode ? mul(colorNode as never, coatColor as never) : colorNode;
  }

  let emissiveNode = emissionAmount;
  if (emissionColor !== undefined) {
    emissiveNode = emissiveNode ? mul(emissiveNode as never, emissionColor as never) : emissionColor;
  }
  return {
    colorNode,
    roughnessNode: roughness,
    metalnessNode: metalness,
    specularIntensityNode: specular,
    specularColorNode: specularColor,
    anisotropyNode: anisotropy,
    anisotropyRotation,
    clearcoatNode: coat,
    clearcoatRoughnessNode: coatRoughness,
    clearcoatNormalNode: coatNormal,
    sheenNode: sheen,
    sheenColorNode: sheenColor,
    sheenRoughnessNode: sheenRoughness,
    emissiveNode,
    opacityNode: opacity,
    transmissionNode: transmission,
    transmissionColorNode: transmissionColor,
    thicknessNode: transmissionDepth,
    iorNode: ior,
    iridescenceNode: thinFilmThickness !== undefined ? float(1) : undefined,
    iridescenceIORNode: thinFilmIOR,
    iridescenceThicknessNode: thinFilmThickness ?? float(0),
    normalNode: normal,
  };
};
