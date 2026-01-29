export enum ParameterType {
  STRING = "string",
  INTEGER = "integer",
  FLOAT = "float",
  BOOLEAN = "boolean",
  ENUM = "enum",
  OBJECT = "object",
  ARRAY = "array"
}

export interface ParameterDefinitionConfig {
  name: string;
  type: ParameterType;
  description: string;
  required?: boolean;
  defaultValue?: any;
  enumValues?: string[];
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  arrayItemSchema?: ParameterType | ParameterSchema | any;
  objectSchema?: ParameterSchema;
}

export class ParameterDefinition {
  public name: string;
  public type: ParameterType;
  public description: string;
  public required: boolean;
  public defaultValue: any;
  public enumValues?: string[];
  public minValue?: number;
  public maxValue?: number;
  public pattern?: string;
  public arrayItemSchema?: ParameterType | ParameterSchema | any;
  public objectSchema?: ParameterSchema;

  constructor(config: ParameterDefinitionConfig) {
    if (!config.name) throw new Error("ParameterDefinition name must be a non-empty string");
    if (!config.description) throw new Error(`ParameterDefinition '${config.name}' must have a non-empty description`);
    
    this.name = config.name;
    this.type = config.type;
    this.description = config.description;
    this.required = config.required ?? false;
    this.defaultValue = config.defaultValue;
    this.enumValues = config.enumValues;
    this.minValue = config.minValue;
    this.maxValue = config.maxValue;
    this.pattern = config.pattern;
    this.arrayItemSchema = config.arrayItemSchema;
    this.objectSchema = config.objectSchema;

    if (this.type === ParameterType.ENUM && !this.enumValues) {
      throw new Error(`ParameterDefinition '${this.name}' of type ENUM must specify enumValues`);
    }

    if (this.arrayItemSchema !== undefined && this.arrayItemSchema !== null) {
      const isParameterType = Object.values(ParameterType).includes(this.arrayItemSchema as ParameterType);
      const isSchema = this.arrayItemSchema instanceof ParameterSchema;
      const isObject = typeof this.arrayItemSchema === 'object';
      if (!isParameterType && !isSchema && !isObject) {
        throw new Error(`ParameterDefinition '${this.name}': arrayItemSchema must be a ParameterType, ParameterSchema, or object.`);
      }
    }

    if (this.objectSchema !== undefined && this.objectSchema !== null && !(this.objectSchema instanceof ParameterSchema)) {
      throw new Error(`ParameterDefinition '${this.name}': objectSchema must be a ParameterSchema instance.`);
    }

    if (this.type !== ParameterType.ARRAY && this.arrayItemSchema !== undefined && this.arrayItemSchema !== null) {
      throw new Error(`ParameterDefinition '${this.name}': arrayItemSchema should only be provided if type is ARRAY.`);
    }

    if (this.type !== ParameterType.OBJECT && this.objectSchema !== undefined && this.objectSchema !== null) {
      throw new Error(`ParameterDefinition '${this.name}': objectSchema should only be provided if type is OBJECT.`);
    }
  }

  public toJsonSchemaProperty(): Record<string, any> {
    const prop: Record<string, any> = {
      description: this.description
    };

    if (this.type === ParameterType.OBJECT && this.objectSchema) {
      const schema = this.objectSchema.toJsonSchema();
      // Merge properties from schema
      if (schema.properties) prop.properties = schema.properties;
      if (schema.required) prop.required = schema.required;
      prop.type = "object";
      prop.description = this.description; // Ensure description override
      return prop;
    }

    // Map type
    if (this.type === ParameterType.FLOAT) prop.type = "number";
    else if (this.type === ParameterType.ENUM) prop.type = "string";
    else prop.type = this.type;

    if (this.defaultValue !== undefined) prop.default = this.defaultValue;
    if (this.type === ParameterType.ENUM && this.enumValues) prop.enum = this.enumValues;
    
    if ((this.type === ParameterType.INTEGER || this.type === ParameterType.FLOAT)) {
      if (this.minValue !== undefined) prop.minimum = this.minValue;
      if (this.maxValue !== undefined) prop.maximum = this.maxValue;
    }

    if (this.type === ParameterType.STRING && this.pattern) {
      prop.pattern = this.pattern;
    }

    if (this.type === ParameterType.ARRAY) {
       if (this.arrayItemSchema instanceof ParameterSchema) {
         prop.items = this.arrayItemSchema.toJsonSchema();
       } else if (typeof this.arrayItemSchema === 'object') {
         prop.items = this.arrayItemSchema;
       } else if (Object.values(ParameterType).includes(this.arrayItemSchema)) {
         prop.items = { type: this.arrayItemSchema === ParameterType.FLOAT ? 'number' : this.arrayItemSchema };
       } else {
         prop.items = true;
       }
    }

    return prop;
  }

