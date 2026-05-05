import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkMaterialXPackage,
  createMaterialZArchive,
  inspectMaterialZArchive,
  packMaterialX,
  unpackMaterialZ,
} from './mtlz.js';

const materialXml = `<?xml version="1.0"?>
<materialx version="1.39">
  <nodegraph name="NG_test">
    <image name="albedo" type="color3">
      <input name="file" type="filename" value="albedo.png" />
    </image>
  </nodegraph>
  <include href="defs/custom.mtlx" />
</materialx>`;

const makeFixture = async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mtlz-core-'));
  await mkdir(path.join(tempDir, 'defs'), { recursive: true });
  await writeFile(path.join(tempDir, 'material.mtlx'), materialXml, 'utf8');
  await writeFile(path.join(tempDir, 'albedo.png'), new Uint8Array([137, 80, 78, 71]));
  await writeFile(path.join(tempDir, 'defs/custom.mtlx'), '<materialx version="1.39"></materialx>', 'utf8');
  return {
    tempDir,
    materialPath: path.join(tempDir, 'material.mtlx'),
    archivePath: path.join(tempDir, 'material.mtlz'),
  };
};

describe('.mtlz archives', () => {
  it('packs a root .mtlx first and aligns uncompressed resources', async () => {
    const fixture = await makeFixture();
    try {
      const result = await packMaterialX(fixture.materialPath);
      expect(result.outputPath).toBe(fixture.archivePath);

      const archive = inspectMaterialZArchive(await readFileSync(result.outputPath));
      expect(archive.issues).toEqual([]);
      expect(archive.rootEntry?.path).toBe('material.mtlx');
      expect(archive.entries.map((entry) => entry.path)).toEqual([
        'material.mtlx',
        'libraries/custom.mtlx',
        'textures/albedo.png',
      ]);

      for (const entry of archive.entries.filter((archiveEntry) => archiveEntry.path !== 'material.mtlx')) {
        expect(entry.compressionMethod).toBe(0);
        expect(entry.dataOffset % 64).toBe(0);
      }

      const rootXml = Buffer.from(archive.rootEntry!.data).toString('utf8');
      expect(rootXml).toContain('value="textures/albedo.png"');
      expect(rootXml).toContain('href="libraries/custom.mtlx"');
    } finally {
      await rm(fixture.tempDir, { recursive: true, force: true });
    }
  });

  it('unpacks an archive and restores the root document plus resources', async () => {
    const fixture = await makeFixture();
    const outputDir = path.join(fixture.tempDir, 'out');
    try {
      await packMaterialX(fixture.materialPath);
      const result = await unpackMaterialZ(fixture.archivePath, { outputDir });
      expect(result.rootPath).toBe(path.join(outputDir, 'material.mtlx'));
      expect(existsSync(path.join(outputDir, 'material.mtlx'))).toBe(true);
      expect(existsSync(path.join(outputDir, 'textures/albedo.png'))).toBe(true);
      expect(existsSync(path.join(outputDir, 'libraries/custom.mtlx'))).toBe(true);
    } finally {
      await rm(fixture.tempDir, { recursive: true, force: true });
    }
  });

  it('checks plain .mtlx files and .mtlz archive layout', async () => {
    const fixture = await makeFixture();
    try {
      const mtlxResult = await checkMaterialXPackage(fixture.materialPath);
      expect(mtlxResult.format).toBe('mtlx');
      expect(mtlxResult.issues.every((issue) => issue.level !== 'error')).toBe(true);

      await packMaterialX(fixture.materialPath);
      const mtlzResult = await checkMaterialXPackage(fixture.archivePath);
      expect(mtlzResult.format).toBe('mtlz');
      expect(mtlzResult.issues.every((issue) => issue.level !== 'error')).toBe(true);
    } finally {
      await rm(fixture.tempDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid package structure', () => {
    expect(() =>
      createMaterialZArchive([
        { path: 'first.mtlx', data: '<materialx />' },
        { path: 'second.mtlx', data: '<materialx />' },
      ]),
    ).toThrow(/exactly one root-level/);
    expect(() =>
      createMaterialZArchive([
        { path: 'material.mtlx', data: '<materialx />' },
        { path: 'albedo.png', data: new Uint8Array([1]) },
      ]),
    ).toThrow(/subdirectories/);
  });

  it('reports compressed resource entries as invalid', async () => {
    const fixture = await makeFixture();
    try {
      await packMaterialX(fixture.materialPath);
      const data = Buffer.from(readFileSync(fixture.archivePath));
      const archive = inspectMaterialZArchive(data);
      const textureEntry = archive.entries.find((entry) => entry.path === 'textures/albedo.png');
      expect(textureEntry).toBeDefined();
      data.writeUInt16LE(8, textureEntry!.localHeaderOffset + 8);

      const centralDirectoryOffset = data.readUInt32LE(data.byteLength - 6);
      let cursor = centralDirectoryOffset;
      while (cursor < data.byteLength && data.readUInt32LE(cursor) === 0x02014b50) {
        const nameLength = data.readUInt16LE(cursor + 28);
        const extraLength = data.readUInt16LE(cursor + 30);
        const commentLength = data.readUInt16LE(cursor + 32);
        const name = data.slice(cursor + 46, cursor + 46 + nameLength).toString('utf8');
        if (name === 'textures/albedo.png') {
          data.writeUInt16LE(8, cursor + 10);
          break;
        }
        cursor += 46 + nameLength + extraLength + commentLength;
      }

      const invalidArchive = inspectMaterialZArchive(data);
      expect(invalidArchive.issues.map((issue) => issue.message)).toContain(
        'Resource files must be stored without compression',
      );
    } finally {
      await rm(fixture.tempDir, { recursive: true, force: true });
    }
  });
});
