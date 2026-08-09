import { Cents } from '@/money/Cents';
import { resolveFillRemainingBalance } from '../FillRemainingBalance';

describe('resolveFillRemainingBalance', () => {
  it('fills the remaining balance on the single blank line', () => {
    const total = Cents.of(10000); // $100.00
    const lines = [
      { source: 'MEMBER_ABONO' as const, payerUserId: 'alice', amountCents: Cents.of(3000) },
      { source: 'MEMBER_ABONO' as const, payerUserId: 'bob', amountCents: null },
    ];

    const resolved = resolveFillRemainingBalance(total, lines);
    expect(resolved[1].amountCents).toBe(7000);
    expect(resolved[0].amountCents + resolved[1].amountCents).toBe(10000);
  });

  it('rejects more than one fill-remaining-balance line', () => {
    const total = Cents.of(10000);
    const lines = [
      { source: 'MEMBER_ABONO' as const, payerUserId: 'alice', amountCents: null },
      { source: 'MEMBER_ABONO' as const, payerUserId: 'bob', amountCents: null },
    ];
    expect(() => resolveFillRemainingBalance(total, lines)).toThrow();
  });
});
