/**
 * Makes properties optional from a class type
 *
 * @example
 * ```typescript
 * class User {
 *   id: string;
 *   name: string;
 *   password: string;
 * }
 *
 * type UserWithoutPassword = OmitFromClass<User, 'password'>;
 * ```
 */
export type OmitFromClass<T, K extends keyof T> = Omit<T, K>;
