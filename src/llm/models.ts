import { LLMProvider } from './providers.js';
import { LLMRuntime } from './runtimes.js';
import { LLMConfig } from './utils/llm_config.js';
import { ParameterSchema } from '../utils/parameter_schema.js';
import { BaseLLM } from './base.js';

export interface LLMModelOptions {
  name: string;
  value: string;
  provider: LLMProvider;
  llm_class?: any; // To be resolved to avoid circular dep, or use factory pattern
  canonical_name: string;
  default_config?: LLMConfig;
  runtime?: LLMRuntime;
  host_url?: string;
  config_schema?: ParameterSchema; // Or generic dict if schema not ported
}

export interface ModelInfo {
  model_identifier: string;
  display_name: string;
  value: string;
  canonical_name: string;
  provider: string;
  runtime: string;
  host_url?: string;
  config_schema?: Record<string, any>;
}

export class LLMModel {
  private _name: string;
  private _value: string;
  private _canonical_name: string;
  public provider: LLMProvider;
  public llm_class: any; 
  public default_config: LLMConfig;
  public runtime: LLMRuntime;
  public host_url?: string;
  public config_schema?: ParameterSchema;
  private _model_identifier: string;

  constructor(options: LLMModelOptions) {
    this._name = options.name;
    this._value = options.value;
    this._canonical_name = options.canonical_name;
    this.provider = options.provider;
    this.llm_class = options.llm_class;
    this.default_config = options.default_config || new LLMConfig();
    this.runtime = options.runtime || LLMRuntime.API;
    this.host_url = options.host_url;
    this.config_schema = options.config_schema;
    this._model_identifier = this.generateIdentifier();
  }

  private generateIdentifier(): string {
    if (this.runtime === LLMRuntime.API) {
      return this.name;
    }
    
    if (!this.host_url) {
      throw new Error(`host_url is required for runtime '${this.runtime}' on model '${this.name}'`);
    }

    try {
      const url = new URL(this.host_url);
      const hostAndPort = url.host;
      return `${this.name}:${this.runtime.toLowerCase()}@${hostAndPort}`;
    } catch (e) {
      console.error(`Failed to parse host_url '${this.host_url}' for identifier generation: ${e}`);
      return `${this.name}:${this.runtime.toLowerCase()}@${this.host_url}`;
    }
  }

  get name(): string { return this._name; }
  get value(): string { return this._value; }
  get canonical_name(): string { return this._canonical_name; }
  get model_identifier(): string { return this._model_identifier; }

  // createLLM method might be tricky with circular deps if we return BaseLLM instance.
  // For now, let's skip factory method here and use a separate Factory.

  toModelInfo(): ModelInfo {
    return {
      model_identifier: this.model_identifier,
      display_name: this.name,
      value: this.value,
      canonical_name: this.canonical_name,
      provider: this.provider,
      runtime: this.runtime,
      host_url: this.host_url,
      config_schema: this.config_schema?.toJsonSchemaDict() || undefined
    };
  }
}
