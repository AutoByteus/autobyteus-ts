import { ParameterDefinition, ParameterSchema, ParameterType } from '../../utils/parameter_schema.js';

type JsonObject = Record<string, any>;

export class McpSchemaMapper {
  private static readonly MCP_TYPE_TO_AUTOBYTEUS_TYPE_MAP: Record<string, ParameterType> = {
    string: ParameterType.STRING,
    integer: ParameterType.INTEGER,
    number: ParameterType.FLOAT,
    boolean: ParameterType.BOOLEAN,
    object: ParameterType.OBJECT,
    array: ParameterType.ARRAY
  };

  mapToAutobyteusSchema(mcpJsonSchema: JsonObject): ParameterSchema {
    if (!mcpJsonSchema || typeof mcpJsonSchema !== 'object' || Array.isArray(mcpJsonSchema)) {
      throw new Error('MCP JSON schema must be a dictionary.');
    }

    const autobyteusSchema = new ParameterSchema();
    const schemaType = mcpJsonSchema.type;

    if (schemaType !== 'object') {
      throw new Error(`MCP JSON schema root 'type' must be 'object', got '${schemaType}'.`);
    }

    const properties = mcpJsonSchema.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return autobyteusSchema;
    }

    const requiredParamsAtThisLevel = Array.isArray(mcpJsonSchema.required) ? mcpJsonSchema.required : [];

    for (const [paramName, paramMcpSchema] of Object.entries(properties)) {
      if (!paramMcpSchema || typeof paramMcpSchema !== 'object' || Array.isArray(paramMcpSchema)) {
        continue;
      }

      const paramSchema = paramMcpSchema as JsonObject;
      const mcpParamType = paramSchema.type;
      const description = paramSchema.description ?? `Parameter '${paramName}'.`;

      let nestedObjectSchema: ParameterSchema | undefined;
      let itemSchemaForArray: any;

      if (mcpParamType === 'object' && 'properties' in paramSchema) {
        nestedObjectSchema = this.mapToAutobyteusSchema(paramSchema);
      } else if (mcpParamType === 'array') {
        itemSchemaForArray = paramSchema.items ?? true;
      }

      let autobyteusParamType =
        McpSchemaMapper.MCP_TYPE_TO_AUTOBYTEUS_TYPE_MAP[mcpParamType] ?? ParameterType.STRING;

      const enumValues = paramSchema.enum;
      if (autobyteusParamType === ParameterType.STRING && enumValues) {
        autobyteusParamType = ParameterType.ENUM;
      }

      try {
        const paramDef = new ParameterDefinition({
          name: paramName,
          type: autobyteusParamType,
          description,
          required: requiredParamsAtThisLevel.includes(paramName),
          defaultValue: paramSchema.default,
          enumValues: autobyteusParamType === ParameterType.ENUM ? enumValues : undefined,
          minValue: paramSchema.minimum,
          maxValue: paramSchema.maximum,
          pattern: paramSchema.pattern,
          arrayItemSchema: mcpParamType === 'array' ? itemSchemaForArray : undefined,
          objectSchema: nestedObjectSchema
        });
        autobyteusSchema.addParameter(paramDef);
      } catch {
        continue;
      }
    }

    return autobyteusSchema;
  }
}
