import type { MaterialXNode } from '@materialx-js/materialx';
import { mul, step } from 'three/tsl';
import type { MaterialSlotAssignments } from '../types.js';

export interface GltfPbrSurfaceInputs {
  getInputNode(node: MaterialXNode, name: string, fallback: unknown): unknown;
}

const multiplyNodeValues = (left: unknown, right: unknown): unknown =>
  (left as { mul?: (other: unknown) => unknown }).mul?.(right) ?? mul(left as never, right as never);

const toAttenuationDistance = (distance: unknown, hasAttenuationColorInput: boolean): unknown => {
  if (distance === undefined) {
    // When attenuation tint is authored without a distance, default to a
    // finite value so absorption tinting is visible.
    return hasAttenuationColorInput ? 1 : undefined;
  }
  if (typeof distance === 'number') {
    return distance > 0 ? distance : undefined;
  }
  return distance;
};

const buildOpacityNode = (alpha: unknown, alphaMode: unknown, alphaCutoff: unknown): unknown => {
  if (typeof alphaMode === 'number' && Math.round(alphaMode) === 1) {
    // Approximate glTF MASK mode by converting alpha into a 0/1 coverage signal.
    return step(alphaCutoff as never, alpha as never);
  }
  return alpha;
};

const toIridescenceThicknessNode = (value: unknown): unknown => {
  if (typeof value === 'number') {
    return value;
  }
  // MaterialX glTF thickness is authored in nanometers already.
  return value;
};

export const buildGltfPbrSurfaceAssignments = (
  surfaceNode: MaterialXNode,
  helpers: GltfPbrSurfaceInputs,
): MaterialSlotAssignments => {
  const hasInput = (name: string) => surfaceNode.inputs.some((input) => input.name === name);
  const baseColor = helpers.getInputNode(surfaceNode, 'base_color', [1, 1, 1]);
  const occlusion = hasInput('occlusion') ? helpers.getInputNode(surfaceNode, 'occlusion', 1) : undefined;
  const roughness = helpers.getInputNode(surfaceNode, 'roughness', 1);
  const metallic = helpers.getInputNode(surfaceNode, 'metallic', 1);
  const normal = helpers.getInputNode(surfaceNode, 'normal', undefined);
  const transmission = hasInput('transmission') ? helpers.getInputNode(surfaceNode, 'transmission', 0) : undefined;
  const specular = hasInput('specular') ? helpers.getInputNode(surfaceNode, 'specular', 1) : undefined;
  const specularColor = hasInput('specular_color')
    ? helpers.getInputNode(surfaceNode, 'specular_color', [1, 1, 1])
    : undefined;
  const ior = hasInput('ior') ? helpers.getInputNode(surfaceNode, 'ior', 1.5) : undefined;
  const alpha = helpers.getInputNode(surfaceNode, 'alpha', 1);
  const alphaMode = helpers.getInputNode(surfaceNode, 'alpha_mode', 0);
  const alphaCutoff = helpers.getInputNode(surfaceNode, 'alpha_cutoff', 0.5);
  const iridescence = hasInput('iridescence') ? helpers.getInputNode(surfaceNode, 'iridescence', 0) : undefined;
  const iridescenceIor = hasInput('iridescence_ior')
    ? helpers.getInputNode(surfaceNode, 'iridescence_ior', 1.3)
    : undefined;
  const iridescenceThickness = hasInput('iridescence_thickness')
    ? helpers.getInputNode(surfaceNode, 'iridescence_thickness', 300)
    : undefined;
  const sheenColor = hasInput('sheen_color') ? helpers.getInputNode(surfaceNode, 'sheen_color', [0, 0, 0]) : undefined;
  const sheenRoughness = hasInput('sheen_roughness')
    ? helpers.getInputNode(surfaceNode, 'sheen_roughness', 0)
    : undefined;
  const clearcoat = hasInput('clearcoat') ? helpers.getInputNode(surfaceNode, 'clearcoat', 0) : undefined;
  const clearcoatRoughness = hasInput('clearcoat_roughness')
    ? helpers.getInputNode(surfaceNode, 'clearcoat_roughness', 0)
    : undefined;
  const clearcoatNormal = hasInput('clearcoat_normal')
    ? helpers.getInputNode(surfaceNode, 'clearcoat_normal', undefined)
    : undefined;
  const emissiveColor = helpers.getInputNode(surfaceNode, 'emissive', [0, 0, 0]);
  const emissiveStrength = helpers.getInputNode(surfaceNode, 'emissive_strength', 1);
  const attenuationDistance = hasInput('attenuation_distance')
    ? helpers.getInputNode(surfaceNode, 'attenuation_distance', undefined)
    : undefined;
  const attenuationColor = hasInput('attenuation_color')
    ? helpers.getInputNode(surfaceNode, 'attenuation_color', [1, 1, 1])
    : undefined;
  const thickness = hasInput('thickness') ? helpers.getInputNode(surfaceNode, 'thickness', 0) : undefined;
  const dispersion = hasInput('dispersion') ? helpers.getInputNode(surfaceNode, 'dispersion', 0) : undefined;
  const anisotropyStrength = hasInput('anisotropy_strength')
    ? helpers.getInputNode(surfaceNode, 'anisotropy_strength', 0)
    : undefined;
  const anisotropyRotation = hasInput('anisotropy_rotation')
    ? helpers.getInputNode(surfaceNode, 'anisotropy_rotation', 0)
    : undefined;

  const emissiveNode = multiplyNodeValues(emissiveColor, emissiveStrength);
  const opacityNode = buildOpacityNode(alpha, alphaMode, alphaCutoff);
  const attenuationDistanceNode = toAttenuationDistance(attenuationDistance, hasInput('attenuation_color'));
  const iridescenceThicknessNode = toIridescenceThicknessNode(iridescenceThickness);

  return {
    colorNode: baseColor,
    aoNode: occlusion,
    roughnessNode: roughness,
    metalnessNode: metallic,
    specularIntensityNode: specular,
    specularColorNode: specularColor,
    anisotropyNode: anisotropyStrength,
    anisotropyRotation,
    clearcoatNode: clearcoat,
    clearcoatRoughnessNode: clearcoatRoughness,
    clearcoatNormalNode: clearcoatNormal,
    sheenNode: sheenColor,
    sheenRoughnessNode: sheenRoughness,
    normalNode: normal,
    emissiveNode,
    opacityNode,
    transmissionNode: transmission,
    thicknessNode: thickness,
    dispersionNode: dispersion,
    attenuationColorNode: attenuationColor,
    attenuationDistanceNode,
    iorNode: ior,
    iridescenceNode: iridescence,
    iridescenceIORNode: iridescenceIor,
    iridescenceThicknessNode,
  };
};
