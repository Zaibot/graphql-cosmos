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
import { DEFAULT } from '../../../constants'
import { addFieldArgument, createOrGetPageType } from '../../internal/schema'
import { resolveCosmosSource } from '../../resolver/resolveWithCosmosSource'
import { SortDirective } from '../sort/directive'
import { inputSort } from '../sort/input'
import { WhereDirective } from '../where/directive'
import { inputWhere } from '../where/input'
import {
  resolveManyOurs,
  resolveManyTheirs,
  resolveOneOurs,
  resolveOneOursWithoutContainer,
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
    _details: {
      objectType: GraphQL.GraphQLObjectType | GraphQL.GraphQLInterfaceType
    }
  ): GraphQL.GraphQLField<any, any> | void | null {
    const directiveNameCosmos = `cosmos`
    const directiveNameWhere = `where`
    const directiveNameSort = `sort`

    const ours = this.argOurs
    const theirs = this.argTheirs
    const theirContainer = this.argContainer

    //
    // Snapshot of which type.field is stored in a Cosmos container
    const typeFieldToContainerValues = Object.values(this.schema.getTypeMap())
      .filter((x): x is GraphQL.GraphQLObjectType => isObjectType(x))
      .map((owner): [string, Array<[string, string]>] => [
        owner.name,
        Object.values(owner.getFields())
          .map((ownerField) => [
            ownerField.name,
            CosmosDirective.getContainer(directiveNameCosmos, this.schema, ownerField.astNode ?? {}),
          ])
          .filter((x): x is [string, string] => !!x[0] && !!x[1]),
      ])
    const typeFieldToContainer = new Map(typeFieldToContainerValues.map(([name, f]) => [name, new Map(f)]))

    if (theirContainer) {
      const returnType = fieldType.type
      const returnTypeCore = getNamedType(returnType)
      const returnTypeMany = isListType(getNullableType(returnType)) ? returnType : undefined
      if (isObjectType(returnTypeCore)) {
        const filterableScalar = Object.entries(returnTypeCore.getFields())
          .map(([name, field]) => ({ name, field, scalar: getNullableType(field.type) as GraphQL.GraphQLScalarType }))
          .filter(
            ({ field }) => isScalarType(getNullableType(field.type)) || GraphQL.isEnumType(getNullableType(field.type))
          )
          .map(({ field, name, scalar }) => ({
            name,
            scalar,
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
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = resolveManyTheirs(theirContainer, ours, theirs, fieldType)
        } else if (returnTypeMany && ours) {
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = resolveManyOurs(typeFieldToContainer, theirContainer, ours, theirs, fieldType)
        } else if (returnTypeMany) {
          addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString)
          fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema))
          fieldType.resolve = resolveRootQuery(theirContainer, fieldType)
        } else if (ours) {
          fieldType.resolve = resolveOneOurs(typeFieldToContainer, ours, theirContainer, fieldType)
        } else if (theirs) {
          fieldType.resolve = resolveOneTheirs(theirContainer, ours, fieldType)
        }

        //
        // Fields should be resolved when unavailable in source of a request
        if (returnTypeCore) {
          // Overriding without knowing the context: here container is embedded in the resolver - maybe container can be a property of a reference?
          for (const [fieldName, field] of Object.entries(returnTypeCore.getFields())) {
            if (fieldName === DEFAULT.ID) {
              field.resolve ??= GraphQL.defaultFieldResolver
            } else {
              const ours = CosmosDirective.getOurs(`cosmos`, this.schema, field.astNode ?? {})
              const nextResolver = field.resolve ?? GraphQL.defaultFieldResolver
              field.resolve ??= async (s, a, c, i) => {
                const sourced = await resolveCosmosSource(theirContainer, DEFAULT.ID, ours ?? field.name, s, c)
                const result = await nextResolver(sourced, a, c, i)
                return result
              }
            }
          }
        }
      }
    } else if (ours) {
      // No container, ours specifies id field to be created as reference
      fieldType.resolve = resolveOneOursWithoutContainer(ours, fieldType)
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
