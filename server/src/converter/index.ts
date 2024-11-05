import type { Core } from '@strapi/strapi';
import { pluginName } from '../register';
import { PluginConfig, SchemaInfo, SchemaSource } from './types';
import { Logger } from './logger';
import { pascalCase } from 'pascal-case';
import {
  capitalizeFirstLetter,
  getAttributeComponentInfo,
  hasDefaultValue,
  isOptional,
} from './common';
import prettier from 'prettier';
import { FileHelpers } from './fileHelpers';

export default function convertSchemasToTs(strapi: Core.Strapi, config: any) {
  const currentNodeEnv: string = process.env.NODE_ENV ?? '';
  const acceptedNodeEnvs = config.acceptedNodeEnvs ?? [];
  if (!acceptedNodeEnvs.includes(currentNodeEnv)) {
    console.log(
      `${pluginName} plugin's acceptedNodeEnvs property does not include '${currentNodeEnv}' environment. Skipping conversion of schemas to Typescript.`
    );
    return;
  }

  const converter = new Converter(
    {
      contentTypes: strapi.contentTypes,
      components: strapi.components,
    },
    config
  );
  converter.convertToTs();
}

export class Converter {
  private readonly config: PluginConfig;
  private contentTypes: any;
  private components: any;
  private logger: Logger;
  private prettierOptions: prettier.Options | undefined;

  constructor(
    {
      contentTypes,
      components,
    }: {
      contentTypes: any;
      components: any;
    },
    config: PluginConfig
  ) {
    this.contentTypes = contentTypes;
    this.components = components;
    this.config = config;
    this.logger = new Logger(config.verboseLogs);
  }

  public convertToTs(): void {
    const schemas: SchemaInfo[] = [];

    for (const uid in this.contentTypes) {
      if (this.shouldSkipSchema(uid)) {
        this.logger.log(`Skipping contentType ${uid}`);
        continue;
      }

      if (this.contentTypes[uid].info.singularName == 'file') {
        this.contentTypes[uid].info.singularName = 'media';
      }

      this.logger.log(`Converting contentType ${uid}`);

      schemas.push(this.parseSchema(this.contentTypes[uid], SchemaSource.Api));
    }

    for (const uid in this.components) {
      if (this.shouldSkipSchema(uid)) {
        this.logger.log(`Skipping component ${uid}`);
        continue;
      }

      this.logger.log(`Converting component ${uid}`);

      schemas.push(this.parseSchema(this.components[uid], SchemaSource.Component));
    }

    for (const schema of schemas) {
      this.convertSchemaToInterfaces(schema, schemas);
    }

    this.writeInterfacesFile(schemas);
  }

  private shouldSkipSchema(uid: string): boolean {
    if (uid.includes('admin::') || this.config.contentTypesToIgnore.includes(uid)) return true;

    for (const r of this.config.contentTypesToIgnore) {
      try {
        if (new RegExp(r).test(uid)) {
          return true;
        }
      } catch (error) {}
    }
    return false;
  }

  private parseSchema(schema: any, schemaSource: SchemaSource): SchemaInfo {
    let schemaName = '';

    switch (schemaSource) {
      case SchemaSource.Api:
        schemaName = schema.info.singularName;
        break;
      case SchemaSource.Common:
        schemaName = schema.info.displayName;
        break;
      case SchemaSource.Component:
        schemaName = schema.info.displayName;
        break;
    }

    let pascalName: string = pascalCase(schemaName);
    let needsComponentSuffix: boolean =
      schemaSource === SchemaSource.Component && this.config.alwaysAddComponentSuffix;
    if (needsComponentSuffix) {
      pascalName += 'Component';
    }

    return {
      schema: schema,
      schemaName: schemaName,
      pascalName: pascalName,
      needsComponentSuffix: needsComponentSuffix,
      source: schemaSource,
      interfaceAsText: '',
      plainInterfaceAsText: '',
      enums: [],
    };
  }

