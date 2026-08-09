import { Database } from '@nozbe/watermelondb';
import { EventQueue, QueuedEvent } from './EventQueue';
import { apiClient } from '@/services/api/client';

/**
 * FIN-07 / offline-first core: drains the local event queue in
 * client-timestamp order and POSTs to /api/v1/sync/events. Runs on
 * (a) network reconnect, (b) app foreground, (c) a periodic background
 * timer while the app is open. It does NOT run as a background OS task -
 * consistent with the spec's no-background-tracking stance, sync only
 * happens while the app is actually active.
 */
export class SyncManager {
  private queue: EventQueue;
  private syncing = false;

  constructor(private db: Database) {
    this.queue = new EventQueue(db);
  }

  async enqueueEvent(event: QueuedEvent): Promise<void> {
    await this.queue.enqueue(event);
  }

  async syncNow(): Promise<{ uploaded: number; failed: boolean }> {
    if (this.syncing) return { uploaded: 0, failed: false };
    this.syncing = true;
    try {
      const batch = await this.queue.pendingBatch(200);
      if (batch.length === 0) return { uploaded: 0, failed: false };

      const originDeviceId = await getDeviceId();
      const events = batch.map((e: any) => ({
        tripId: e.tripId,
        eventType: e.eventType,
        clientTimestamp: new Date(e.clientTimestamp).toISOString(),
        payloadJson: e.payloadJson,
        originDeviceId,
      }));

      await apiClient.post('/api/v1/sync/events', events);
      await this.queue.markUploaded(batch.map((e: any) => e.id));

      return { uploaded: batch.length, failed: false };
    } catch (err) {
      console.warn('Sync failed, will retry on next trigger', err);
      return { uploaded: 0, failed: true };
    } finally {
      this.syncing = false;
    }
  }
}

async function getDeviceId(): Promise<string> {
  // Backed by a stable per-install identifier persisted in MMKV.
  const { getDeviceId: read } = await import('@/services/security/KeyManager');
  return read();
}
