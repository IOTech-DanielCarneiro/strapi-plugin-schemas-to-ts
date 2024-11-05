import type { Core } from '@strapi/strapi';
import { PluginConfig } from './converter/types';
import convertSchemasToTs from './converter';

export const pluginName: string = 'schemas-to-ts';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
    const config: PluginConfig = strapi.config.get(`plugin.${pluginName}`);
    convertSchemasToTs(strapi, config);
};

export default register;
