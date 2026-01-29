/**
 * Singleton Pattern implementation for TypeScript classes.
 * Can be used as a base class or mixin logic, but TS doesn't support metaclasses like Python.
 * We'll use a standard getInstance approach or a decorator if experimental decorators allowed.
 * Since we want explicit control, a base class handling the instance is simpler.
 */
export class Singleton {
  private static instance: any;

  constructor() {}

  public static getInstance<T extends typeof Singleton>(this: T): InstanceType<T> {
    if (!(this as any).instance) {
      (this as any).instance = new (this as any)();
    }
    return (this as any).instance;
  }
}
