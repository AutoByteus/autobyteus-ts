import { EventEmitter } from 'events';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../utils/parameter_schema.js';
import { ToolConfig } from './tool_config.js';
import { ToolState } from './tool_state.js';

export type ToolClass = (new (config?: ToolConfig) => BaseTool) & typeof BaseTool;

export abstract class BaseTool extends EventEmitter {
  protected agentId: string | null = null;
  public definition: any = null; // Injected by registry
  protected config: ToolConfig | undefined;
  public toolState: ToolState;

  constructor(config?: ToolConfig) {
    super();
    this.config = config;
    this.toolState = new ToolState();
  }

  static getName(): string {
    return this.name;
  }

  static getDescription(): string {
     throw new Error("Subclasses must implement getDescription().");
  }

  static getArgumentSchema(): ParameterSchema | null {
     throw new Error("Subclasses must implement getArgumentSchema().");
  }

  static getConfigSchema(): ParameterSchema | null {
    return null;
  }

  public setAgentId(agentId: string): void {
    if (!agentId || typeof agentId !== 'string') {
      console.error(`Attempted to set invalid agentId: ${agentId}`);
      return;
    }
    this.agentId = agentId;
  }

  protected getArgumentSchema(): ParameterSchema | null {
    return (this.constructor as typeof BaseTool).getArgumentSchema();
  }

  protected getName(): string {
    return (this.constructor as typeof BaseTool).getName();
  }

  private coerceArgumentTypes(kwargs: Record<string, any>): Record<string, any> {
    const argSchema = this.getArgumentSchema();
    if (!argSchema) {
      return kwargs;
    }
    return this.coerceObjectRecursively(kwargs, argSchema);
  }

  private coerceObjectRecursively(data: Record<string, any>, schema: ParameterSchema): Record<string, any> {
    const coerced: Record<string, any> = { ...data };
    for (const [name, value] of Object.entries(data)) {
      const paramDef = schema.getParameter(name);
      if (paramDef) {
        coerced[name] = this.coerceValueRecursively(value, paramDef);
      }
    }
    return coerced;
  }

  private coerceValueRecursively(value: any, paramDef: ParameterDefinition): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (paramDef.type === ParameterType.ARRAY && value === '') {
      return [];
    }

    if (paramDef.type === ParameterType.OBJECT && paramDef.objectSchema && this.isPlainObject(value)) {
      return this.coerceObjectRecursively(value, paramDef.objectSchema);
    }

    if (paramDef.type === ParameterType.ARRAY && Array.isArray(value)) {
      const itemSchema = paramDef.arrayItemSchema;
      if (itemSchema instanceof ParameterSchema) {
        return value.map((item) => (this.isPlainObject(item) ? this.coerceObjectRecursively(item, itemSchema) : item));
      }
      if (itemSchema && typeof itemSchema === 'object' && (itemSchema as any).type === 'object') {
        const tempSchema = this.buildSchemaFromJsonSchema(itemSchema as Record<string, any>);
        if (tempSchema) {
          return value.map((item) => (this.isPlainObject(item) ? this.coerceObjectRecursively(item, tempSchema) : item));
        }
      }
      return value;
    }

    if (typeof value === 'string') {
      try {
        if (paramDef.type === ParameterType.INTEGER) {
          const intVal = parseInt(value, 10);
          if (!Number.isNaN(intVal)) {
            return intVal;
          }
        } else if (paramDef.type === ParameterType.FLOAT) {
          const floatVal = parseFloat(value);
          if (!Number.isNaN(floatVal)) {
            return floatVal;
          }
        } else if (paramDef.type === ParameterType.BOOLEAN) {
          const lowerVal = value.toLowerCase();
          if (['true', '1', 'yes'].includes(lowerVal)) {
            return true;
          }
          if (['false', '0', 'no'].includes(lowerVal)) {
            return false;
          }
        }
      } catch (error) {
        console.warn(`Could not coerce argument '${paramDef.name}' with value '${value}' to type ${paramDef.type}.`);
      }
    }

