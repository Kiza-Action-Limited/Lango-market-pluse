import { useCallback, useEffect, useRef, useState } from 'react';

const inMemoryCache = new Map();

export const prefetchData = async (key, fetcher) => {
  if (!key || typeof fetcher !== 'function') return null;

  const cached = inMemoryCache.get(key);
  if (cached?.status === 'resolved') return cached.data;
  if (cached?.status === 'pending') return cached.promise;

  const promise = fetcher()
    .then((data) => {
      inMemoryCache.set(key, { status: 'resolved', data });
      return data;
    })
    .catch((error) => {
      inMemoryCache.set(key, { status: 'rejected', error });
      throw error;
    });

  inMemoryCache.set(key, { status: 'pending', promise });
  return promise;
};

export const useFetchData = (key, fetcher, options = {}) => {
  const { enabled = true, initialData = null, keepPreviousData = true } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    if (!enabled || !key || typeof fetcher !== 'function') return;

    const cached = inMemoryCache.get(key);
    if (cached?.status === 'resolved') {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    if (!keepPreviousData) setData(initialData);
    setLoading(true);
    setError(null);

    try {
      const result = await prefetchData(key, fetcher);
      if (!mountedRef.current) return;
      setData(result);
      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err);
      setLoading(false);
    }
  }, [enabled, fetcher, initialData, keepPreviousData, key]);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => {
      mountedRef.current = false;
    };
  }, [run]);

  return { data, loading, error, refetch: run };
};
