/**
 * FIN-07/08: pure functions that decide what to SURFACE to the user in the
 * Conflict Review Dashboard. This module never silently deletes or merges
 * data - the server's DuplicateDetectionService does the authoritative
 * flagging; this module just formats that signal for the UI and lets the
 * user confirm/dismiss.
 */
export interface DuplicateCandidate {
  localId: string;
  serverId: string;
  description: string;
  totalAmountCents: number;
  expenseDateIso: string;
}

export function describeDuplicate(a: DuplicateCandidate, _b: DuplicateCandidate): string {
  const amount = (a.totalAmountCents / 100).toFixed(2);
  return `Two expenses named "${a.description}" for $${amount} were both logged around ${new Date(
    a.expenseDateIso,
  ).toLocaleString()}. Keep one, or keep both if they're separate charges.`;
}
