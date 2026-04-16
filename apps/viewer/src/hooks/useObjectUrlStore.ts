import { useCallback, useEffect, useRef } from 'react';

export const useObjectUrlStore = () => {
  const objectUrlsRef = useRef<string[]>([]);

  const replaceObjectUrls = useCallback((nextObjectUrls: string[]) => {
    for (const objectUrl of objectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrlsRef.current = nextObjectUrls;
  }, []);

  const clearObjectUrls = useCallback(() => {
    replaceObjectUrls([]);
  }, [replaceObjectUrls]);

  useEffect(() => {
    return () => {
      for (const objectUrl of objectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlsRef.current = [];
    };
  }, []);

  return { replaceObjectUrls, clearObjectUrls };
};
