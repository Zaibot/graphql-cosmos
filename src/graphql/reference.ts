import { SqlOpScalar } from "../sql/op";

export const getCosmosReferenceContainer = (obj: any): string => {
  return obj && obj.__cosmos_container ? obj.__cosmos_container : null;
};

export const ToCosmosReference = <TypeName extends string>(
  typename: TypeName,
  container: string
) => <ID extends SqlOpScalar>(id: ID) =>
  toCosmosReference(typename, container, id);
export const toCosmosReference = <
  TypeName extends string,
  ID extends SqlOpScalar
>(
  typename: TypeName,
  container: string,
  id: ID | null | undefined
) =>
  notNullOrUndefined(id)
    ? {
        __typename: typename,
        __cosmos_container: container,
        /*[DEFAULT_ID]:*/ id,
      }
    : null;

const notNullOrUndefined = <T>(a: T | null | undefined): a is T =>
  a !== null && a !== undefined;
