export interface ExpenseLike {
  id: string;
  description: string;
  totalAmountCents: number;
  expenseDateIso: string;
}

const WINDOW_MS = 10 * 60 * 1000; // FIN-07: 10-minute collision window

/**
 * Client-side pre-check run right after a local sync merge, so the
 * Conflict Review Dashboard can show flags immediately rather than waiting
 * for the next server round trip. The server's DuplicateDetectionService
 * is authoritative; this is a fast local approximation using the same rule.
 */
export function findLikelyDuplicates(expenses: ExpenseLike[]): [ExpenseLike, ExpenseLike][] {
  const pairs: [ExpenseLike, ExpenseLike][] = [];
  for (let i = 0; i < expenses.length; i++) {
    for (let j = i + 1; j < expenses.length; j++) {
      const a = expenses[i];
      const b = expenses[j];
      const sameAmount = a.totalAmountCents === b.totalAmountCents;
      const sameDescription = a.description.trim().toLowerCase() === b.description.trim().toLowerCase();
      const closeInTime = Math.abs(new Date(a.expenseDateIso).getTime() - new Date(b.expenseDateIso).getTime()) <= WINDOW_MS;
      if (sameAmount && sameDescription && closeInTime) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}
