import { SchemaInfo, SchemaSource } from './types';

export function isOptional(attributeValue): boolean {
  // arrays are never null
  if (attributeValue.relation === 'oneToMany' || attributeValue.repeatable) {
    return false;
  }
  return attributeValue.required !== true;
}

export function getAttributeComponentInfo(
  propertyType: string,
  allSchemas: SchemaInfo[]
): SchemaInfo {
  function isComponentWithoutSuffix(schemaInfo: SchemaInfo): unknown {
    return !schemaInfo.needsComponentSuffix && schemaInfo.pascalName === propertyType;
  }
  function isComponentWithSuffix(schemaInfo: SchemaInfo): unknown {
    return schemaInfo.needsComponentSuffix && schemaInfo.pascalName === `${propertyType}Component`;
  }

  return allSchemas.find(
    (schemaInfo) =>
      schemaInfo.source === SchemaSource.Component &&
      (isComponentWithoutSuffix(schemaInfo) || isComponentWithSuffix(schemaInfo))
  );
}

export function capitalizeFirstLetter(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hasDefaultValue(attributeValue): boolean {
  return attributeValue.default !== undefined;
}
