import { XmlTagStrategy } from './xml_tag_strategy.js';
import { JsonToolStrategy } from './json_tool_strategy.js';
import { SentinelStrategy } from './sentinel_strategy.js';
import type { DetectionStrategy } from './base.js';

export type { DetectionStrategy } from './base.js';

const STRATEGY_REGISTRY: Record<string, DetectionStrategy> = {
  sentinel: new SentinelStrategy(),
  xml_tag: new XmlTagStrategy(),
  json_tool: new JsonToolStrategy()
};

export const createDetectionStrategies = (strategyOrder: string[]): DetectionStrategy[] => {
  const strategies: DetectionStrategy[] = [];
  for (const name of strategyOrder) {
    const strategy = STRATEGY_REGISTRY[name];
    if (strategy) {
      strategies.push(strategy);
    }
  }
  return strategies;
};
