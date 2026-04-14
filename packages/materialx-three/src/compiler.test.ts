import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMaterialX } from '@materialx-js/materialx';
import { compileMaterialXToTSL, createThreeMaterialFromDocument } from './compiler.js';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const standardSurfaceFixture = path.resolve(
  sourceDir,
  '../../../../MaterialX/resources/Materials/Examples/StandardSurface/standard_surface_brick_procedural.mtlx'
);
const greysphereCalibrationFixture = path.resolve(
  sourceDir,
  '../../../../MaterialX/resources/Materials/Examples/StandardSurface/standard_surface_greysphere_calibration.mtlx'
);
const marbleFixture = path.resolve(
  sourceDir,
  '../../../../MaterialX/resources/Materials/Examples/StandardSurface/standard_surface_marble_solid.mtlx'
);
const onyxFixture = path.resolve(
  sourceDir,
  '../../../../MaterialX/resources/Materials/Examples/StandardSurface/standard_surface_onyx_hextiled.mtlx'
);
const openPbrFixture = path.resolve(sourceDir, '../../../../MaterialX/resources/Materials/Examples/OpenPbr/open_pbr_default.mtlx');

const compileFixture = (fixturePath: string) => {
  const xml = readFileSync(fixturePath, 'utf8');
  const document = parseMaterialX(xml);
  return compileMaterialXToTSL(document);
};

const expectCategoriesSupported = (
  result: ReturnType<typeof compileMaterialXToTSL>,
  categories: string[]
) => {
  for (const category of categories) {
    expect(result.unsupportedCategories).not.toContain(category);
    expect(
      result.warnings.some((entry) => entry.code === 'unsupported-node' && entry.category === category)
    ).toBe(false);
  }
};

describe('materialx-three compiler', () => {
  it('compiles a standard_surface material into node assignments', () => {
    const result = compileFixture(standardSurfaceFixture);

    expect(result.materialName).toBe('M_BrickPattern');
    expect(result.surfaceShaderName).toBe('N_StandardSurface');
    expect(result.assignments.colorNode).toBeDefined();
    expect(result.assignments.roughnessNode).toBeDefined();
    expect(result.unsupportedCategories).not.toContain('standard_surface');
  });

  it('creates a MeshPhysicalNodeMaterial wrapper', () => {
    const xml = readFileSync(standardSurfaceFixture, 'utf8');
    const document = parseMaterialX(xml);
    const compiled = createThreeMaterialFromDocument(document);
    expect(compiled.material).toBeDefined();
    expect(compiled.result.assignments.colorNode).toBeDefined();
  });

  it('reports unsupported surface shader graphs', () => {
    const result = compileFixture(openPbrFixture);
    expect(result.warnings.some((entry) => entry.code === 'unsupported-node')).toBe(true);
  });

  it('supports place2d texture transforms in greysphere calibration fixture', () => {
    const result = compileFixture(greysphereCalibrationFixture);
    expectCategoriesSupported(result, ['place2d']);
    expect(result.assignments.colorNode).toBeDefined();
  });

  it('supports procedural math stack used by marble fixture', () => {
    const result = compileFixture(marbleFixture);
    expectCategoriesSupported(result, ['fractal3d', 'sin', 'power']);
    expect(result.assignments.colorNode).toBeDefined();
  });

  it('supports hextiled image sampling used by onyx fixture', () => {
    const result = compileFixture(onyxFixture);
    expectCategoriesSupported(result, ['hextiledimage']);
    expect(result.assignments.colorNode).toBeDefined();
    expect(result.assignments.roughnessNode).toBeDefined();
  });

  it('supports hextilednormalmap category for normal input wiring', () => {
    const xml = `<?xml version="1.0"?>
<materialx version="1.39">
  <nodegraph name="NG_HexNormal">
    <hextilednormalmap name="hex_normal" type="vector3">
      <input name="file" type="filename" value="dummy_normal.png" />
    </hextilednormalmap>
    <output name="normal_out" type="vector3" nodename="hex_normal" />
  </nodegraph>
  <standard_surface name="SR_HexNormal" type="surfaceshader">
    <input name="normal" type="vector3" nodegraph="NG_HexNormal" output="normal_out" />
  </standard_surface>
  <surfacematerial name="M_HexNormal" type="material">
    <input name="surfaceshader" type="surfaceshader" nodename="SR_HexNormal" />
  </surfacematerial>
</materialx>`;
    const result = compileMaterialXToTSL(parseMaterialX(xml));
    expectCategoriesSupported(result, ['hextilednormalmap']);
    expect(result.assignments.normalNode).toBeDefined();
  });
});
