import { Database, Q } from '@nozbe/watermelondb';

export interface QueuedEvent {
  tripId: string;
  eventType: string;
  clientTimestamp: number;
  payloadJson: string;
}

/**
 * Append-only local queue. Every offline mutation (new expense, note,
 * checklist toggle, activity batch, beacon) gets pushed here immediately,
 * independent of whether the device currently has connectivity. SyncManager
 * drains this queue whenever the network comes back.
 */
export class EventQueue {
  constructor(private db: Database) {}

  async enqueue(event: QueuedEvent): Promise<void> {
    await this.db.write(async () => {
      await this.db.get('event_queue').create((record: any) => {
        record.tripId = event.tripId;
        record.eventType = event.eventType;
        record.clientTimestamp = event.clientTimestamp;
        record.payloadJson = event.payloadJson;
        record.uploaded = false;
      });
    });
  }

  async pendingBatch(limit = 100): Promise<any[]> {
    return this.db
      .get('event_queue')
      .query(Q.where('uploaded', false), Q.sortBy('client_timestamp', Q.asc), Q.take(limit))
      .fetch();
  }

  async markUploaded(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.write(async () => {
      const records = await this.db.get('event_queue').query(Q.where('id', Q.oneOf(ids))).fetch();
      await this.db.batch(...records.map((r: any) => r.prepareUpdate((rec: any) => { rec.uploaded = true; })));
    });
  }
}
