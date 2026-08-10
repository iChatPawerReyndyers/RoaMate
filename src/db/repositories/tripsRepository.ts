import { Database, Q } from '@nozbe/watermelondb';

export interface TripMemberDto {
  id: string;
  tripId: string;
  userId: string;
  displayName: string;
  role: string;
}

export interface TripDto {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  inviteCode: string;
  defaultCurrency: string;
  members: TripMemberDto[];
}

export interface CachedTrip {
  serverId: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

/**
 * Mirrors a freshly-fetched GET /api/v1/trips response into the local
 * trips/members tables, keyed by server_id, so MyTripsScreen has something
 * to read from the next time the device is offline. Existing rows for a
 * trip are updated in place rather than duplicated; member rows are fully
 * replaced per trip since membership can shrink as well as grow.
 */
export async function cacheTripsFromServer(database: Database, trips: TripDto[]): Promise<void> {
  await database.write(async () => {
    for (const trip of trips) {
      const tripsCollection = database.get<any>('trips');
      const existing = await tripsCollection.query(Q.where('server_id', trip.id)).fetch();

      if (existing.length > 0) {
        await existing[0].update((record: any) => {
          record.name = trip.name;
          record.startDate = trip.startDate ?? null;
          record.endDate = trip.endDate ?? null;
          record.inviteCode = trip.inviteCode;
          record.defaultCurrency = trip.defaultCurrency;
          record.synced = true;
        });
      } else {
        await tripsCollection.create((record: any) => {
          record.serverId = trip.id;
          record.name = trip.name;
          record.startDate = trip.startDate ?? null;
          record.endDate = trip.endDate ?? null;
          record.inviteCode = trip.inviteCode;
          record.defaultCurrency = trip.defaultCurrency;
          record.synced = true;
        });
      }

      const membersCollection = database.get<any>('members');
      const existingMembers = await membersCollection.query(Q.where('trip_id', trip.id)).fetch();
      await database.batch(...existingMembers.map((m: any) => m.prepareDestroyPermanently()));

      for (const member of trip.members) {
        await membersCollection.create((record: any) => {
          record.serverId = member.id;
          record.tripId = trip.id;
          record.userId = member.userId;
          record.displayName = member.displayName;
          record.role = member.role;
        });
      }
    }
  });
}

/** Reads whatever trips were cached from the last successful fetch, for offline display. */
export async function getCachedTrips(database: Database): Promise<CachedTrip[]> {
  const trips = await database.get<any>('trips').query().fetch();

  const result: CachedTrip[] = [];
  for (const trip of trips) {
    const memberCount = await database.get<any>('members').query(Q.where('trip_id', trip.serverId)).fetchCount();
    result.push({
      serverId: trip.serverId,
      name: trip.name,
      inviteCode: trip.inviteCode,
      memberCount,
    });
  }
  return result;
}