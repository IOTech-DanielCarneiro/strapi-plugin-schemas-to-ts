export interface PluginConfig {
  acceptedNodeEnvs: string[];
  verboseLogs: boolean;
  alwaysAddEnumSuffix: boolean;
  contentTypesToIgnore: (string | RegExp)[];
  alwaysAddComponentSuffix: boolean;
  usePrettierIfAvailable: boolean;
}

export enum SchemaSource {
    Component,
    Api,
    Common,
}

export enum SchemaType {
    Standard,
    Plain,
    NoRelations,
    AdminPanelLifeCycle,
}


export interface SchemaInfo {
  schema: any;
  schemaName: string;
  pascalName: string;
  needsComponentSuffix: boolean;
  source: SchemaSource;
  interfaceAsText: string;
  plainInterfaceAsText: string;
  enums: string[];
}

const defaultSchemaInfo: SchemaInfo = {
  schema: undefined,
  schemaName: '',
  pascalName: '',
  needsComponentSuffix: false,
  source: SchemaSource.Common,
  interfaceAsText: '',
  plainInterfaceAsText: '',
  enums: [],
};

export default defaultSchemaInfo;
