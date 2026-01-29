export class ProcessorOption {
  readonly name: string;
  readonly is_mandatory: boolean;

  constructor(name: string, is_mandatory: boolean) {
    this.name = name;
    this.is_mandatory = is_mandatory;
  }
}

export class HookOption {
  readonly name: string;
  readonly is_mandatory: boolean;

  constructor(name: string, is_mandatory: boolean) {
    this.name = name;
    this.is_mandatory = is_mandatory;
  }
}
