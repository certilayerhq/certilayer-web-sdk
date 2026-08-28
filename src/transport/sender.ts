// Layer:  L1 -- Web SDK
// File:   transport/sender.ts
// Role:   Sends event batches to the L2 Ingestion Gateway.
//         Uses fetch with sendBeacon fallback on page unload.
// Author: Youssef Emad

import { EventBatch } from '../types';
import { log, warn } from '../utils/logger';

/** Result of a send attempt. */
export interface SendResult {
  ok: boolean;
  status?: number;
}

/**
 * Send a batch to the L2 Ingestion Gateway via fetch.
 *
 * @param endpoint - Full gateway URL (https://ingest.certilayer.com/v1/ingest)
 * @param apiKey   - Customer API key for Authorization header
 * @param batch    - Event batch to send
 */
export async function sendBatch(
  endpoint: string,
  apiKey: string,
  batch: EventBatch,
): Promise<SendResult> {
  const body = JSON.stringify(batch);

  try {
    const response = await fetch(`${endpoint}/v1/ingest`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        // The L2 Ingestion Gateway authenticates via X-API-Key, NOT
        // Authorization: Bearer (that's used by the L8 API for
        // GET /v1/session/:id, a different service). Confirmed via
        // live testing: Bearer -> 401 "Missing X-API-Key header".
        'X-API-Key':    apiKey,
      },
      body,
      // Don't follow redirects — fail fast
      redirect: 'error',
    });

    log(`Batch sent — status ${response.status}`, { signals: batch.signals.length });
    return { ok: response.ok, status: response.status };
  } catch (err) {
    warn(`Failed to send batch: ${String(err)}`);
    return { ok: false };
  }
}

/**
 * Send a batch using navigator.sendBeacon — used on page unload.
 * sendBeacon is fire-and-forget — no response available.
 *
 * @returns true if the browser accepted the beacon
 */
export function sendBeacon(
  endpoint: string,
  apiKey: string,
  batch: EventBatch,
): boolean {
  if (!navigator.sendBeacon) return false;

  const body = new Blob([JSON.stringify(batch)], { type: 'application/json' });
  const url  = `${endpoint}/v1/ingest?key=${encodeURIComponent(apiKey)}`;

  return navigator.sendBeacon(url, body);
}
