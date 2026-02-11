export interface Parameter {
  insId: string;
  value: string;
  number: string;
  [k: string]: any;
}
export interface ParameterRef {
  getValue(): string;
  getParameter(): Parameter;
}
