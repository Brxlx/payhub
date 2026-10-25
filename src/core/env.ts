export abstract class CoreEnv<T> {
  abstract get<K extends keyof T>(key: K): T[K];
}
