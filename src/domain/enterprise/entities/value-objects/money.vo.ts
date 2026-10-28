import { MoneyError } from './errors/money.error';

export type Currency = 'BRL' | 'USD';

/**
 * Representa um valor monetário imutável, armazenado internamente em
 * centavos para evitar os problemas de precisão de ponto flutuante.
 *
 * Nunca deve ser instanciado diretamente — use `Money.fromCents` ou
 * `Money.zero`.
 */
export class Money {
  private constructor(
    private readonly cents: number,
    private readonly currency: Currency,
  ) {}

  static fromCents(cents: number, currency: Currency = 'BRL'): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new MoneyError('Money amount must be a non-negative integer (cents)');
    }

    return new Money(cents, currency);
  }

  static zero(currency: Currency = 'BRL'): Money {
    return new Money(0, currency);
  }

  get amountInCents(): number {
    return this.cents;
  }

  get currencyCode(): Currency {
    return this.currency;
  }

  public add(money: Money): Money {
    this.assertSameCurrency(money);

    return new Money(this.cents + money.cents, this.currency);
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new MoneyError('Cannot multiply a money amount by a negative factor');
    }

    return new Money(Math.round(this.cents * factor), this.currency);
  }

  public equals(money: Money): boolean {
    return this.cents === money.cents && this.currency === money.currency;
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new MoneyError(`Cannot operate on different currencies: ${this.currency} and ${money.currency}`);
    }
  }

  toJSON() {
    return { amountInCents: this.cents, currency: this.currency };
  }
}
