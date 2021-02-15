import * as GraphQL from 'graphql'
import {
  DirectiveLocation,
  DirectiveNode,
  getDirectiveValues,
  getNamedType,
  getNullableType,
  GraphQLSchema,
  isListType,
  isObjectType,
  isScalarType,
} from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { debugHooks as debugHook } from '../../../debug'
import { withErrorMiddleware } from '../../../error'
import { addFieldArgument, createOrGetPageType } from '../../internal/schema'
import { SortDirective } from '../sort/directive'
import { inputSort } from '../sort/input'
import { WhereDirective } from '../where/directive'
import { inputWhere } from '../where/input'
import {
  resolveManyOurs,
  resolveManyOursWithoutContainer,
  resolveManyTheirs,
  resolveOneOurs,
  resolveOneTheirs,
  resolveRootQuery,
} from './resolvers'

export class CosmosDirective extends SchemaDirectiveVisitor {
  static getDirectiveDeclaration(directiveName: string, schema: GraphQL.GraphQLSchema) {
    const previousDirective = schema.getDirective(directiveName)
    if (previousDirective) {
      return previousDirective
    }

    return new GraphQL.GraphQLDirective({
      name: directiveName,
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: {
        container: {
          type: GraphQL.GraphQLString,
        },
        ours: {
          type: GraphQL.GraphQLString,
        },
        theirs: {
          type: GraphQL.GraphQLString,
        },
      },
    })
  }

  static getContainer(
    directiveName: string,
    schema: GraphQLSchema,
    node: { readonly directives?: readonly DirectiveNode[] | undefined }
  ) {
    const directive = WhereDirective.getDirectiveDeclaration(directiveName, schema)
    const values = getDirectiveValues(directive, node)
    const raw = values?.container as string | undefined
    return raw
  }
  static getOurs(
    directiveName: string,
    schema: GraphQLSchema,
    node: { readonly directives?: readonly DirectiveNode[] | undefined }
  ) {
    const directive = WhereDirective.getDirectiveDeclaration(directiveName, schema)
    const values = getDirectiveValues(directive, node)
    const raw = values?.orus as string | undefined
    return raw
  }
  get argContainer() {
    return this.args.container as string | undefined
  }

  get argOurs() {
    return this.args.ours as string | undefined
  }

  get argTheirs() {
    return this.args.theirs as string | undefined
  }

  visitFieldDefinition(
    fieldType: GraphQL.GraphQLField<any, any>,
    details: {
      objectType: GraphQL.GraphQLObjectType | GraphQL.GraphQLInterfaceType
    }
  ): GraphQL.GraphQLField<any, any> | void | null {
    if (!GraphQL.isObjectType(details.objectType)) {
      throw Error(`must be an ObjectType: ${details.objectType.name}`)
    }

    const directiveNameWhere = `where`
    const directiveNameSort = `sort`

    const ours = this.argOurs
    const theirs = this.argTheirs
    const theirContainer = this.argContainer

    const returnType = fieldType.type
    const returnTypeCore = getNamedType(returnType)
    const returnTypeMany = isListType(getNullableType(returnType)) ? returnType : undefined

    if (theirContainer) {
      if (isObjectType(returnTypeCore)) {
        const filterableScalar = Object.entries(returnTypeCore.getFields())
          .map(([name, field]) => ({
            name,
            field,
            scalar: getNullableType(field.type) as GraphQL.GraphQLScalarType,
            fieldIsArray: Boolean(isListType(field.type)),
          }))
          .filter(
            ({ field }) => isScalarType(getNullableType(field.type)) || GraphQL.isEnumType(getNullableType(field.type))
          )
          .map(({ field, name, scalar, fieldIsArray }) => ({
            name,
            scalar,
            fieldIsArray,
            operations: WhereDirective.getOp(directiveNameWhere, this.schema, field.astNode!) ?? [],
          }))
          .filter((x) => x.operations.length > 0)
        if (filterableScalar.length > 0) {
          const filterType = inputWhere(returnTypeCore.name, filterableScalar, this.schema)
          addFieldArgument(fieldType, `where`, filterType)
        }

        const sortableScalar = Object.entries(returnTypeCore.getFields())
          .map(([name, field]) => ({ name, field, scalar: getNullableType(returnType) as GraphQL.GraphQLScalarType }))
          .filter(
            ({ field }) => isScalarType(getNullableType(field.type)) || GraphQL.isEnumType(getNullableType(field.type))
          )
          .filter(({ field }) => SortDirective.has(directiveNameSort, field.astNode ?? {}))
        if (sortableScalar.length > 0) {
          const sortType = inputSort(returnTypeCore.name, sortableScalar, this.schema)
          addFieldArgument(fieldType, `sort`, sortType)
        }

        //
        // Override resolvers per relation type
        if (returnTypeMany && theirs) {
          debugHook?.onResolverSet?.({
            resolver: `resolveManyTheirs`,
            objectType: details.objectType,
            fieldType,
          })
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = withErrorMiddleware(
            `resolveManyTheirs`,
            resolveManyTheirs(theirContainer, ours, theirs, fieldType)
          )
        } else if (returnTypeMany && ours) {
          debugHook?.onResolverSet?.({
            resolver: `resolveManyOurs`,
            objectType: details.objectType,
            fieldType,
          })
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = withErrorMiddleware(
            `resolveManyOurs`,
            resolveManyOurs(theirContainer, ours, theirs, fieldType)
          )
        } else if (returnTypeMany) {
          debugHook?.onResolverSet?.({
            resolver: `resolveRootQuery`,
            objectType: details.objectType,
            fieldType,
          })
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = withErrorMiddleware(`resolveRootQuery`, resolveRootQuery(theirContainer, fieldType))
        } else if (ours) {
          debugHook?.onResolverSet?.({
            resolver: `resolveOneOurs`,
            objectType: details.objectType,
            fieldType,
          })
          fieldType.resolve = withErrorMiddleware(`resolveOneOurs`, resolveOneOurs(ours, fieldType))
        } else if (theirs) {
          debugHook?.onResolverSet?.({
            resolver: `resolveOneTheirs`,
            objectType: details.objectType,
            fieldType,
          })
          fieldType.resolve = withErrorMiddleware(`resolveOneTheirs`, resolveOneTheirs(theirContainer, ours, fieldType))
        }
      }
    } else if (ours) {
      if (returnTypeMany) {
        // No container, ours specifies id field to be created as reference
        debugHook?.onResolverSet?.({
          resolver: `resolveManyOursWithoutContainer`,
          objectType: details.objectType,
          fieldType,
        })
        fieldType.resolve = withErrorMiddleware(
          `resolveManyOursWithoutContainer`,
          resolveManyOursWithoutContainer(ours, fieldType)
        )
      } else {
        // No container, ours specifies id field to be created as reference
        debugHook?.onResolverSet?.({
          resolver: `resolveOneOurs`,
          objectType: details.objectType,
          fieldType,
        })
        fieldType.resolve = withErrorMiddleware(`resolveOneOurs`, resolveOneOurs(ours, fieldType))
      }
    }

    return fieldType
  }
}

const wrapOutputWithPagination = (type: GraphQL.GraphQLOutputType, schema: GraphQL.GraphQLSchema) => {
  return createOrGetPageType(
    `${getNamedType(type).name}Page`,
    {
      nextCursor: { type: GraphQL.GraphQLString },
      total: { type: new GraphQL.GraphQLNonNull(GraphQL.GraphQLInt) },
      page: { type },
    },
    schema
  )
}
