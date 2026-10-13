import { resolveServiceMode } from '@/config/runtime';
import { createMockServices } from './mock';
import type { Services } from './types';

/** Selects adapters by mode. Only mock adapters exist; other modes fail closed. */
export function createServices(rawMode: string | undefined = import.meta.env.VITE_SERVICE_MODE): Services {
  const mode = resolveServiceMode(rawMode);
  switch (mode) {
    case 'mock':
      return createMockServices();
  }
}
