import { Database, Q } from '@nozbe/watermelondb';
import type { Item } from '@/features/checklists/ChecklistScreen';

/**
 * CHK-07: mirrors GET /api/v1/checklists/trips/{tripId} into the local
 * `checklist_items` table on every successful fetch, so
 * getCachedLocalChecklistItems below has something to read once the
 * network isn't there. Scoped to (tripId, category) - Packing and Grocery
 * are cached and read back independently, matching how the screen only
 * ever asks the server for one category at a time.
 */
export async function cacheChecklistItemsFromServer(database: Database, tripId: string, category: string, items: Item[]): Promise<void> {
  await database.write(async () => {
    const collection = database.get<any>('checklist_items');
    const existing = await collection.query(Q.where('trip_id', tripId), Q.where('category', category)).fetch();

    await database.batch(
      ...existing.map((row: any) => row.prepareDestroyPermanently()),
      ...items.map(item =>
        collection.prepareCreate((row: any) => {
          row.serverId = item.id;
          row.tripId = tripId;
          row.category = category;
          row.label = item.label;
          row.checked = item.checked;
          row.assignedToUserId = item.assignedToUserId ?? null;
          row.visibility = item.visibility ?? null;
          row.ownerUserId = item.ownerUserId ?? null;
          row.packingItemCategory = item.packingItemCategory ?? null;
          row.storeCategory = item.storeCategory ?? null;
          row.quantity = item.quantity ?? null;
          row.priority = item.priority ?? null;
          row.synced = true;
        }),
      ),
    );
  });
}

/**
 * Reads cached items back in the exact `Item[]` shape ChecklistScreen
 * renders. Only reflects the last successful cache write for this
 * (tripId, category) pair - an item added/checked while offline is queued
 * separately (see ChecklistContainer's use of SyncManager) rather than
 * written here, so it won't appear until it syncs and a later online fetch
 * re-caches this list.
 */
export async function getCachedLocalChecklistItems(database: Database, tripId: string, category: string): Promise<Item[]> {
  const collection = database.get<any>('checklist_items');
  const rows = await collection.query(Q.where('trip_id', tripId), Q.where('category', category)).fetch();

  return rows.map((row: any) => ({
    id: row.serverId ?? row.id,
    label: row.label,
    checked: row.checked,
    assignedToUserId: row.assignedToUserId ?? undefined,
    visibility: row.visibility ?? undefined,
    ownerUserId: row.ownerUserId ?? undefined,
    packingItemCategory: row.packingItemCategory ?? undefined,
    storeCategory: row.storeCategory ?? undefined,
    quantity: row.quantity ?? undefined,
    priority: row.priority ?? undefined,
  }));
}