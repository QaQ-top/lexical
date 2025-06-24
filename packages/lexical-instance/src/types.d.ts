export interface Instance {
  insId: string;
  number: string;
  insDesc: string;
  itemCode: number | string;
  objectApicode: string;
  attributes: {[k: string]: any};
  newVal?: Record<string, any>;
  [key: string]: any;
}
