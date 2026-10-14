import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { LiveEvent, LiveState } from '@/services/types';
import { useServices } from './services';

/** Subscribes to live server events while mounted. The handler can change between renders without reconnecting. */
export function useLiveEvents(handler: (e: LiveEvent) => void, enabled = true) {
  const { live } = useServices();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    return live.subscribe((e) => ref.current(e));
  }, [live, enabled]);
}

/** Connection state of the live stream, for a visible indicator. */
export function useLiveState(): LiveState {
  const { live } = useServices();
  return useSyncExternalStore(live.onState, live.state, () => 'offline' as LiveState);
}
