export interface InstanceBaseInfo {
  insId?: string;
  number?: string;
  insDesc?: string;
  itemCode?: number | string;
  objectApicode: string;
}

interface InstanceExtraAttributes {
  attributes: {[k: string]: any};
  newVal?: Record<string, any>;
  [key: string]: any;
}

export type Instance = InstanceBaseInfo & Partial<InstanceExtraAttributes>;

export type CompleteInstance = Required<InstanceBaseInfo> &
  InstanceExtraAttributes;
