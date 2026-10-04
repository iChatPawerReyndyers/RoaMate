import { Database, Q } from '@nozbe/watermelondb';

export interface LocationNoteDto {
  id: string;
  authorUserId: string;
  body: string;
  createdAt?: string;
}

/**
 * ITIN-08: mirrors GET /api/v1/itinerary/destinations/{id}/notes into the
 * local `location_notes` table on every successful fetch, so
 * getCachedLocalNotes below has something to read once the network isn't
 * there. Wholesale replace per destination, same reasoning as the other
 * repositories.
 */
export async function cacheNotesFromServer(database: Database, destinationId: string, notes: LocationNoteDto[]): Promise<void> {
  await database.write(async () => {
    const collection = database.get<any>('location_notes');
    const existing = await collection.query(Q.where('destination_id', destinationId)).fetch();

    await database.batch(
      ...existing.map((row: any) => row.prepareDestroyPermanently()),
      ...notes.map(note =>
        collection.prepareCreate((row: any) => {
          row.destinationId = destinationId;
          row.authorUserId = note.authorUserId;
          row.body = note.body;
          row.synced = true;
        }),
      ),
    );
  });
}

/** Reads cached notes back in the shape DestinationNotesScreen renders. Only reflects the last successful cache write. */
export async function getCachedLocalNotes(database: Database, destinationId: string): Promise<LocationNoteDto[]> {
  const collection = database.get<any>('location_notes');
  const rows = await collection.query(Q.where('destination_id', destinationId)).fetch();

  return rows.map((row: any) => ({
    id: row.id,
    authorUserId: row.authorUserId,
    body: row.body,
  }));
}