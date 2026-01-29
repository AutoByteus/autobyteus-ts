import { ParameterSchema, ParameterDefinition, ParameterType } from '../utils/parameter_schema.js';
import { BaseTool } from './base_tool.js';
import { ToolConfig } from './tool_config.js';
import { ToolDefinition } from './registry/tool_definition.js';
import { defaultToolRegistry } from './registry/tool_registry.js';
import { ToolOrigin } from './tool_origin.js';
import { ToolCategory } from './tool_category.js';

export type ParamTypeHint =
  | ParameterType
  | {
      type: ParameterType;
      arrayItemSchema?: ParameterType | ParameterSchema | Record<string, any>;
    };

export interface ToolDecoratorOptions {
  name?: string;
  description?: string;
  argumentSchema?: ParameterSchema | null;
  configSchema?: ParameterSchema | null;
  category?: string;
  paramTypeHints?: Record<string, ParamTypeHint>;
  paramDefaults?: Record<string, any>;
  paramNames?: string[];
}

export class FunctionalTool extends BaseTool {
  private readonly _originalFunc: (...args: any[]) => any;
  private readonly _isAsync: boolean;
  private readonly _expectsContext: boolean;
  private readonly _expectsToolState: boolean;
  private readonly _funcParamNames: string[];
  private readonly _callParamOrder: string[];
  private readonly _instantiationConfig: Record<string, any>;
  private readonly _name: string;
  private readonly _description: string;
  private readonly _argumentSchema: ParameterSchema | null;
  private readonly _configSchema: ParameterSchema | null;

  constructor(
    originalFunc: (...args: any[]) => any,
    name: string,
    description: string,
    argumentSchema: ParameterSchema | null,
    configSchema: ParameterSchema | null,
    isAsync: boolean,
    expectsContext: boolean,
    expectsToolState: boolean,
    funcParamNames: string[],
    callParamOrder: string[],
    instantiationConfig?: Record<string, any>
  ) {
    super(instantiationConfig ? new ToolConfig(instantiationConfig) : undefined);
    this._originalFunc = originalFunc;
    this._isAsync = isAsync;
    this._expectsContext = expectsContext;
    this._expectsToolState = expectsToolState;
    this._funcParamNames = funcParamNames;
    this._callParamOrder = callParamOrder;
    this._instantiationConfig = instantiationConfig ?? {};
    this._name = name;
    this._description = description;
    this._argumentSchema = argumentSchema;
    this._configSchema = configSchema;
  }

  public getName(): string {
    return this._name;
  }

  public getDescription(): string {
    return this._description;
  }

  public getArgumentSchema(): ParameterSchema | null { return this._argumentSchema; }
  public getConfigSchema(): ParameterSchema | null { return this._configSchema; }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<any> {
    const args: any[] = [];
    for (const paramName of this._callParamOrder) {
      if (paramName === 'context') {
        args.push(context);
      } else if (paramName === 'tool_state' || paramName === 'toolState') {
        args.push(this.toolState);
      } else if (Object.prototype.hasOwnProperty.call(kwargs, paramName)) {
        args.push(kwargs[paramName]);
      } else {
        args.push(undefined);
      }
    }

    if (this._isAsync) {
      return this._originalFunc(...args);
    }

    return Promise.resolve(this._originalFunc(...args));
  }
}

const DEFAULT_DESC_SUFFIX = " This is expected to be a path.";

function extractParamNames(func: Function): string[] {
  const source = func.toString().trim();
  const parenMatch = source.match(/^[\s\S]*?\(([^)]*)\)/);
  let args = '';
  if (parenMatch) {
    args = parenMatch[1];
  } else {
    const arrowMatch = source.match(/^([A-Za-z_$][\w$]*)\s*=>/);
    if (arrowMatch) {
      args = arrowMatch[1];
    }
  }

  if (!args) {
    return [];
  }

  return args
    .split(',')
    .map((param) => param.trim())
    .filter(Boolean)
    .map((param) => param.replace(/=.*$/, '').replace(/^\.\.\./, '').trim())
    .filter(Boolean);
}

function buildParamDescription(paramName: string, toolName: string): string {
  let desc = `Parameter '${paramName}' for tool '${toolName}'.`;
  const lower = paramName.toLowerCase();
  if (lower.includes('path') || lower.includes('file') || lower.includes('dir') || lower.includes('folder')) {
    desc += DEFAULT_DESC_SUFFIX;
  }
  return desc;
}

