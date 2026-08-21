import { Database, Q } from '@nozbe/watermelondb';
import { LocalExpense } from '@/features/finance/SettlementEngine';

export interface ExpensePaymentDto {
  source: 'KITTY' | 'MEMBER_ABONO';
  payerUserId?: string;
  amountPaidCents: number;
}

export interface ExpenseParticipantDto {
  userId: string;
  fairShareCents: number;
}

export interface ExpenseDto {
  id: string;
  description: string;
  totalAmountCents: number;
  expenseDate: string;
  category?: string;
  createdByUserId: string;
  flaggedDuplicate: boolean;
  payments: ExpensePaymentDto[];
  participants: ExpenseParticipantDto[];
}

/**
 * FIN-05: mirrors GET /api/v1/finance/trips/{tripId}/expenses into local
 * tables so getCachedLocalExpenses below has something to read once the
 * network isn't there. Unlike tripsRepository's per-trip patch-in-place,
 * this replaces the whole set for the trip on every successful fetch - a
 * trip's expense list is small enough that a wholesale replace is simpler
 * and cheaper than diffing, and it naturally picks up server-side changes
 * (edits, duplicate-resolution toggles) without extra logic here.
 */
export async function cacheExpensesFromServer(database: Database, tripId: string, expenses: ExpenseDto[]): Promise<void> {
  await database.write(async () => {
    const expensesCollection = database.get<any>('expenses');
    const paymentsCollection = database.get<any>('expense_payments');
    const participantsCollection = database.get<any>('expense_participants');

    const existingExpenses = await expensesCollection.query(Q.where('trip_id', tripId)).fetch();
    const existingIds = existingExpenses.map((e: any) => e.id);

    const existingPayments = existingIds.length
      ? await paymentsCollection.query(Q.where('expense_id', Q.oneOf(existingIds))).fetch()
      : [];
    const existingParticipants = existingIds.length
      ? await participantsCollection.query(Q.where('expense_id', Q.oneOf(existingIds))).fetch()
      : [];

    await database.batch(
      ...existingPayments.map((p: any) => p.prepareDestroyPermanently()),
      ...existingParticipants.map((p: any) => p.prepareDestroyPermanently()),
      ...existingExpenses.map((e: any) => e.prepareDestroyPermanently()),
    );

    for (const expense of expenses) {
      const record = await expensesCollection.create((r: any) => {
        r.serverId = expense.id;
        r.tripId = tripId;
        r.description = expense.description;
        r.totalAmountCents = expense.totalAmountCents;
        r.expenseDate = new Date(expense.expenseDate).getTime();
        r.category = expense.category ?? null;
        r.createdByUserId = expense.createdByUserId;
        r.flaggedDuplicate = expense.flaggedDuplicate;
        r.synced = true;
        r.deleted = false;
      });

      for (const payment of expense.payments) {
        await paymentsCollection.create((r: any) => {
          r.expenseId = record.id;
          r.source = payment.source;
          r.payerUserId = payment.payerUserId ?? null;
          r.amountPaidCents = payment.amountPaidCents;
        });
      }

      for (const participant of expense.participants) {
        await participantsCollection.create((r: any) => {
          r.expenseId = record.id;
          r.userId = participant.userId;
          r.fairShareCents = participant.fairShareCents;
        });
      }
    }
  });
}

/**
 * Reads cached expenses back in the exact shape
 * SettlementEngine.computeLocalSettlement() expects. Only reflects
 * whatever the last successful cacheExpensesFromServer() call wrote - an
 * expense added while offline (queued via SyncManager, not written here)
 * won't appear until it syncs and a subsequent online fetch re-caches it.
 */
export async function getCachedLocalExpenses(database: Database, tripId: string): Promise<LocalExpense[]> {
  const expensesCollection = database.get<any>('expenses');
  const paymentsCollection = database.get<any>('expense_payments');
  const participantsCollection = database.get<any>('expense_participants');

  const expenses = await expensesCollection.query(Q.where('trip_id', tripId)).fetch();
  const result: LocalExpense[] = [];

  for (const expense of expenses) {
    const payments = await paymentsCollection.query(Q.where('expense_id', expense.id)).fetch();
    const participants = await participantsCollection.query(Q.where('expense_id', expense.id)).fetch();

    result.push({
      totalAmountCents: expense.totalAmountCents,
      flaggedDuplicate: expense.flaggedDuplicate,
      payments: payments.map((p: any) => ({
        source: p.source,
        payerUserId: p.payerUserId ?? undefined,
        amountPaidCents: p.amountPaidCents,
      })),
      participants: participants.map((p: any) => ({
        userId: p.userId,
        fairShareCents: p.fairShareCents,
      })),
    });
  }

  return result;
}