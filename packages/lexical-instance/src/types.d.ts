export interface InstanceBaseInfo {
  insId: string;
  number: string;
  insDesc: string;
  itemCode: number | string;
  objectApicode: string;
}
export interface Instance extends InstanceBaseInfo {
  attributes: {[k: string]: any};
  newVal?: Record<string, any>;
  [key: string]: any;
}