  public toConfig(): ParameterDefinitionConfig {
      const config: ParameterDefinitionConfig = {
          name: this.name,
          type: this.type,
          description: this.description,
          required: this.required,
          defaultValue: this.defaultValue,
          enumValues: this.enumValues,
          minValue: this.minValue,
          maxValue: this.maxValue,
          pattern: this.pattern
      };
      
      if (this.arrayItemSchema) {
          if (this.arrayItemSchema instanceof ParameterSchema) {
              config.arrayItemSchema = this.arrayItemSchema.toConfig();
          } else {
              config.arrayItemSchema = this.arrayItemSchema;
          }
      }
      
      if (this.objectSchema) {
          config.objectSchema = this.objectSchema.toConfig() as any;
      }
      
      return config;
  }
}

export class ParameterSchema {
  public parameters: ParameterDefinition[] = [];

  constructor(parameters: ParameterDefinition[] = []) {
    parameters.forEach(p => this.addParameter(p));
  }

  public addParameter(parameter: ParameterDefinition): void {
    if (this.parameters.some(p => p.name === parameter.name)) {
      throw new Error(`Parameter '${parameter.name}' already exists in schema`);
    }
    this.parameters.push(parameter);
  }

  public getParameter(name: string): ParameterDefinition | undefined {
    return this.parameters.find(p => p.name === name);
  }

  public validateConfig(configData: Record<string, any>): [boolean, string[]] {
    const errors: string[] = [];
    for (const param of this.parameters) {
      if (param.required && !(param.name in configData)) {
        errors.push(`Required parameter '${param.name}' is missing.`);
      }
    }
    return [errors.length === 0, errors];
  }

  public toJsonSchema(): Record<string, any> {
    if (this.parameters.length === 0) {
      return { type: "object", properties: {}, required: [] };
    }
    
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of this.parameters) {
      properties[param.name] = param.toJsonSchemaProperty();
      if (param.required) {
        required.push(param.name);
      }
    }

    return { type: "object", properties, required };
  }

  // Python parity: keep a dict-style helper name used by callers.
  public toJsonSchemaDict(): Record<string, any> {
    return this.toJsonSchema();
  }

  public toConfig(): Record<string, any> {
      return {
          parameters: this.parameters.map(p => p.toConfig())
      };
  }

  static fromConfig(config: Record<string, any>): ParameterSchema {
      const schema = new ParameterSchema();
      const params = config.parameters || [];
      for (const pConfig of params) {
          const normalizedConfig = { ...pConfig };

          if (
              normalizedConfig.type === ParameterType.ENUM &&
              (!Array.isArray(normalizedConfig.enumValues) || normalizedConfig.enumValues.length === 0)
          ) {
              normalizedConfig.type = ParameterType.STRING;
              delete normalizedConfig.enumValues;
          }

          // Handle nested recursion
          let arrayItemSchema = normalizedConfig.arrayItemSchema;
          if (arrayItemSchema && arrayItemSchema.parameters) {
              arrayItemSchema = ParameterSchema.fromConfig(arrayItemSchema);
          }
          
          let objectSchema = normalizedConfig.objectSchema;
          if (objectSchema && objectSchema.parameters) {
              objectSchema = ParameterSchema.fromConfig(objectSchema);
          } else if (objectSchema instanceof ParameterSchema) {
              // already instance
          }

          schema.addParameter(new ParameterDefinition({
              ...normalizedConfig,
              arrayItemSchema,
              objectSchema
          }));
      }
      return schema;
  }
}
