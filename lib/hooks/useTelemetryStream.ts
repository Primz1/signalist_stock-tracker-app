'use client';

import { useEffect, useRef, useState } from 'react';
import type { TelemetryEvent } from '@/lib/events/types';
import { mergeEvents } from '@/lib/events/view';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'polling';

const POLL_INTERVAL_MS = 30_000;
const ERRORS_BEFORE_RECONNECTING = 2;
const ERRORS_BEFORE_POLLING = 4;

/** Live events for the signed-in user: SSE first, polling if SSE keeps failing. */
export function useTelemetryStream(initialEvents: TelemetryEvent[]) {
  const [events, setEvents] = useState(initialEvents);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [online, setOnline] = useState(true);
  const cursor = useRef(initialEvents[0]?.id);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const query = cursor.current ? `?after=${cursor.current}` : '';
    const source = new EventSource(`/api/stream/prices${query}`);
    let poller: ReturnType<typeof setInterval> | undefined;
    let errors = 0;

    const receive = (incoming: TelemetryEvent[]) => {
      if (!incoming.length) return;
      setEvents((current) => {
        const merged = mergeEvents(current, incoming);
        cursor.current = merged[0]?.id;
        return merged;
      });
    };

    const poll = async () => {
      try {
        const after = cursor.current ? `&after=${cursor.current}` : '';
        const res = await fetch(`/api/stream/prices?once=1${after}`, { cache: 'no-store' });
        if (res.ok) receive(((await res.json()) as { events: TelemetryEvent[] }).events);
      } catch {
        /* the next poll tries again */
      }
    };

    const startPolling = () => {
      source.close();
      setStatus('polling');
      void poll();
      poller = setInterval(poll, POLL_INTERVAL_MS);
    };

    source.onopen = () => {
      errors = 0;
      setStatus('live');
    };
    source.onmessage = (message) => receive([JSON.parse(message.data) as TelemetryEvent]);
    source.onerror = () => {
      // The server ends each stream on purpose, so one error is a normal reconnect
      errors += 1;
      if (source.readyState === EventSource.CLOSED || errors >= ERRORS_BEFORE_POLLING) startPolling();
      else if (errors >= ERRORS_BEFORE_RECONNECTING) setStatus('reconnecting');
    };

    return () => {
      source.close();
      clearInterval(poller);
    };
  }, []);

  return { events, status, online };
}
