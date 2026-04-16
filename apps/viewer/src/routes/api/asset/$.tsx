import { createFileRoute } from '@tanstack/react-router';
import { createMaterialXZipPayloadByMaterialName } from '../../../lib/materialx-zip.server';

const ZIP_SUFFIX = '.mtlx.zip';

const parseMaterialName = (splat: string | undefined): string | undefined => {
  const raw = splat?.trim();
  if (!raw) {
    return undefined;
  }

  // Only allow a single basename-like token ending in .mtlx.zip.
  if (raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    return undefined;
  }
  if (!raw.endsWith(ZIP_SUFFIX)) {
    return undefined;
  }

  const materialName = raw.slice(0, -ZIP_SUFFIX.length);
  return materialName.length > 0 ? materialName : undefined;
};

export const Route = createFileRoute('/api/asset/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const materialName = parseMaterialName(params._splat);
        if (!materialName) {
          return new Response('Invalid asset path, expected <materialName>.mtlx.zip', { status: 400 });
        }

        const payload = await createMaterialXZipPayloadByMaterialName(materialName);
        if (!payload) {
          return new Response(`Unknown material sample: ${materialName}`, { status: 404 });
        }

        return new Response(payload.zip, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `inline; filename="${payload.sampleDirectory}.mtlx.zip"`,
            'Cache-Control': 'public, max-age=300',
          },
        });
      },
    },
  },
});
