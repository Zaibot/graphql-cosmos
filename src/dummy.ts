import { makeExecutableSchema } from '@graphql-tools/schema'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { execute, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { performance } from 'perf_hooks'
import YAML from 'yaml'
import { CosmosTypeDefsCompiler } from './4-resolver-builder/4-typedefs-compiler'
import { GraphQLCosmosConceptContext } from './6-datasource/1-context'
import { GraphQLCosmosDataSource } from './6-datasource/2-datasource'
import { combineDataSourcePlugins } from './6-datasource/3-plugin'
import { traceErrorMiddleware } from './error'

setTimeout(() => {}, 60000 * 1000)
console.log(`\n`.repeat(5))

async function main() {
  console.log(`=`.repeat(100))
  console.log(`=`.repeat(100))
  console.log(`=`.repeat(100))
  console.log(`New session`)

  const typedefs = gql`
    type Query {
      contacts: [Group] @cosmos
      groups: [Group] @cosmos(container: "Groups")
      dummies: [Dummy] @cosmos(container: "Dummies")
    }

    type Contact @cosmos(database: "Dummy", container: "Contacts") {
      id: ID @where(op: "eq")
      name: String
    }

    type Group @cosmos(database: "Dummy", container: "Groups") {
      id: ID @where(op: "eq in")
      prop: String @where(op: "eq")
      dummies: Dummy @cosmos(theirs: "groupId")
    }

    type Dummy @cosmos(database: "Dummy", container: "Dummies") {
      id: ID
      prop: String
      embedded: [Embedded]
      related: Related @cosmos(ours: "relatedId")
    }

    type Embedded {
      prop: String
      related: Related @cosmos(ours: "relatedId")
    }

    type Related @cosmos(container: "related") {
      id: ID
      prop: String
      related: Related @cosmos(ours: "relatedId")
    }
  `

  const aa = performance.now()
  const compiler = CosmosTypeDefsCompiler.fromTypeDefs(typedefs)
  const schema = makeExecutableSchema(compiler)
  const bb = performance.now()
  console.log(`${(bb - aa).toFixed(2)}ms init`)

  console.log(`-`.repeat(100))
  console.log(`printSchemaWithDirectives:\n`, printSchemaWithDirectives(schema))

  console.log(`-`.repeat(100))
  console.log(`validateSchema:\n`, validateSchema(schema))

  const context: GraphQLCosmosConceptContext<unknown> = initContext()

  const query = parse(
    `query { groups(where: { or: [{ id_eq: "1"}] }) { page { id prop dummies { page { id prop } } } } }`
  )

  console.log(`-`.repeat(100))
  console.log(`validate:\n`, YAML.stringify(validate(schema, query)))

  const result = await execute({
    contextValue: context,
    schema: schema,
    document: query,
  })

  console.log(`-`.repeat(100))
  console.log(`resolvers:\n`, compiler.resolvers)

  console.log(`-`.repeat(100))
  console.log(`result:\n`, YAML.stringify(result))

  console.log(`-`.repeat(100))
  console.error(`errors:`)
  for (const err of result.errors ?? []) {
    console.error(`error: `, err.originalError ?? err)
  }

  console.log(`-`.repeat(100))
  for (let i = 0; i < 10; i++) {
    const a = performance.now()
    const contextAA = initContext(false)
    const compiler = CosmosTypeDefsCompiler.fromTypeDefs(typedefs)
    const schema = makeExecutableSchema(compiler)
    await execute({
      contextValue: contextAA,
      schema: schema,
      document: query,
    })
    const b = performance.now()
    console.log(`${(b - a).toFixed(2)}ms init execute`)
  }

  console.log(`-`.repeat(100))
  for (let i = 0; i < 10; i++) {
    const contextAA = initContext(false)
    const compiler = CosmosTypeDefsCompiler.fromTypeDefs(typedefs)
    const schema = makeExecutableSchema(compiler)
    const a = performance.now()
    await execute({
      contextValue: contextAA,
      schema: schema,
      document: query,
    })
    const b = performance.now()
    console.log(`${(b - a).toFixed(2)}ms execute`)
  }

  function initContext(log: boolean = true) {
    const context: GraphQLCosmosConceptContext<unknown> = {
      dataSources: {
        graphqlCosmos: new GraphQLCosmosDataSource(
          compiler.metaSchema,
          (spec) => {
            if (log) {
              setTimeout(() => {
                const columns = spec.columns
                const container = spec.container
                const id = spec.id
                console.log(`-`.repeat(100))
                console.log(`dataloader:`, JSON.stringify({ columns, container, id }))
              })
            }
            return spec.id.map((id) => ({ id, prop: `Test` }))
          },
          (_context, database, container, sql, cursor) => {
            if (log) {
              setTimeout(() => {
                console.log(`-`.repeat(100))
                console.log(`cosmos handler:`, JSON.stringify({ database, container, sql, cursor }))
              })
            }
            if (sql.query === `SELECT c.id FROM c WHERE c.id = @p2 ORDER BY c.id`) {
              return { continuation: ``, continuationToken: ``, resources: [{ id: `1` }] } as any
            } else {
              return { continuation: ``, continuationToken: ``, resources: [] } as any
            }
          },
          combineDataSourcePlugins([]),
          traceErrorMiddleware
        ),
      },
    }

    context.dataSources.graphqlCosmos.initialize({ context })

    return context
  }
}

main()
