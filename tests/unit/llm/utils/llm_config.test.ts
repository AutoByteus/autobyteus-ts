import { describe, it, expect } from 'vitest';
import { LLMConfig, TokenPricingConfig } from '../../../../src/llm/utils/llm_config.js';

describe('TokenPricingConfig', () => {
  it('initializes with defaults', () => {
    const config = new TokenPricingConfig();
    expect(config.input_token_pricing).toBe(0.0);
    expect(config.output_token_pricing).toBe(0.0);
  });

  it('initializes with custom values', () => {
    const config = new TokenPricingConfig({ input_token_pricing: 0.001, output_token_pricing: 0.002 });
    expect(config.input_token_pricing).toBe(0.001);
    expect(config.output_token_pricing).toBe(0.002);
  });

  it('toDict', () => {
    const config = new TokenPricingConfig({ input_token_pricing: 0.0015, output_token_pricing: 0.0025 });
    expect(config.toDict()).toEqual({
      input_token_pricing: 0.0015,
      output_token_pricing: 0.0025
    });
  });

  it('fromDict full', () => {
    const config = TokenPricingConfig.fromDict({ input_token_pricing: 0.003, output_token_pricing: 0.004 });
    expect(config.input_token_pricing).toBe(0.003);
    expect(config.output_token_pricing).toBe(0.004);
  });

  it('fromDict partial', () => {
    const inputOnly = TokenPricingConfig.fromDict({ input_token_pricing: 0.005 });
    expect(inputOnly.input_token_pricing).toBe(0.005);
    expect(inputOnly.output_token_pricing).toBe(0.0);

    const outputOnly = TokenPricingConfig.fromDict({ output_token_pricing: 0.006 });
    expect(outputOnly.input_token_pricing).toBe(0.0);
    expect(outputOnly.output_token_pricing).toBe(0.006);
  });

  it('mergeWith none does not change', () => {
    const config = new TokenPricingConfig({ input_token_pricing: 0.1, output_token_pricing: 0.2 });
    const before = config.toDict();
    config.mergeWith(null);
    expect(config.toDict()).toEqual(before);
  });

  it('mergeWith another config overrides with defaults', () => {
    const base = new TokenPricingConfig({ input_token_pricing: 0.1, output_token_pricing: 0.2 });
    const override = new TokenPricingConfig({ input_token_pricing: 0.15 });
    base.mergeWith(override);
    expect(base.input_token_pricing).toBe(0.15);
    expect(base.output_token_pricing).toBe(0.0);

    const base2 = new TokenPricingConfig({ input_token_pricing: 0.3, output_token_pricing: 0.4 });
    const override2 = new TokenPricingConfig({ output_token_pricing: 0.45 });
    base2.mergeWith(override2);
    expect(base2.input_token_pricing).toBe(0.0);
    expect(base2.output_token_pricing).toBe(0.45);
  });
});

