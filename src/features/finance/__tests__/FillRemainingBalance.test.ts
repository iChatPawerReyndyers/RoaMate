import { Cents } from '@/money/Cents';
import { computeFillRestAmount, resolveEvenSplitRemaining, resolveFillRemainingBalance } from '../FillRemainingBalance';

describe('resolveFillRemainingBalance', () => {
  it('fills the remaining balance on the single blank line', () => {
    const total = Cents.of(10000); // $100.00
    const lines = [
      { source: 'MEMBER_ABONO' as const, payerUserId: 'alice', amountCents: Cents.of(3000) },
      { source: 'MEMBER_ABONO' as const, payerUserId: 'bob', amountCents: null },
    ];

    const resolved = resolveFillRemainingBalance(total, lines);
    const [alice, bob] = resolved;
    expect(bob?.amountCents).toBe(7000);
    expect((alice?.amountCents ?? 0) + (bob?.amountCents ?? 0)).toBe(10000);
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

describe('computeFillRestAmount', () => {
  const total = Cents.of(50000); // 500.00

  it('returns total minus every OTHER line (the PSD mockup: Alice 200 + Bob fill rest = 300)', () => {
    const lines = [
      { key: 'alice', amountCents: Cents.of(20000) },
      { key: 'bob', amountCents: null },
    ];
    expect(computeFillRestAmount(total, lines, 'bob')).toBe(30000);
  });

  it('ignores the target line\'s own current value', () => {
    const lines = [
      { key: 'alice', amountCents: Cents.of(20000) },
      { key: 'bob', amountCents: Cents.of(10000) },
    ];
    expect(computeFillRestAmount(total, lines, 'bob')).toBe(30000);
  });

  it('treats other blank lines as 0 and returns the whole total when nothing else is entered', () => {
    const lines = [
      { key: 'alice', amountCents: null },
      { key: 'bob', amountCents: null },
    ];
    expect(computeFillRestAmount(total, lines, 'bob')).toBe(50000);
  });

  it('never goes negative when other lines already exceed the total', () => {
    const lines = [
      { key: 'alice', amountCents: Cents.of(60000) },
      { key: 'bob', amountCents: null },
    ];
    expect(computeFillRestAmount(total, lines, 'bob')).toBe(0);
  });

  it('produces a balanced section once the filled value is applied', () => {
    const rest = computeFillRestAmount(total, [
      { key: 'alice', amountCents: Cents.of(20000) },
      { key: 'bob', amountCents: null },
      { key: 'charlie', amountCents: null },
    ], 'bob');
    const result = resolveEvenSplitRemaining(total, [
      { key: 'alice', amountCents: Cents.of(20000) },
      { key: 'bob', amountCents: rest },
      { key: 'charlie', amountCents: null },
    ]);
    expect(result.status).toBe('balanced');
    expect(result.resolvedById?.get('charlie')).toBe(0);
  });
});