import { MoneyError } from './errors/money.error';
import { Money } from './money.vo';

describe('[Money]', () => {
  it('should create a money value from cents', () => {
    const money = Money.fromCents(1500);

    expect(money.amountInCents).toBe(1500);
    expect(money.currencyCode).toBe('BRL');
  });

  it('should create a zero value', () => {
    expect(Money.zero().amountInCents).toBe(0);
  });

  it('should not allow negative amounts', () => {
    expect(() => Money.fromCents(-1)).toThrow(MoneyError);
  });

  it('should not allow non-integer amounts', () => {
    expect(() => Money.fromCents(10.5)).toThrow(MoneyError);
  });

  it('should add two money values of the same currency', () => {
    const total = Money.fromCents(1000).add(Money.fromCents(500));

    expect(total.amountInCents).toBe(1500);
  });

  it('should not allow adding money values of different currencies', () => {
    expect(() => Money.fromCents(1000, 'BRL').add(Money.fromCents(500, 'USD'))).toThrow(MoneyError);
  });

  it('should multiply a money value by a factor', () => {
    const result = Money.fromCents(1000).multiply(3);

    expect(result.amountInCents).toBe(3000);
  });

  it('should not allow multiplying by a negative factor', () => {
    expect(() => Money.fromCents(1000).multiply(-1)).toThrow(MoneyError);
  });

  it('should compare equality by amount and currency', () => {
    expect(Money.fromCents(1000).equals(Money.fromCents(1000))).toBeTruthy();
    expect(Money.fromCents(1000).equals(Money.fromCents(999))).toBeFalsy();
  });
});
