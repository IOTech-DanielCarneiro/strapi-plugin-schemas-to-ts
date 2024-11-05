# Strapi Plugin Schemas to TS

Strapi-Plugin-Schemas-to-TS is a plugin for **Strapi v5** that automatically **converts your Strapi schemas into Typescript interfaces**.

## Features
- Automatically generates Typescript interfaces from Strapi schemas
- Scans for new or updated Strapi schema files at each server start
- Provides accurate Typescript interfaces based on your Strapi schema files

## How it works
In every execution of the Strapi server, it reads all files containing schema definitions, both content types and components. Then generates Typescript interfaces based on those definitions. The interfaces will only be generated if they don't exist or if there have been changes. Otherwise they will be skipped, preventing the Strapi server to restart (in development) when modifying files.

## How to set it up
Here are the instructions to install and configure the package:

### Installation
To install the plugin execute either one of the following commands:
```sh
# Using Yarn
yarn add strapi-plugin-schemas-to-ts

# Using NPM
npm install strapi-plugin-schemas-to-ts
```

### Configuration
The plugin needs to be configured in the `./config/plugins.ts` file of Strapi. The file might need to be created if it does not exists. In that file, the plugin must be enabled in order for it to work:

```typescript
export default {
  // ...
    'schemas-to-ts': {
        enabled: true,
        resolve: 'strapi-plugin-schemas-to-ts'
    },
  // ...
}
```

While the previous example is enough to get it working, there are different properties that can be configured. Their default values are the ones in this example:
```typescript
export default {
  // ...
    'schemas-to-ts': {
      enabled: true,
      resolve: 'strapi-plugin-schemas-to-ts'
      config: {
            acceptedNodeEnvs: ['development'],
            verboseLogs: false,
            alwaysAddEnumSuffix: false,
            contentTypesToIgnore: ['plugin::upload.folder', 'plugin::i18n.locale', /plugin::content-releases\..*/, 'plugin::users-permissions.permission', /plugin::review-workflows\..*/],
            alwaysAddComponentSuffix: false,
            usePrettierIfAvailable: true,
      }
    },
  // ...
}
```

- acceptedNodeEnvs ➡️ An array with all the environments (process.env.NODE_ENV) in which the interfaces will be generated.
- verboseLogs ➡️ Set to true to get additional console logs during the execution of the plugin.
- alwaysAddEnumSuffix ➡️ Set to true will generate all enums with a suffix that is the content type name. For instance: `CarType` in the `Car` content type would become `CarType_Car`.
- alwaysAddComponentSuffix ➡️ Set to true will generate all components with the suffix `Component`. For instance: `Car` component would become `CarComponent`.
- usePrettierIfAvailable ➡️ Set to true will use prettier to format the generated interfaces. If prettier is not available, the interfaces will be generated without formatting.
- contentTypesToIgnore ➡️ An array with all the content types that should be ignored by the plugin. The content types can be the UID of the content type or a regex that matches the UID of the content type.

## Interfaces sources
There are 3 different interface sources: API, Extensions, Component & Common.
- API ➡️ genereted from the schema.json files of collecion and single types.
- Extensions ➡️ genereted from the schema.json files of extensions.
- Component ➡️ genereted from the components.
- Common ➡️ Interfaces for Strapi default data structures.
  - **Media** is the interface for the items on the Media Library of Strapi.
  - **MediaFormat** is the interface for the formats property of the Media interface.
  - **ContentTypes** is the interface for the content types of Strapi.
  - **Components** is the interface for the components of Strapi.
  - **ContentType** is the interface for a content type, pass the content type name as a generic to get the interface of that content type.
  - **APIResponseMany** is the interface for the response of a request to the API to get many items of a content type.
  - **APIResponseSingle** is the interface for the response of a request to the API to get one item of a content type.
  - **APIRequestParams** is the interface for the params of a request to the API.

## Enums
Strapi enumeration attributes will be generated as typescript enums. However there are some considerations regarding enum names:
- If the alwaysAddEnumSuffix is set to true, the enum will be generated as explained in the config description.
- Same would happen if the enum name collides with any interface name generated from that schema.
- Typescript enum options only allow letters and numbers in their name, so any other character would be eliminated, and vowels would be stripped off their accents.
- There are many versions of Strapi that allows to have enum attributes in components with numeric values. As the values get converted to typescript enum options, a numeric one would nor be valid. To avoid that error, any time an enum option is numeric, it'll have an underscore as a prefix. 

Here's an example of the last two points:
```ts
export enum Year {
  Starting2012 = 'Starting-2012',
  _2013 = '2013',
  Ending2014 = 'Ending-2014'
}
```

## Interfaces paths
- All interfaces will be generated in the root folder of the Strapi project in the `contentTypes.d.ts` file.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog
Please, review the [changelog](CHANGELOG.md) to know about the differences between published versions of this project.

## Acknowledgements
This project is a fork of the [strapi-plugin-schemas-to-ts
](https://github.com/mancku/strapi-plugin-schemas-to-ts) project. We are grateful for the work done by the original author.
