import { ValueObject } from '@/core/entities/value-object';

import { MoneyError } from './errors/money.error';

export type Currency = 'BRL' | 'USD';

interface MoneyProps {
  cents: number;
  currency: Currency;
}

/**
 * Representa um valor monetário imutável, armazenado internamente em
 * centavos para evitar os problemas de precisão de ponto flutuante.
 *
 * Nunca deve ser instanciado diretamente — use `Money.fromCents` ou
 * `Money.zero`.
 */
export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static fromCents(cents: number, currency: Currency = 'BRL'): Money {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new MoneyError('Money amount must be a non-negative integer (cents)');
    }

    return new Money({ cents, currency });
  }

  static zero(currency: Currency = 'BRL'): Money {
    return new Money({ cents: 0, currency });
  }

  get amountInCents(): number {
    return this.props.cents;
  }

  get currencyCode(): Currency {
    return this.props.currency;
  }

  public add(money: Money): Money {
    this.assertSameCurrency(money);

    return new Money({ cents: this.props.cents + money.props.cents, currency: this.props.currency });
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new MoneyError('Cannot multiply a money amount by a negative factor');
    }

    return new Money({ cents: Math.round(this.props.cents * factor), currency: this.props.currency });
  }

  public equals(other: Money): boolean {
    return this.props.cents === other.props.cents && this.props.currency === other.props.currency;
  }

  private assertSameCurrency(money: Money): void {
    if (this.props.currency !== money.props.currency) {
      throw new MoneyError(
        `Cannot operate on different currencies: ${this.props.currency} and ${money.props.currency}`,
      );
    }
  }

  toJSON() {
    return { amountInCents: this.props.cents, currency: this.props.currency };
  }
}
