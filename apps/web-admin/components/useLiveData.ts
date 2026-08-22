'use client';

import { useCallback, useEffect, useState } from 'react';
import { connectRealtime } from '@/lib/api';

/**
 * Dane odświeżane zdarzeniem z WebSocketa, z pollingiem jako siatką
 * bezpieczeństwa. Realtime nie jest jedynym źródłem prawdy — wi-fi w lokalach
 * gubi połączenia, a kuchnia nie może zostać z nieaktualną tablicą.
 */
export function useLiveData<T>(load: () => Promise<T>, fallbackMs = 15_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się pobrać danych.');
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    const socket = connectRealtime(() => void refresh());
    const timer = setInterval(() => void refresh(), fallbackMs);

    return () => {
      socket?.close();
      clearInterval(timer);
    };
  }, [refresh, fallbackMs]);

  return { data, error, refresh };
}
