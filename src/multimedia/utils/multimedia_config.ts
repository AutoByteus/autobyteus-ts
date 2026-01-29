export class MultimediaConfig {
  params: Record<string, any>;

  constructor(params: Record<string, any> = {}) {
    this.params = params ?? {};
  }

  mergeWith(overrideConfig: MultimediaConfig | null | undefined): void {
    if (overrideConfig && overrideConfig.params && Object.keys(overrideConfig.params).length > 0) {
      this.params = { ...this.params, ...overrideConfig.params };
    }
  }

  static fromDict(data: Record<string, any> | null | undefined): MultimediaConfig {
    return new MultimediaConfig(data ?? {});
  }

  toDict(): Record<string, any> {
    return this.params;
  }
}
