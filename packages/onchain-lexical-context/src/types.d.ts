export interface ExtraSettings {
  iconScriptUrl?: string;
  isShowActions?: boolean;
  showTreeView?: boolean;
}

export interface InstanceConfig {
  uploadFiles(
    params: {type: string; text: string; suffix: string}[],
  ): Promise<string[]>;
}