describe('LLMConfig', () => {
  it('initializes with defaults', () => {
    const config = new LLMConfig();
    expect(config.rate_limit).toBeNull();
    expect(config.token_limit).toBeNull();
    expect(config.system_message).toBe('You are a helpful assistant.');
    expect(config.temperature).toBe(0.7);
    expect(config.max_tokens).toBeNull();
    expect(config.top_p).toBeNull();
    expect(config.frequency_penalty).toBeNull();
    expect(config.presence_penalty).toBeNull();
    expect(config.stop_sequences).toBeNull();
    expect(config.extra_params).toEqual({});
    expect(config.pricing_config.input_token_pricing).toBe(0.0);
    expect(config.pricing_config.output_token_pricing).toBe(0.0);
  });

  it('initializes with custom values', () => {
    const pricing = new TokenPricingConfig({ input_token_pricing: 0.01, output_token_pricing: 0.02 });
    const config = new LLMConfig({
      rate_limit: 100,
      system_message: 'Be concise.',
      temperature: 0.5,
      max_tokens: 1024,
      stop_sequences: ['\nUser:'],
      extra_params: { custom_key: 'custom_value' },
      pricing_config: pricing
    });
    expect(config.rate_limit).toBe(100);
    expect(config.system_message).toBe('Be concise.');
    expect(config.temperature).toBe(0.5);
    expect(config.max_tokens).toBe(1024);
    expect(config.stop_sequences).toEqual(['\nUser:']);
    expect(config.extra_params).toEqual({ custom_key: 'custom_value' });
    expect(config.pricing_config).toBe(pricing);
  });

  it('initializes pricing_config from dict', () => {
    const config = new LLMConfig({ pricing_config: { input_token_pricing: 0.03, output_token_pricing: 0.04 } });
    expect(config.pricing_config.input_token_pricing).toBe(0.03);
    expect(config.pricing_config.output_token_pricing).toBe(0.04);
  });

  it('initializes pricing_config with invalid type', () => {
    const config = new LLMConfig({ pricing_config: 'invalid_type' as any });
    expect(config.pricing_config.input_token_pricing).toBe(0.0);
    expect(config.pricing_config.output_token_pricing).toBe(0.0);
  });

  it('defaultConfig returns defaults', () => {
    expect(LLMConfig.defaultConfig()).toEqual(new LLMConfig());
  });

  it('toDict excludes nulls', () => {
    const config = new LLMConfig({
      system_message: 'Test prompt',
      temperature: 0.9,
      max_tokens: 500,
      extra_params: { test: 1 },
      pricing_config: TokenPricingConfig.fromDict({ input_token_pricing: 0.01, output_token_pricing: 0.02 })
    });
    const dict = config.toDict();
    expect(dict).toEqual({
      system_message: 'Test prompt',
      temperature: 0.9,
      max_tokens: 500,
      extra_params: { test: 1 },
      pricing_config: { input_token_pricing: 0.01, output_token_pricing: 0.02 }
    });
    expect(dict).not.toHaveProperty('rate_limit');
  });

  it('toJson', () => {
    const config = new LLMConfig({ system_message: 'JSON Test', temperature: 0.6 });
    const jsonStr = config.toJson();
    expect(JSON.parse(jsonStr)).toEqual(config.toDict());
  });

  it('fromDict full', () => {
    const data = {
      rate_limit: 50,
      token_limit: 4000,
      system_message: 'Full dict test',
      temperature: 0.2,
      max_tokens: 200,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      stop_sequences: ['stop'],
      extra_params: { extra: 'param' },
      pricing_config: { input_token_pricing: 0.07, output_token_pricing: 0.08 }
    };
    const config = LLMConfig.fromDict(data);
    expect(config.rate_limit).toBe(50);
    expect(config.system_message).toBe('Full dict test');
    expect(config.temperature).toBe(0.2);
    expect(config.max_tokens).toBe(200);
    expect(config.extra_params).toEqual({ extra: 'param' });
    expect(config.pricing_config.input_token_pricing).toBe(0.07);
  });

  it('fromDict partial', () => {
    const config = LLMConfig.fromDict({ system_message: 'Partial dict test', max_tokens: 150 });
    expect(config.system_message).toBe('Partial dict test');
    expect(config.max_tokens).toBe(150);
    expect(config.temperature).toBe(0.7);
    expect(config.pricing_config).toBeInstanceOf(TokenPricingConfig);
  });

  it('fromJson', () => {
    const jsonStr = JSON.stringify({
      system_message: 'From JSON',
      temperature: 0.3,
      pricing_config: { input_token_pricing: 0.0001, output_token_pricing: 0.0002 }
    });
    const config = LLMConfig.fromJson(jsonStr);
    expect(config.system_message).toBe('From JSON');
    expect(config.temperature).toBe(0.3);
    expect(config.pricing_config.input_token_pricing).toBe(0.0001);
  });

  it('update existing attributes', () => {
    const config = new LLMConfig();
    config.update({ temperature: 0.3, system_message: 'Updated prompt' });
    expect(config.temperature).toBe(0.3);
    expect(config.system_message).toBe('Updated prompt');
  });

  it('update extra_params', () => {
    const config = new LLMConfig({ extra_params: { initial: 'value' } });
    config.update({ new_extra: 'new_value', another_extra: 123 });
    expect(config.extra_params).toEqual({ initial: 'value', new_extra: 'new_value', another_extra: 123 });
  });

  it('update pricing_config with dict', () => {
    const config = new LLMConfig();
    config.update({ pricing_config: { input_token_pricing: 0.11, output_token_pricing: 0.22 } });
    expect(config.pricing_config.input_token_pricing).toBe(0.11);
    expect(config.pricing_config.output_token_pricing).toBe(0.22);
  });

  it('mergeWith none does not change', () => {
    const original = new LLMConfig({ temperature: 0.8 });
    const copy = LLMConfig.fromDict(original.toDict());
    copy.mergeWith(null);
    expect(copy.toDict()).toEqual(original.toDict());
  });

  it('mergeWith another config partial', () => {
    const base = new LLMConfig({ system_message: 'Base prompt', temperature: 0.7, max_tokens: 100 });
    const override = new LLMConfig({ temperature: 0.5, stop_sequences: ['\n'] });
    base.mergeWith(override);
    expect(base.system_message).toBe('You are a helpful assistant.');
    expect(base.temperature).toBe(0.5);
    expect(base.max_tokens).toBe(100);
    expect(base.stop_sequences).toEqual(['\n']);
  });

  it('mergeWith extra_params merging', () => {
    const base = new LLMConfig({ extra_params: { base_param: 1, common_param: 'base_val' } });
    const override = new LLMConfig({ extra_params: { override_param: 2, common_param: 'override_val' } });
    base.mergeWith(override);
    expect(base.extra_params).toEqual({
      base_param: 1,
      common_param: 'override_val',
      override_param: 2
    });
  });

  it('mergeWith pricing_config merging', () => {
    const base = new LLMConfig({ pricing_config: { input_token_pricing: 0.1, output_token_pricing: 0.2 } });
    const override = new LLMConfig({ pricing_config: { output_token_pricing: 0.25 } });
    base.mergeWith(override);
    expect(base.pricing_config.input_token_pricing).toBe(0.0);
    expect(base.pricing_config.output_token_pricing).toBe(0.25);
  });

  it('mergeWith does not clear base when override fields are null', () => {
    const base = new LLMConfig({ max_tokens: 1024, temperature: 0.7, system_message: 'Explicit Base System Message' });
    const override = new LLMConfig({ temperature: 0.5 });
    base.mergeWith(override);
    expect(base.max_tokens).toBe(1024);
    expect(base.temperature).toBe(0.5);
    expect(base.system_message).toBe('You are a helpful assistant.');
  });
});
