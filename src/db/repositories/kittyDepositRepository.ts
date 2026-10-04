import { Database, Q } from '@nozbe/watermelondb';

export interface KittyDepositDto {
  id: string;
  depositorUserId: string;
  amount: number;
  depositedAt?: string;
}

/**
 * FIN-06: mirrors GET /api/v1/finance/trips/{tripId}/kitty-deposits into
 * the local `kitty_deposits` table on every successful fetch, so
 * getCachedLocalKittyDeposits below has something to read once the network
 * isn't there. Wholesale replace, same reasoning as expensesRepository: a
 * trip's deposit list is small, so replacing beats diffing.
 */
export async function cacheKittyDepositsFromServer(database: Database, tripId: string, deposits: KittyDepositDto[]): Promise<void> {
  await database.write(async () => {
    const collection = database.get<any>('kitty_deposits');
    const existing = await collection.query(Q.where('trip_id', tripId)).fetch();

    await database.batch(
      ...existing.map((row: any) => row.prepareDestroyPermanently()),
      ...deposits.map(deposit =>
        collection.prepareCreate((row: any) => {
          row.serverId = deposit.id;
          row.tripId = tripId;
          row.depositorUserId = deposit.depositorUserId;
          row.amountCents = deposit.amount;
          row.depositedAt = deposit.depositedAt ? new Date(deposit.depositedAt).getTime() : Date.now();
          row.synced = true;
        }),
      ),
    );
  });
}

/** Reads cached deposits back in the shape KittyDepositScreen renders. Only reflects the last successful cache write. */
export async function getCachedLocalKittyDeposits(database: Database, tripId: string): Promise<KittyDepositDto[]> {
  const collection = database.get<any>('kitty_deposits');
  const rows = await collection.query(Q.where('trip_id', tripId)).fetch();

  return rows.map((row: any) => ({
    id: row.serverId ?? row.id,
    depositorUserId: row.depositorUserId,
    amount: row.amountCents,
    depositedAt: new Date(row.depositedAt).toISOString(),
  }));
}