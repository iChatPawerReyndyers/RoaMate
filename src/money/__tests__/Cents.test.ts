import { Cents } from '../Cents';

describe('Cents', () => {
  it('assigns the entire rounding remainder to one designated recipient (FIN-05)', () => {
    const total = Cents.of(10001); // $100.01
    const shares = Cents.splitEvenlyRemainderToRecipient(total, 3, 0); // recipient = the expense logger

    const sum = shares.reduce((a, b) => a + b, 0);
    expect(sum).toBe(10001);
    expect(shares).toEqual([3335, 3333, 3333]); // logger absorbs both remainder cents, never spread out
  });

  it('throws on non-integer cents (never allow float currency)', () => {
    expect(() => Cents.of(19.99)).toThrow();
  });

  it('fromDollars/toDollars round-trip correctly', () => {
    const cents = Cents.fromDollars(42.5);
    expect(cents).toBe(4250);
    expect(Cents.toDollars(cents)).toBe(42.5);
  });
});
