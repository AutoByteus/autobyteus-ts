/**
 * LLM Configuration classes.
 */

export interface TokenPricingConfigData {
  input_token_pricing?: number;
  output_token_pricing?: number;
}

export class TokenPricingConfig {
  public input_token_pricing: number;
  public output_token_pricing: number;

  constructor(data: TokenPricingConfigData = {}) {
    this.input_token_pricing = data.input_token_pricing ?? 0.0;
    this.output_token_pricing = data.output_token_pricing ?? 0.0;
  }

  static fromDict(data: Record<string, any>): TokenPricingConfig {
    return new TokenPricingConfig({
      input_token_pricing: data?.input_token_pricing ?? 0.0,
      output_token_pricing: data?.output_token_pricing ?? 0.0
    });
  }

  toDict(): TokenPricingConfigData {
    return {
      input_token_pricing: this.input_token_pricing,
      output_token_pricing: this.output_token_pricing
    };
  }

  mergeWith(override: TokenPricingConfig | null | undefined): void {
    if (!override) return;
    // Match Python behavior: any override value (including 0.0) replaces current.
    this.input_token_pricing = override.input_token_pricing;
    this.output_token_pricing = override.output_token_pricing;
  }
}

export interface LLMConfigData {
  rate_limit?: number | null;
  token_limit?: number | null;
  system_message?: string;
  temperature?: number;
  max_tokens?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  stop_sequences?: string[] | null;
  extra_params?: Record<string, any>;
  pricing_config?: TokenPricingConfig | TokenPricingConfigData;
}

export class LLMConfig {
  public rate_limit: number | null;
  public token_limit: number | null;
  public system_message: string;
  public temperature: number;
  public max_tokens: number | null;
  public top_p: number | null;
  public frequency_penalty: number | null;
  public presence_penalty: number | null;
  public stop_sequences: string[] | null;
  public extra_params: Record<string, any>;
  public pricing_config: TokenPricingConfig;

  constructor(data: LLMConfigData = {}) {
    this.rate_limit = data.rate_limit ?? null;
    this.token_limit = data.token_limit ?? null;
    this.system_message = data.system_message ?? "You are a helpful assistant.";
    this.temperature = data.temperature ?? 0.7;
    this.max_tokens = data.max_tokens ?? null;
    this.top_p = data.top_p ?? null;
    this.frequency_penalty = data.frequency_penalty ?? null;
    this.presence_penalty = data.presence_penalty ?? null;
    this.stop_sequences = data.stop_sequences ?? null;
    this.extra_params = data.extra_params ?? {};

    if (data.pricing_config instanceof TokenPricingConfig) {
      this.pricing_config = data.pricing_config;
    } else if (data.pricing_config && typeof data.pricing_config === 'object') {
      this.pricing_config = TokenPricingConfig.fromDict(data.pricing_config as Record<string, any>);
    } else if (data.pricing_config === undefined || data.pricing_config === null) {
      this.pricing_config = new TokenPricingConfig();
    } else {
      this.pricing_config = new TokenPricingConfig();
    }
  }

  static defaultConfig(): LLMConfig {
    return new LLMConfig();
  }

  static fromDict(data: Record<string, any>): LLMConfig {
    const dataCopy = { ...data };
    const pricingData = dataCopy.pricing_config ?? {};
    delete dataCopy.pricing_config;

    const configData: LLMConfigData = {
      ...dataCopy,
      pricing_config: pricingData
    };
    return new LLMConfig(configData);
  }

  toDict(): Record<string, any> {
    const data: Record<string, any> = {
      rate_limit: this.rate_limit,
      token_limit: this.token_limit,
      system_message: this.system_message,
      temperature: this.temperature,
      max_tokens: this.max_tokens,
      top_p: this.top_p,
      frequency_penalty: this.frequency_penalty,
      presence_penalty: this.presence_penalty,
      stop_sequences: this.stop_sequences,
      extra_params: this.extra_params,
      pricing_config: this.pricing_config instanceof TokenPricingConfig
        ? this.pricing_config.toDict()
        : this.pricing_config ?? {}
    };
    
    // Filter None/null values? Python implementation does:
    // return {k: v for k, v in data.items() if v is not None}
    
    const filtered: Record<string, any> = {};
    for (const key in data) {
      if (data[key] !== null && data[key] !== undefined) {
        filtered[key] = data[key];
      }
    }
    return filtered;
  }

  toJson(): string {
    return JSON.stringify(this.toDict());
  }

  static fromJson(jsonStr: string): LLMConfig {
    const data = JSON.parse(jsonStr);
    return LLMConfig.fromDict(data);
  }

  update(updates: Record<string, any>): void {
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'pricing_config' && value && typeof value === 'object') {
        if (this.pricing_config instanceof TokenPricingConfig) {
          this.pricing_config.mergeWith(TokenPricingConfig.fromDict(value));
        } else {
          this.pricing_config = TokenPricingConfig.fromDict(value);
        }
        continue;
      }

      if (key in this) {
        (this as any)[key] = value;
      } else {
        this.extra_params[key] = value;
      }
    }

    if (this.pricing_config && !(this.pricing_config instanceof TokenPricingConfig)) {
      if (typeof this.pricing_config === 'object') {
        this.pricing_config = TokenPricingConfig.fromDict(this.pricing_config as Record<string, any>);
      } else {
        this.pricing_config = new TokenPricingConfig();
      }
    }
  }

  mergeWith(override: LLMConfig | null | undefined): void {
    if (!override) return;
    
    if (override.rate_limit !== null && override.rate_limit !== undefined) this.rate_limit = override.rate_limit;
    if (override.token_limit !== null && override.token_limit !== undefined) this.token_limit = override.token_limit;
    if (override.system_message !== null && override.system_message !== undefined) this.system_message = override.system_message;
    if (override.temperature !== null && override.temperature !== undefined) this.temperature = override.temperature;
    if (override.max_tokens !== null && override.max_tokens !== undefined) this.max_tokens = override.max_tokens;
    if (override.top_p !== null && override.top_p !== undefined) this.top_p = override.top_p;
    if (override.frequency_penalty !== null && override.frequency_penalty !== undefined) this.frequency_penalty = override.frequency_penalty;
    if (override.presence_penalty !== null && override.presence_penalty !== undefined) this.presence_penalty = override.presence_penalty;
    if (override.stop_sequences !== null && override.stop_sequences !== undefined) this.stop_sequences = override.stop_sequences;

    if (override.extra_params && typeof override.extra_params === 'object') {
      this.extra_params = { ...this.extra_params, ...override.extra_params };
    }

    if (!(this.pricing_config instanceof TokenPricingConfig)) {
      this.pricing_config = new TokenPricingConfig();
    }
    if (override.pricing_config instanceof TokenPricingConfig) {
      this.pricing_config.mergeWith(override.pricing_config);
    } else if (override.pricing_config && typeof override.pricing_config === 'object') {
      this.pricing_config.mergeWith(TokenPricingConfig.fromDict(override.pricing_config as Record<string, any>));
    }
  }

  clone(): LLMConfig {
    return LLMConfig.fromDict(this.toDict());
  }
}
