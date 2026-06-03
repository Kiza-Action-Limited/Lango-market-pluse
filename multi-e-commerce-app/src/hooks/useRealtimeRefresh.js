import { useEffect, useRef, useState } from 'react';

export const useRealtimeRefresh = (refreshFn, options = {}) => {
  const { enabled = true, intervalMs = 15000, deps = [] } = options;
  const refreshRef = useRef(refreshFn);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshRef.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      setIsRefreshing(true);
      try {
        await refreshRef.current?.();
        if (!cancelled) setLastUpdated(new Date());
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    const timer = window.setInterval(refresh, intervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, intervalMs, ...deps]);

  return { lastUpdated, isRefreshing };
};

export const formatRealtimeStamp = (date) => {
  if (!date) return 'Waiting for live sync';
  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