function normalizeArrayItemSchema(schema?: ParameterType | ParameterSchema | Record<string, any>): ParameterSchema | Record<string, any> | ParameterType {
  if (!schema) {
    return {};
  }
  if (schema instanceof ParameterSchema) {
    return schema;
  }
  if (Object.values(ParameterType).includes(schema as ParameterType)) {
    return { type: schema === ParameterType.FLOAT ? 'number' : schema };
  }
  return schema;
}

function getDocString(func: Function): string | null {
  const doc = (func as any).__doc__ || (func as any).description;
  if (typeof doc === 'string' && doc.trim().length > 0) {
    return doc.trim();
  }
  return null;
}

export function _parseSignature(
  func: Function,
  toolName: string,
  options: {
    paramTypeHints?: Record<string, ParamTypeHint>;
    paramDefaults?: Record<string, any>;
    paramNames?: string[];
  } = {}
): [string[], boolean, boolean, ParameterSchema] {
  const paramNames = options.paramNames ?? extractParamNames(func);
  const expectsContext = paramNames.includes('context');
  const expectsToolState = paramNames.includes('tool_state') || paramNames.includes('toolState');
  const schema = new ParameterSchema();

  for (const paramName of paramNames) {
    if (paramName === 'context') continue;
    if (paramName === 'tool_state' || paramName === 'toolState') continue;

    const hint = options.paramTypeHints?.[paramName];
    let paramType = ParameterType.STRING;
    let arrayItemSchema: any = undefined;

    if (hint) {
      if (typeof hint === 'object' && 'type' in hint) {
        paramType = hint.type;
        if (paramType === ParameterType.ARRAY) {
          arrayItemSchema = normalizeArrayItemSchema(hint.arrayItemSchema);
        }
      } else {
        paramType = hint as ParameterType;
        if (paramType === ParameterType.ARRAY) {
          arrayItemSchema = {};
        }
      }
    }

    let required = true;
    let defaultValue: any = undefined;
    if (options.paramDefaults && Object.prototype.hasOwnProperty.call(options.paramDefaults, paramName)) {
      required = false;
      defaultValue = options.paramDefaults[paramName];
    }

    const paramDef = new ParameterDefinition({
      name: paramName,
      type: paramType,
      description: buildParamDescription(paramName, toolName),
      required,
      defaultValue,
      arrayItemSchema
    });
    schema.addParameter(paramDef);
  }

  const filteredParamNames = paramNames.filter(
    (name) => name !== 'context' && name !== 'tool_state' && name !== 'toolState'
  );

  return [filteredParamNames, expectsContext, expectsToolState, schema];
}

export function tool(
  func?: ((...args: any[]) => any) | ToolDecoratorOptions,
  options: ToolDecoratorOptions = {}
): any {
  const resolvedOptions =
    func && typeof func !== 'function'
      ? (func as ToolDecoratorOptions)
      : options;

  const decorator = (target: (...args: any[]) => any) => {
    const toolName = resolvedOptions.name ?? target.name ?? 'functional_tool';
    const doc = getDocString(target);
    const toolDesc = resolvedOptions.description ?? (doc ? doc.split('\n\n')[0] : `Functional tool: ${toolName}`);

    const allParamNames = resolvedOptions.paramNames ?? extractParamNames(target);
    const [funcParamNames, expectsContext, expectsToolState, generatedSchema] = _parseSignature(
      target,
      toolName,
      {
        paramTypeHints: resolvedOptions.paramTypeHints,
        paramDefaults: resolvedOptions.paramDefaults,
        paramNames: allParamNames
      }
    );

    const finalSchema = resolvedOptions.argumentSchema ?? generatedSchema;
    const configSchema = resolvedOptions.configSchema ?? null;
    const category = resolvedOptions.category ?? ToolCategory.GENERAL;

    const descriptionProvider = () => {
      const latestDoc = getDocString(target);
      return resolvedOptions.description ?? (latestDoc ? latestDoc.split('\n\n')[0] : `Functional tool: ${toolName}`);
    };

    const factory = (instConfig?: ToolConfig) =>
      new FunctionalTool(
        target,
        toolName,
        toolDesc,
        finalSchema,
        configSchema,
        target.constructor.name === 'AsyncFunction',
        expectsContext,
        expectsToolState,
        funcParamNames,
        allParamNames,
        instConfig?.params
      );

    const definition = new ToolDefinition(
      toolName,
      toolDesc,
      ToolOrigin.LOCAL,
      category,
      () => finalSchema,
      () => configSchema,
      { customFactory: factory, descriptionProvider }
    );
    defaultToolRegistry.registerTool(definition);

    return factory();
  };

  if (typeof func === 'function') {
    return decorator(func);
  }

  return decorator;
}
