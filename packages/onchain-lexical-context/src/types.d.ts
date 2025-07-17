export interface ExtraSettings {
  iconScriptUrl?: string;
  isShowActions?: boolean;
  showTreeView?: boolean;
}

export interface BuiltInInstanceConfig {
  selectedInstance: {
    number: string;
    nodeKey: string;
  }[];
  setSelectedInstance(params: InstanceConfig['selectedInstance']): void;
}
export interface InstanceConfig {
  uploadFiles(
    params: {type: string; text: string; suffix: string}[],
  ): Promise<string[]>;
  generateNumber(nodeKey?: string): Promise<string>;
}
