import * as GraphQL from 'graphql'

export function cosmosContainerByResolveInfo(info: GraphQL.GraphQLResolveInfo) {
  const parentFields = info.parentType.getFields()
  const cosmos = parentFields[info.fieldName].astNode?.directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `container`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}

export function cosmosOursByResolveInfo(info: GraphQL.GraphQLResolveInfo) {
  const parentFields = info.parentType.getFields()
  const cosmos = parentFields[info.fieldName].astNode?.directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `ours`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}

export function cosmosTheirsByResolveInfo(info: GraphQL.GraphQLResolveInfo) {
  const parentFields = info.parentType.getFields()
  const cosmos = parentFields[info.fieldName].astNode?.directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `theirs`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}

export function cosmosContainerDirective(directives?: readonly GraphQL.DirectiveNode[]) {
  const cosmos = directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `container`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}

export function cosmosOursDirective(directives?: readonly GraphQL.DirectiveNode[]) {
  const cosmos = directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `ours`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}

export function cosmosTheirsDirective(directives?: readonly GraphQL.DirectiveNode[]) {
  const cosmos = directives?.find((x) => x.name.value === `cosmos`)
  const containerArg = cosmos?.arguments?.find((x) => x.name.value === `theirs`)
  const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
  return container
}
