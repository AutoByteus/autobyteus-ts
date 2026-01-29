export class ToolState {
  [key: string]: any;

  constructor(initial?: Record<string, any>) {
    if (initial && typeof initial === 'object') {
      Object.assign(this, initial);
    }
  }

  public get(key: string, defaultValue: any = null): any {
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      return (this as any)[key];
    }
    return defaultValue;
  }

  public set(key: string, value: any): void {
    (this as any)[key] = value;
  }

  public has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this, key);
  }

  public delete(key: string): boolean {
    if (this.has(key)) {
      delete (this as any)[key];
      return true;
    }
    return false;
  }

  public keys(): string[] {
    return Object.keys(this);
  }

  public values(): any[] {
    return Object.values(this);
  }

  public entries(): Array<[string, any]> {
    return Object.entries(this) as Array<[string, any]>;
  }

  public clear(): void {
    for (const key of Object.keys(this)) {
      delete (this as any)[key];
    }
  }

  public toObject(): Record<string, any> {
    return { ...this };
  }

  public toJSON(): Record<string, any> {
    return this.toObject();
  }
}
