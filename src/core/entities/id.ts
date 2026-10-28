import { createCuid2, isCuid2 } from './cuid2';

export class ID {
  private value: string;

  toString() {
    return this.value;
  }

  toValue() {
    return this.value;
  }

  private generateId(): string {
    return createCuid2();
  }

  constructor(value?: string) {
    this.value = value ?? this.generateId();
  }

  public equals(id: ID): boolean {
    return id.toValue() === this.value;
  }

  public isValid(): boolean {
    return isCuid2(this.value);
  }
}
