'use client';

/**
 * useAnalyticsEvents
 *
 * Connects to the backend's Server-Sent Events endpoint at
 * /api/analytics/events and calls `onInvalidate(scope)` whenever the backend
 * signals that operational data has changed (order, inventory, etc.).
 *
 * Design rules
 * ───────────────────────────────────────────────────────────
 * • Realtime is a SIGNAL only – the actual data re-fetch is done by
 *   BiDataContext via its authoritative GET /api/analytics/bi call.
 * • Events are coalesced with a 1.5 s leading-edge debounce so a burst of
 *   rapid mutations (e.g. bulk order) triggers exactly one re-fetch.
 * • Exponential back-off reconnect (2 s → 4 s → 8 s … cap 60 s) handles
 *   Render cold-starts and transient network blips.
 * • Cleans up the EventSource and all timers on unmount.
 * • Cross-tab: each Management tab maintains its own SSE connection so every
 *   open window gets the signal independently.
 */

import { useEffect, useRef, useCallback } from 'react';

const SSE_ENDPOINT = '/api/analytics/events';
const DEBOUNCE_MS = 1500;       // coalesce rapid mutations into one refresh
const MAX_RECONNECT_DELAY = 60_000;
const INITIAL_RECONNECT_DELAY = 2_000;

export type AnalyticsScope = 'orders' | 'inventory' | 'returns' | 'inwards' | 'all';

interface UseAnalyticsEventsOptions {
  /** Called (debounced) whenever a data-changed event arrives. */
  onInvalidate: (scope: AnalyticsScope) => void;
  /** Set to false to suspend the connection (e.g. tab hidden for >5 min). */
  enabled?: boolean;
}

export function useAnalyticsEvents({
  onInvalidate,
  enabled = true,
}: UseAnalyticsEventsOptions): void {
  const esRef = useRef<EventSource | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_DELAY);
  const mountedRef = useRef<boolean>(true);
  const onInvalidateRef = useRef(onInvalidate);

  // Keep the callback ref up to date without forcing a reconnect
  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleInvalidation = useCallback((scope: AnalyticsScope) => {
    // Leading-edge: fire immediately on first event, then suppress until quiet
    if (debounceTimerRef.current === null) {
      // First event in this burst – fire now
      onInvalidateRef.current(scope);
    }
    // Reset the quiet-period timer on every event
    clearDebounce();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      // Trailing-edge: fire once more after the burst settles to catch any
      // final mutation that arrived during the debounce window.
      onInvalidateRef.current(scope);
    }, DEBOUNCE_MS);
  }, [clearDebounce]);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(SSE_ENDPOINT);
    esRef.current = es;

    es.addEventListener('data-changed', (evt: MessageEvent) => {
      if (!mountedRef.current) return;
      // Reset reconnect back-off on any successful event
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      try {
        const payload = JSON.parse(evt.data) as { scope?: string };
        const scope = (payload.scope as AnalyticsScope) || 'all';
        scheduleInvalidation(scope);
      } catch {
        scheduleInvalidation('all');
      }
    });

    es.onopen = () => {
      if (!mountedRef.current) return;
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      esRef.current = null;
      clearReconnect();
      const delay = Math.min(reconnectDelayRef.current, MAX_RECONNECT_DELAY);
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [enabled, scheduleInvalidation, clearReconnect]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      clearDebounce();
      clearReconnect();
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
