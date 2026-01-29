export class ToolConfig {
  public params: Record<string, any>;

  constructor(params: Record<string, any> = {}) {
    if (!ToolConfig.isPlainObject(params)) {
      throw new TypeError('params must be a dictionary');
    }
    this.params = params;
  }

  private static isPlainObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  public toDict(): Record<string, any> {
    return { ...this.params };
  }

  public static fromDict(configData: Record<string, any>): ToolConfig {
    if (!ToolConfig.isPlainObject(configData)) {
      throw new TypeError('config_data must be a dictionary');
    }
    return new ToolConfig({ ...configData });
  }

  public merge(other: ToolConfig): ToolConfig {
    if (!(other instanceof ToolConfig)) {
      throw new TypeError('Can only merge with another ToolConfig instance');
    }
    return new ToolConfig({ ...this.params, ...other.params });
  }

  public getConstructorKwargs(): Record<string, any> {
    return { ...this.params };
  }

  public get(key: string, defaultValue: any = null): any {
    if (Object.prototype.hasOwnProperty.call(this.params, key)) {
      return this.params[key];
    }
    return defaultValue;
  }

  public set(key: string, value: any): void {
    this.params[key] = value;
  }

  public update(params: Record<string, any>): void {
    if (!ToolConfig.isPlainObject(params)) {
      throw new TypeError('params must be a dictionary');
    }
    Object.assign(this.params, params);
  }

  public get size(): number {
    return Object.keys(this.params).length;
  }

  public get length(): number {
    return this.size;
  }

  public get isEmpty(): boolean {
    return this.size === 0;
  }

  public get hasParams(): boolean {
    return this.size > 0;
  }

  public toString(): string {
    return `ToolConfig(params=${ToolConfig.formatValue(this.params)})`;
  }

  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'None';
    }
    if (typeof value === 'string') {
      return `'${ToolConfig.escapeString(value)}'`;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => ToolConfig.formatValue(item)).join(', ')}]`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const inner = entries
        .map(([key, val]) => `${ToolConfig.formatKey(key)}: ${ToolConfig.formatValue(val)}`)
        .join(', ');
      return `{${inner}}`;
    }
    return `'${ToolConfig.escapeString(String(value))}'`;
  }

  private static formatKey(key: string): string {
    return `'${ToolConfig.escapeString(key)}'`;
  }

  private static escapeString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
