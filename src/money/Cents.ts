/**
 * Mirrors backend/.../common/Money.java: currency is ALWAYS represented as
 * integer cents on the client too (FIN-02/05). Never use JS floats for
 * money math - `0.1 + 0.2 !== 0.3` is exactly the class of bug this type
 * exists to prevent.
 */
export type Cents = number & { readonly __brand: 'Cents' };

export const Cents = {
  of(cents: number): Cents {
    if (!Number.isInteger(cents)) {
      throw new Error(`Cents must be an integer, got ${cents}`);
    }
    return cents as Cents;
  },

  fromDollars(dollars: number): Cents {
    return Cents.of(Math.round(dollars * 100));
  },

  toDollars(cents: Cents): number {
    return cents / 100;
  },

  format(cents: Cents, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  },

  /**
   * FIN-05: plain numeric amount, no currency symbol or code. The Expenses
   * tab intentionally doesn't display currency for now (single-currency
   * trips only, per trip creation) - multi-currency display is a later
   * decision, not yet implemented. Cents are still stored and computed
   * exactly as before; this only affects what's rendered.
   */
  formatPlain(cents: Cents): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  },

  add(a: Cents, b: Cents): Cents {
    return Cents.of(a + b);
  },

  subtract(a: Cents, b: Cents): Cents {
    return Cents.of(a - b);
  },

  /**
   * FIN-05 / edge case #3 (Currency Rounding Deltas): splits into `parts`
   * equal base shares, then assigns the ENTIRE leftover remainder to a
   * single designated recipient index - per spec, the expense logger
   * (created_by_user_id), never spread across multiple participants.
   * Identical algorithm to Money#splitEvenlyRemainderToRecipient on the
   * backend, so client-side previews always match what the server persists.
   */
  splitEvenlyRemainderToRecipient(total: Cents, parts: number, remainderRecipientIndex: number): Cents[] {
    if (parts <= 0) throw new Error('parts must be > 0');
    if (remainderRecipientIndex < 0 || remainderRecipientIndex >= parts) {
      throw new Error('remainderRecipientIndex out of range');
    }
    const base = Math.floor(total / parts);
    const remainder = total % parts;
    const shares = Array.from({ length: parts }, () => Cents.of(base));
    shares[remainderRecipientIndex] = Cents.of(base + remainder);
    return shares;
  },
};
