import { Database, Q } from '@nozbe/watermelondb';
import type { Destination } from '@/features/itinerary/ItineraryScreen';

/**
 * Offline-first itinerary: mirrors GET
 * /api/v1/itinerary/trips/{tripId}/destinations into the local `destinations`
 * table on every successful fetch, so getCachedLocalDestinations below has
 * something to read once the network isn't there. Same wholesale-replace
 * approach as expensesRepository.cacheExpensesFromServer, for the same
 * reason: a trip's destination list is small, so replacing the set is
 * simpler and cheaper than diffing, and it naturally picks up server-side
 * changes (edits from another device, priority/day changes, reordering)
 * without extra merge logic here.
 *
 * The cached row's WatermelonDB id is NOT what the itinerary UI uses for
 * `Destination.id` - it always uses the server's id (serverId), since
 * that's what every itinerary/map action (edit, remove, toggle, reorder,
 * "get directions") sends back to the API. A destination pinned while
 * offline has no server id yet and is a different, not-yet-built feature
 * (see the note on cacheDestinationsFromServer below) - it won't show up
 * through this cache.
 */
export async function cacheDestinationsFromServer(database: Database, tripId: string, destinations: Destination[]): Promise<void> {
  await database.write(async () => {
    const collection = database.get<any>('destinations');
    const existing = await collection.query(Q.where('trip_id', tripId)).fetch();

    await database.batch(
      ...existing.map((row: any) => row.prepareDestroyPermanently()),
      ...destinations.map((destination, index) =>
        collection.prepareCreate((row: any) => {
          row.serverId = destination.id;
          row.tripId = tripId;
          row.name = destination.name;
          row.lat = destination.lat ?? null;
          row.lng = destination.lng ?? null;
          row.assignedDay = destination.assignedDay ?? null;
          // The server returns destinations already in itinerary order; this
          // column exists for a future offline-reorder queue (not yet wired
          // up - reorders still need a connection today) rather than being
          // read back by getCachedLocalDestinations, which just preserves
          // array order below.
          row.sortOrder = index;
          row.notes = destination.notes ?? null;
          row.address = destination.address ?? null;
          row.operatingHours = destination.operatingHours ?? null;
          row.targetBudgetCents = destination.targetBudgetCents ?? null;
          row.attachmentUrls = destination.attachmentUrls ?? null;
          row.priority = destination.priority ?? null;
          row.plannedDurationMinutes = destination.plannedDurationMinutes ?? null;
          row.activityCompletedAt = destination.activityCompletedAt ?? null;
          row.synced = true;
        }),
      ),
    );
  });
}

/**
 * Reads cached destinations back as the exact `Destination[]` shape the
 * itinerary/map screens already render, ordered the same way the last
 * successful fetch returned them (see sortOrder above). Only reflects
 * whatever the last successful cacheDestinationsFromServer() call wrote -
 * a destination pinned or edited while offline isn't queued anywhere yet
 * (unlike reordering or checklist toggles), so it won't appear here until
 * that action succeeds and a subsequent online fetch re-caches it.
 */
export async function getCachedLocalDestinations(database: Database, tripId: string): Promise<Destination[]> {
  const collection = database.get<any>('destinations');
  const rows = await collection.query(Q.where('trip_id', tripId), Q.sortBy('sort_order', Q.asc)).fetch();

  return rows.map((row: any) => ({
    id: row.serverId ?? row.id,
    name: row.name,
    notes: row.notes ?? undefined,
    assignedDay: row.assignedDay ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    attachmentUrls: row.attachmentUrls ?? undefined,
    priority: row.priority ?? undefined,
    address: row.address ?? undefined,
    operatingHours: row.operatingHours ?? undefined,
    targetBudgetCents: row.targetBudgetCents ?? undefined,
    plannedDurationMinutes: row.plannedDurationMinutes ?? undefined,
    activityCompletedAt: row.activityCompletedAt ?? undefined,
  }));
}