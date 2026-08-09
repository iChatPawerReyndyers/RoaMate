import { Cents } from '@/money/Cents';

export interface LocalExpense {
  totalAmountCents: number;
  payments: { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountPaidCents: number }[];
  participants: { userId: string; fairShareCents: number }[];
  flaggedDuplicate: boolean;
}

export interface NetBalance {
  userId: string;
  totalPaidCents: number;
  totalFairShareCents: number;
  netDeltaCents: number;
}

/**
 * Client-side mirror of backend SettlementService#computeSettlement, used
 * to render an instant, fully-offline-capable balance view (FIN-05) without
 * waiting on a network round trip. The server remains the source of truth
 * once synced; this is purely for optimistic local UI.
 */
export function computeLocalSettlement(expenses: LocalExpense[]): NetBalance[] {
  const paid = new Map<string, number>();
  const fairShare = new Map<string, number>();

  for (const expense of expenses) {
    if (expense.flaggedDuplicate) continue;

    for (const payment of expense.payments) {
      if (payment.source === 'MEMBER_ABONO' && payment.payerUserId) {
        paid.set(payment.payerUserId, (paid.get(payment.payerUserId) ?? 0) + payment.amountPaidCents);
      }
    }
    for (const participant of expense.participants) {
      fairShare.set(participant.userId, (fairShare.get(participant.userId) ?? 0) + participant.fairShareCents);
      if (!paid.has(participant.userId)) paid.set(participant.userId, 0);
    }
  }

  return Array.from(fairShare.keys()).map(userId => {
    const paidCents = paid.get(userId) ?? 0;
    const fairCents = fairShare.get(userId) ?? 0;
    return {
      userId,
      totalPaidCents: paidCents,
      totalFairShareCents: fairCents,
      netDeltaCents: Cents.subtract(Cents.of(paidCents), Cents.of(fairCents)),
    };
  });
}
