import { BaseSchemaFormatter, BaseExampleFormatter } from '../formatters/base_formatter.js';

export class ToolFormatterPair {
  public readonly schemaFormatter: BaseSchemaFormatter;
  public readonly exampleFormatter: BaseExampleFormatter;

  constructor(schemaFormatter: BaseSchemaFormatter, exampleFormatter: BaseExampleFormatter) {
    this.schemaFormatter = schemaFormatter;
    this.exampleFormatter = exampleFormatter;
  }
}
