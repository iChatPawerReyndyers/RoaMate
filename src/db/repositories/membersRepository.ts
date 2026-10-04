import { Database, Q } from '@nozbe/watermelondb';
import type { TripMember } from '@/app/TripContext';

/**
 * TRIP-02: mirrors GET /api/v1/trips/{tripId}/members into the local
 * `members` table on every successful fetch, so getCachedLocalMembers below
 * has something to read once the network isn't there. Used by both
 * TripHomeScreen (the member list itself) and ChecklistContainer (who can
 * be put "in charge" of a shared item) - one cache, two consumers, since
 * they're the exact same data. Wholesale replace per trip, same reasoning
 * as the other repositories: a trip's member list is small.
 */
export async function cacheMembersFromServer(database: Database, tripId: string, members: TripMember[]): Promise<void> {
  await database.write(async () => {
    const collection = database.get<any>('members');
    const existing = await collection.query(Q.where('trip_id', tripId)).fetch();

    await database.batch(
      ...existing.map((row: any) => row.prepareDestroyPermanently()),
      ...members.map(member =>
        collection.prepareCreate((row: any) => {
          row.serverId = member.id;
          row.tripId = tripId;
          row.userId = member.userId;
          row.displayName = member.displayName;
          row.role = member.role;
        }),
      ),
    );
  });
}

/** Reads cached members back in the exact TripMember[] shape both consumers already render. Only reflects the last successful cache write - a member who joined while everyone was offline won't appear until a later online fetch. */
export async function getCachedLocalMembers(database: Database, tripId: string): Promise<TripMember[]> {
  const collection = database.get<any>('members');
  const rows = await collection.query(Q.where('trip_id', tripId)).fetch();

  return rows.map((row: any) => ({
    id: row.serverId ?? row.id,
    tripId,
    userId: row.userId,
    displayName: row.displayName,
    role: row.role,
  }));
}