  private convertSchemaToInterfaces(schemaInfo: SchemaInfo, schemas: SchemaInfo[]): void {
    if (!schemaInfo.schema) {
      this.logger.log(`Schema ${schemaInfo.schemaName} is empty. Skipping conversion.`);
      return;
    }

    const interfaceName = schemaInfo.pascalName;

    const interfaceEnums: string[] = [];
    const interfaceDependencies: string[] = [];

    let interfaceText = `export interface ${interfaceName}<P extends boolean = true> {\n`;
    if (schemaInfo.source === SchemaSource.Api) {
      interfaceText += `  id?: number;\n`;
      interfaceText += `  documentId?: string;\n`;
    }

    const attributes = Object.entries(schemaInfo.schema.attributes);
    for (const attribute of attributes) {
      const originalPropertyName: string = attribute[0];

      let propertyName: string = originalPropertyName;
      const attributeValue: any = attribute[1];
      if (isOptional(attributeValue)) {
        propertyName += '?';
      }

      let propertyType: string;
      let propertyDefinition: string;

      if (schemaInfo.schema.info.singularName == 'media' && originalPropertyName == 'formats') {
        interfaceText += `formats: { thumbnail: MediaFormat; small: MediaFormat; medium: MediaFormat; large: MediaFormat };`;
        continue;
      }

      // -------------------------------------------------
      // Relation
      // -------------------------------------------------
      if (attributeValue.type === 'relation') {
        if (!attributeValue.target || this.shouldSkipSchema(attributeValue.target)) {
          continue;
        }

        propertyType = `${pascalCase(attributeValue.target.split('.')[1])}`;

        interfaceDependencies.push(propertyType);
        const isArray = attributeValue.relation.endsWith('ToMany');
        const bracketsIfArray = isArray ? '<P>[] : number[]' : '<P> | null : number | null';

        propertyDefinition = `${propertyName}${isOptional(attributeValue) ? '' : '?'}: P extends true ? ${propertyType}${bracketsIfArray};\n`;
      }

      // -------------------------------------------------
      // Component
      // -------------------------------------------------
      else if (attributeValue.type === 'component') {
        propertyType =
          attributeValue.target === 'plugin::users-permissions.user'
            ? 'User'
            : pascalCase(attributeValue.component.split('.')[1]);

        const componentInfo: SchemaInfo = getAttributeComponentInfo(propertyType, schemas);
        if (componentInfo?.needsComponentSuffix) {
          propertyType += 'Component';
        }

        interfaceDependencies.push(propertyType);
        const isArray = attributeValue.repeatable;
        const bracketsIfArray = isArray ? '[]' : '';
        propertyDefinition = `${propertyName}: ${propertyType}${bracketsIfArray};\n`;
      }

      // -------------------------------------------------
      // Dynamic zone
      // -------------------------------------------------
      else if (attributeValue.type === 'dynamiczone') {
        // TODO
        propertyType = 'any';
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Media
      // -------------------------------------------------
      else if (attributeValue.type === 'media') {
        propertyType = 'Media';
        interfaceDependencies.push(propertyType);

        const bracketsIfArray = attributeValue.multiple
          ? '<P>[] : number[]'
          : '<P> | null : number | null';
        propertyDefinition = `${propertyName}${isOptional(attributeValue) ? '' : '?'}: P extends true ? ${propertyType}${bracketsIfArray};\n`;
      }

      // -------------------------------------------------
      // Enumeration
      // -------------------------------------------------
      else if (attributeValue.type === 'enumeration') {
        let enumName: string = capitalizeFirstLetter(pascalCase(originalPropertyName));
        enumName = schemaInfo.pascalName + '_' + enumName;

        const enumOptions: string = attributeValue.enum
          .map((value: string) => {
            let key: string = value;
            // The normalize('NFD') method will decompose the accented characters into their basic letters and combining diacritical marks.
            key = key.normalize('NFD');

            // Following Typescript documentation, enum keys are Pascal Case.: https://www.typescriptlang.org/docs/handbook/enums.html
            key = pascalCase(key);

            /*
      The /[^a-z0-9]/gi is a regular expression that matches any character that is not a letter (a-z, case insensitive due to i) or a digit (0-9).
      The g means it's a global search, so it will replace all instances, not just the first one.
      The replace method then replaces all those matched characters with nothing (''), effectively removing them from the string.
      This even trims the value.
      */
            key = key.replace(/[^a-z0-9]/gi, '');

            if (!isNaN(parseFloat(key))) {
              key = '_' + key;
            }
            return `  ${key} = '${value}',`;
          })
          .join('\n');
        const enumText: string = `export enum ${enumName} {\n${enumOptions}}`;
        interfaceEnums.push(enumText);

        propertyDefinition = `${propertyName}: ${enumName};\n`;
      }

      // -------------------------------------------------
      // Text, RichText, Email, UID
      // -------------------------------------------------
      else if (
        attributeValue.type === 'string' ||
        attributeValue.type === 'text' ||
        attributeValue.type === 'richtext' ||
        attributeValue.type === 'email' ||
        attributeValue.type === 'password' ||
        attributeValue.type === 'uid'
      ) {
        propertyType = 'string';
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Json
      // -------------------------------------------------
      else if (attributeValue.type === 'json') {
        propertyType = 'any';
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Password
      // -------------------------------------------------
      else if (attributeValue.type === 'password') {
        propertyDefinition = '';
      }

      // -------------------------------------------------
      // Number
      // -------------------------------------------------
      else if (
        attributeValue.type === 'integer' ||
        attributeValue.type === 'biginteger' ||
        attributeValue.type === 'decimal' ||
        attributeValue.type === 'float'
      ) {
        propertyType = `number${!hasDefaultValue(attributeValue) ? ' | null' : ''}`;
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Date
      // -------------------------------------------------
      else if (
        attributeValue.type === 'date' ||
        attributeValue.type === 'datetime' ||
        attributeValue.type === 'time'
      ) {
        propertyType = `string${!hasDefaultValue(attributeValue) ? ' | null' : ''}`;
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Boolean
      // -------------------------------------------------
      else if (attributeValue.type === 'boolean') {
        propertyType = 'boolean';
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }

      // -------------------------------------------------
      // Others
      // -------------------------------------------------
      else {
        propertyType = 'any';
        propertyDefinition = `${propertyName}: ${propertyType};\n`;
      }
      interfaceText += propertyDefinition;
    }

    // -------------------------------------------------
    // Localization
    // -------------------------------------------------
    if (schemaInfo.schema.pluginOptions?.i18n?.localized) {
      interfaceText += `locale: string;\n`;
      interfaceText += `localizations?: ${schemaInfo.pascalName}[];\n`;
    }

    interfaceText += '}\n';

    schemaInfo.enums = [...new Set([...interfaceEnums])];
    schemaInfo.plainInterfaceAsText = interfaceText;
  }

  private toFileText(schemas: SchemaInfo[]): string {
    let fileText = '';

    for (const schema of schemas) {
      if (schema.enums.length > 0) {
        fileText += schema.enums.join('\n\n');
      }
    }

    for (const schema of schemas) {
      fileText += schema.plainInterfaceAsText;
    }

    fileText += `
        export interface MediaFormat {
            name: string;
            hash: string;
            ext: string;
            mime: string;
            width: number;
            height: number;
            size: number;
            path: string;
            url: string;
        }
        `;

    let interfaceContentTypes = `export interface ContentTypes<P extends boolean = true> {\n`;
    for (let schema of schemas) {
      if (schema.source == SchemaSource.Api)
        interfaceContentTypes += `  ${schema.pascalName}: ${schema.pascalName}<P>;\n`;
    }

    interfaceContentTypes += `};\n`;

    fileText += interfaceContentTypes;

    let interfaceComponents = `export interface Components<P extends boolean = true> {\n`;
    for (let schema of schemas) {
      if (schema.source == SchemaSource.Component)
        interfaceComponents += `  ${schema.pascalName}: ${schema.pascalName}<P>;\n`;
    }

    interfaceComponents += `};\n`;

    fileText += interfaceComponents;

    let enumContentTypesUID = `export enum ContentTypesUID {\n`;
    for (let schema of schemas) {
      if (schema.source == SchemaSource.Api)
        enumContentTypesUID += `  ${schema.pascalName} = '${schema.schema.uid}',\n`;
    }

    enumContentTypesUID += `};\n`;

    fileText += enumContentTypesUID;

    fileText += `export type ContentType<T extends keyof ContentTypes, P extends boolean = true> = ContentTypes<P>[T];\n`;

    fileText += `
    export interface APIResponseMany<T extends keyof ContentTypes> {
        data: ContentType<T>[];
        meta: {
            pagination: {
                page: number;
                pageSize: number;
                pageCount: number;
                total: number;
            };
        };
    }
    `;

    fileText += `
    export interface APIResponseSingle<T extends keyof ContentTypes> {
        data: ContentType<T>;
    }
    `;

    fileText +=
      `
    export interface APIRequestParams<T extends keyof ContentTypes> {
        populate?: any;
        fields?: (keyof ContentType<T, false>)[];
        locale?: string | string[];
        filters?: any;` +
      'sort?: `${string & keyof ContentType<T, false>}:asc` | `${string & keyof ContentType<T, false>}:desc` | (`${string & keyof ContentType<T, false>}:asc` | `${string & keyof ContentType<T, false>}:desc`)[];' +
      `pagination?: {
            page?: number;
            pageSize?: number;
        };
    }
    `;

    return fileText;
  }

  private async writeInterfacesFile(schemas: SchemaInfo[]): Promise<void> {
    let fileText = this.toFileText(schemas);

    await this.setPrettierOptions();

    if (this.prettierOptions) {
      const options = this.prettierOptions;
      if (!options.parser) {
        options.parser = 'typescript';
      }
      fileText = await prettier.format(fileText, options);
    }

    FileHelpers.writeInterfaceFile('', 'types/contentTypes.d.ts', fileText);
  }

  public async setPrettierOptions(): Promise<prettier.Options | undefined> {
    if (!this.config.usePrettierIfAvailable) {
      return;
    }

    const prettierConfigFile = await prettier.resolveConfigFile(strapi.dirs.app.root);
    if (prettierConfigFile !== null) {
      let prettierOptions = (await prettier.resolveConfig(prettierConfigFile, {
        editorconfig: true,
      })) as prettier.Options;
      this.prettierOptions = prettierOptions;
    }
  }
}