    return value;
  }

  private buildSchemaFromJsonSchema(schema: Record<string, any>): ParameterSchema | null {
    const props = schema.properties ?? {};
    const required: string[] = Array.isArray(schema.required) ? schema.required : [];
    const tempSchema = new ParameterSchema();
    for (const [propName, propDetails] of Object.entries(props)) {
      const details = propDetails as Record<string, any>;
      const typeStr = (details.type ?? 'string') as string;
      const paramType = this.mapJsonType(typeStr);
      tempSchema.addParameter(new ParameterDefinition({
        name: propName,
        type: paramType,
        description: String(details.description ?? ''),
        required: required.includes(propName),
        arrayItemSchema: details.items
      }));
    }
    return tempSchema;
  }

  private mapJsonType(typeStr: string): ParameterType {
    switch (typeStr) {
      case 'integer':
        return ParameterType.INTEGER;
      case 'number':
        return ParameterType.FLOAT;
      case 'boolean':
        return ParameterType.BOOLEAN;
      case 'object':
        return ParameterType.OBJECT;
      case 'array':
        return ParameterType.ARRAY;
      case 'string':
      default:
        return ParameterType.STRING;
    }
  }

  private validateAgainstSchema(schema: ParameterSchema, data: Record<string, any>): string[] {
    const errors: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      const paramDef = schema.getParameter(key);
      if (!paramDef) {
        continue;
      }
      if (!this.validateValue(value, paramDef)) {
        const preview = String(value).slice(0, 50);
        errors.push(
          `Invalid value for parameter '${paramDef.name}': '${preview}...'. Expected type compatible with ${paramDef.type}.`
        );
      }
    }
    return errors;
  }

  private validateValue(value: any, paramDef: ParameterDefinition): boolean {
    if (value === null || value === undefined) {
      return !paramDef.required;
    }

    switch (paramDef.type) {
      case ParameterType.STRING: {
        if (typeof value !== 'string') return false;
        if (paramDef.pattern) {
          try {
            const regex = new RegExp(paramDef.pattern);
            if (!regex.test(value)) return false;
          } catch {
            return false;
          }
        }
        return true;
      }
      case ParameterType.INTEGER:
        return typeof value === 'number' && Number.isInteger(value);
      case ParameterType.FLOAT:
        return typeof value === 'number' && !Number.isNaN(value);
      case ParameterType.BOOLEAN:
        return typeof value === 'boolean';
      case ParameterType.ENUM:
        return typeof value === 'string' && (paramDef.enumValues ?? []).includes(value);
      case ParameterType.OBJECT:
        return this.isPlainObject(value);
      case ParameterType.ARRAY:
        return Array.isArray(value);
      default:
        return true;
    }
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  public async execute(context: any, kwargs: Record<string, any> = {}): Promise<any> {
     const toolName = this.getName();

     if (this.agentId === null && context?.agentId) {
       this.setAgentId(context.agentId);
     }

     const coercedArgs = this.coerceArgumentTypes(kwargs);
     const argSchema = this.getArgumentSchema();

     if (argSchema) {
       const [isValid, errors] = argSchema.validateConfig(coercedArgs);
       const typeErrors = this.validateAgainstSchema(argSchema, coercedArgs);
       const combinedErrors = [...errors, ...typeErrors];
       if (!isValid || combinedErrors.length > 0) {
         const errorMessage = `Invalid arguments for tool '${toolName}': ${combinedErrors.join('; ')}`;
         console.error(errorMessage);
         throw new Error(errorMessage);
       }
     } else if (Object.keys(coercedArgs).length > 0) {
       console.warn(
         `Tool '${toolName}' does not define an argument schema but received arguments: ${JSON.stringify(coercedArgs)}.`
       );
     }

     return this._execute(context, coercedArgs);
  }

  protected abstract _execute(context: any, kwargs?: Record<string, any>): Promise<any>;

  public async cleanup(): Promise<void> {
    // no-op
  }
}
