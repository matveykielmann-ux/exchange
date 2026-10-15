import { createApiServices } from './api';
import type { Services } from './types';

/**
 * Connects to the exchange API. The server decides the mode (sandbox or
 * production) and every outcome; there is no browser-only fallback that
 * could be mistaken for a live service.
 */
export function createServices(base = ''): Promise<Services> {
  return createApiServices(base);
}
