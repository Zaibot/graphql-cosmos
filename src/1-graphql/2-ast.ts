import * as GraphQL from 'graphql'

export namespace Directives {
  export function cosmosDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `cosmos`)
    return !!cosmos
  }

  export function cosmosDatabaseDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `cosmos`)
    const containerArg = cosmos?.arguments?.find((x) => x.name.value === `database`)
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

  export function cosmosPaginationDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `cosmos`)
    const containerArg = cosmos?.arguments?.find((x) => x.name.value === `pagination`)
    const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
    return container
  }

  export function whereOursDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `where`)
    const containerArg = cosmos?.arguments?.find((x) => x.name.value === `ours`)
    const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
    return container
  }

  export function whereOpDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `where`)
    const containerArg = cosmos?.arguments?.find((x) => x.name.value === `op`)
    const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
    return container?.split(` `) ?? []
  }

  export function sortDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `sort`)
    return Boolean(cosmos)
  }

  export function sortOursDirective(directives?: readonly GraphQL.DirectiveNode[]) {
    const cosmos = directives?.find((x) => x.name.value === `sort`)
    const containerArg = cosmos?.arguments?.find((x) => x.name.value === `ours`)
    const container = containerArg?.value.kind === `StringValue` ? containerArg.value.value : undefined
    return container
  }
}
