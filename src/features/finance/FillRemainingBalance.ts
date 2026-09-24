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

/** One line going into resolveEvenSplitRemaining - deliberately just a `key` rather than PaymentLine's source/payerUserId shape, since this is shared by both "Who paid" (keyed by payer) and "Split between" (keyed by participant userId), which have different identifying fields. */
export interface SplitLine {
  key: string;
  amountCents: Cents | null; // null = share of whatever's left, split evenly among every other null line
}

export interface SplitResult {
  status: 'balanced' | 'error';
  message: string;
  /** Present only when status is 'balanced' - every line's resolved (never-null) amount, keyed the same as the input. */
  resolvedById?: Map<string, Cents>;
}

/**
 * FIN-03/04 (custom split): generalizes resolveFillRemainingBalance above
 * to allow ANY number of blank lines, not just one - each blank line gets
 * an equal share of whatever's left after the explicit lines, using
 * Cents.splitEvenlyRemainderToRecipient's assign-the-odd-cent-to-one-line
 * math (since a remainder can't always divide evenly). Used for both the
 * "Who paid" and "Split between" sections in ExpenseEntryScreen - the
 * older one-blank-only resolveFillRemainingBalance is kept as-is (and
 * still covered by its own tests) rather than modified in place, since
 * its stricter contract is still the right one for at least one other
 * call site by that name; this is a new, separate function instead.
 */
export function resolveEvenSplitRemaining(total: Cents, lines: SplitLine[]): SplitResult {
  const explicitLines = lines.filter(l => l.amountCents !== null);
  const blankLines = lines.filter(l => l.amountCents === null);
  const explicitSum = explicitLines.reduce((sum, l) => Cents.add(sum, l.amountCents as Cents), Cents.of(0));

  if (blankLines.length === 0) {
    const diff = (total as number) - (explicitSum as number);
    if (diff !== 0) {
      const diffText = Cents.formatPlain(Cents.of(Math.abs(diff)));
      const message =
        diff > 0
          ? `Amounts total ${Cents.formatPlain(explicitSum)}, ${diffText} short of ${Cents.formatPlain(total)}. Fill in the missing amount.`
          : `Amounts total ${Cents.formatPlain(explicitSum)}, ${diffText} more than ${Cents.formatPlain(total)}. Adjust an amount.`;
      return { status: 'error', message };
    }
    return {
      status: 'balanced',
      message: `Total ${Cents.formatPlain(total)} — balanced`,
      resolvedById: new Map(lines.map(l => [l.key, l.amountCents as Cents])),
    };
  }

  const remaining = (total as number) - (explicitSum as number);
  if (remaining < 0) {
    return {
      status: 'error',
      message: `Entered amounts already total ${Cents.formatPlain(explicitSum)}, more than ${Cents.formatPlain(total)}.`,
    };
  }

  const shares = Cents.splitEvenlyRemainderToRecipient(Cents.of(remaining), blankLines.length, 0);
  const resolvedById = new Map<string, Cents>();
  explicitLines.forEach(l => resolvedById.set(l.key, l.amountCents as Cents));
  blankLines.forEach((l, i) => resolvedById.set(l.key, shares[i] as Cents)); // shares.length === blankLines.length by construction

  return {
    status: 'balanced',
    message: `Total ${Cents.formatPlain(total)} — balanced (${blankLines.length} auto-split)`,
    resolvedById,
  };
}

/**
 * FIN-03 "Fill Rest" shortcut: how much is still unaccounted for once every
 * OTHER line's explicit amount is subtracted from the total. Used to put a
 * concrete number into the tapped line's field, so the person sees the
 * value instead of an empty box that only gets resolved behind the scenes.
 *
 * Other blank lines count as 0 here - once this line has an explicit value
 * they share whatever is left (which is nothing), so the section balances.
 * Never returns a negative amount: if the other lines already exceed the
 * total, the result is 0 and the balance banner keeps showing the overage.
 */
export function computeFillRestAmount(total: Cents, lines: SplitLine[], targetKey: string): Cents {
  const othersSum = lines
    .filter(l => l.key !== targetKey && l.amountCents !== null)
    .reduce((sum, l) => sum + (l.amountCents as number), 0);
  return Cents.of(Math.max(0, (total as number) - othersSum));
}