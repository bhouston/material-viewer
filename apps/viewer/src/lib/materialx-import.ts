import JSZip from 'jszip';

const isMaterialXFile = (name: string): boolean => name.toLowerCase().endsWith('.mtlx');
const isZipFile = (name: string): boolean => name.toLowerCase().endsWith('.zip');

const extensionToMimeType: Record<string, string> = {
  avif: 'image/avif',
  exr: 'image/x-exr',
  gif: 'image/gif',
  hdr: 'image/vnd.radiance',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const guessMimeType = (path: string): string | undefined => {
  const basename = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
  const extension = basename.includes('.') ? basename.substring(basename.lastIndexOf('.') + 1).toLowerCase() : '';
  return extensionToMimeType[extension];
};

const makeAssetKeys = (file: File): string[] => {
  const keys = new Set<string>();
  keys.add(file.name);
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (relative) {
    keys.add(relative);
  }
  return [...keys];
};

export interface ImportedMaterialXBundle {
  label: string;
  xml: string;
  assetUrls: Record<string, string>;
  objectUrls: string[];
}

const importFromZipBuffer = async (buffer: ArrayBuffer, label: string): Promise<ImportedMaterialXBundle> => {
  const zip = await JSZip.loadAsync(buffer);

  let mtlxPath: string | undefined;
  let mtlxContent: string | undefined;

  const entries: Array<{ path: string; file: JSZip.JSZipObject }> = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) {
      entries.push({ path: relativePath, file });
    }
  });

  for (const { path, file } of entries) {
    if (isMaterialXFile(path)) {
      mtlxPath = path;
      mtlxContent = await file.async('string');
      break;
    }
  }

  if (!mtlxPath || !mtlxContent) {
    throw new Error('No .mtlx file found inside the zip archive');
  }

  const assetUrls: Record<string, string> = {};
  const objectUrls: string[] = [];

  const mtlxDir = mtlxPath.includes('/') ? mtlxPath.substring(0, mtlxPath.lastIndexOf('/') + 1) : '';

  for (const { path, file } of entries) {
    if (path === mtlxPath) continue;

    const data = await file.async('arraybuffer');
    const blob = new Blob([data], {
      type: guessMimeType(path),
    });
    const objectUrl = URL.createObjectURL(blob);
    objectUrls.push(objectUrl);

    const relativePath = mtlxDir && path.startsWith(mtlxDir) ? path.slice(mtlxDir.length) : path;
    const basename = relativePath.includes('/')
      ? relativePath.substring(relativePath.lastIndexOf('/') + 1)
      : relativePath;

    assetUrls[relativePath] = objectUrl;
    if (basename !== relativePath) {
      assetUrls[basename] = objectUrl;
    }
  }

  return { label, xml: mtlxContent, assetUrls, objectUrls };
};

const importFromZip = async (zipFile: File): Promise<ImportedMaterialXBundle> => {
  const buffer = await zipFile.arrayBuffer();
  const label = zipFile.name.replace(/\.zip$/i, '');
  return importFromZipBuffer(buffer, label);
};

export const importMaterialXBundle = async (files: File[]): Promise<ImportedMaterialXBundle> => {
  const zipFile = files.find((file) => isZipFile(file.name));
  if (zipFile) {
    return importFromZip(zipFile);
  }

  const materialFile = files.find((file) => isMaterialXFile(file.name));
  if (!materialFile) {
    throw new Error('No .mtlx or .zip file found in dropped files');
  }

  const xml = await materialFile.text();
  const assetUrls: Record<string, string> = {};
  const objectUrls: string[] = [];

  for (const file of files) {
    if (file === materialFile) {
      continue;
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrls.push(objectUrl);
    for (const key of makeAssetKeys(file)) {
      assetUrls[key] = objectUrl;
    }
  }

  return {
    label: materialFile.name,
    xml,
    assetUrls,
    objectUrls,
  };
};

const filenameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? 'material.mtlx';
  } catch {
    return 'material.mtlx';
  }
};

export const importMaterialXFromUrl = async (url: string): Promise<ImportedMaterialXBundle> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const filename = filenameFromUrl(url);
  const contentType = response.headers.get('content-type') ?? '';
  const isZip =
    isZipFile(filename) ||
    contentType.includes('zip') ||
    (contentType === 'application/octet-stream' && isZipFile(filename));

  if (isZip) {
    const buffer = await response.arrayBuffer();
    const label = filename.replace(/\.zip$/i, '');
    return importFromZipBuffer(buffer, label);
  }

  const xml = await response.text();
  if (!xml.trim()) {
    throw new Error('Fetched file is empty');
  }

  const label = filename.replace(/\.mtlx$/i, '') || 'material';
  return { label, xml, assetUrls: {}, objectUrls: [] };
};
