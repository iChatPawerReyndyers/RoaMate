import { Cents } from '@/money/Cents';

export interface PaymentLine {
  source: 'KITTY' | 'MEMBER_ABONO';
  payerUserId?: string;
  amountCents: Cents | null; // null = "fill remaining balance" for this line
}

/**
 * FIN-03: exactly one payment line may be left blank in the UI ("fill
 * remaining balance"); this resolves it to a concrete Cents amount so the
 * total the user typed is honored exactly, without them doing subtraction
 * by hand. The backend's SettlementService intentionally REJECTS unresolved
 * fill lines (see SettlementService.java) - resolution always happens here,
 * client-side, before the request is sent.
 */
export function resolveFillRemainingBalance(
  expenseTotal: Cents,
  lines: PaymentLine[],
): { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountCents: Cents }[] {
  const fillLines = lines.filter(l => l.amountCents === null);
  if (fillLines.length > 1) {
    throw new Error('Only one payment line can use fill-remaining-balance');
  }

  const explicitSum = lines
    .filter(l => l.amountCents !== null)
    .reduce((sum, l) => Cents.add(sum, l.amountCents as Cents), Cents.of(0));

  if (fillLines.length === 0) {
    if (explicitSum !== expenseTotal) {
      throw new Error(
        `Payment lines sum to ${Cents.format(explicitSum)} but expense total is ${Cents.format(expenseTotal)}`,
      );
    }
    return lines as { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountCents: Cents }[];
  }

  const remaining = Cents.subtract(expenseTotal, explicitSum);
  if (remaining < 0) {
    throw new Error('Explicit payment lines already exceed the expense total');
  }

  return lines.map(l =>
    l.amountCents === null
      ? { source: l.source, payerUserId: l.payerUserId, amountCents: remaining }
      : { source: l.source, payerUserId: l.payerUserId, amountCents: l.amountCents as Cents },
  );
}
