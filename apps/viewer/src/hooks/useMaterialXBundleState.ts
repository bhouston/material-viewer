import { useCallback, useState } from 'react';
import { importMaterialXBundle, importMaterialXFromUrl } from '../lib/materialx-import';
import { useObjectUrlStore } from './useObjectUrlStore';

export const useMaterialXBundleState = () => {
  const [xml, setXml] = useState('');
  const [sampleLabel, setSampleLabel] = useState('');
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [loadedAssets, setLoadedAssets] = useState<string[]>([]);
  const { replaceObjectUrls, clearObjectUrls } = useObjectUrlStore();

  const clearBundle = useCallback(() => {
    clearObjectUrls();
    setXml('');
    setSampleLabel('');
    setAssetUrls({});
    setLoadedAssets([]);
  }, [clearObjectUrls]);

  const loadFromUrl = useCallback(
    async (url: string, explicitLabel?: string) => {
      clearObjectUrls();
      const bundle = await importMaterialXFromUrl(url);
      replaceObjectUrls(bundle.objectUrls);
      setSampleLabel(explicitLabel ?? bundle.label);
      setXml(bundle.xml);
      setAssetUrls(bundle.assetUrls);
      setLoadedAssets(Object.keys(bundle.assetUrls));
      return bundle;
    },
    [clearObjectUrls, replaceObjectUrls],
  );

  const importFiles = useCallback(
    async (files: File[]) => {
      const bundle = await importMaterialXBundle(files);
      replaceObjectUrls(bundle.objectUrls);
      setSampleLabel(bundle.label);
      setXml(bundle.xml);
      setAssetUrls(bundle.assetUrls);
      setLoadedAssets(Object.keys(bundle.assetUrls));
      return bundle;
    },
    [replaceObjectUrls],
  );

  return {
    xml,
    setXml,
    sampleLabel,
    setSampleLabel,
    assetUrls,
    setAssetUrls,
    loadedAssets,
    setLoadedAssets,
    clearBundle,
    loadFromUrl,
    importFiles,
  };
};
