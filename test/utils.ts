import { DocumentNode, execute, parse, validate, validateSchema } from 'graphql'
import { IResolvers, mergeSchemas, printSchemaWithDirectives } from 'graphql-tools'
import { defaultDataLoader } from '../src/2-dataloader/default'
import { CosmosDefaultCompiler } from '../src/4-resolver-builder/4-default-compiler'
import { GraphQLCosmosConceptContext } from '../src/6-datasource/1-context'
import { GraphQLCosmosDataSource } from '../src/6-datasource/2-datasource'
import { combineDataSourcePlugins } from '../src/6-datasource/3-plugin'
import { CosmosHandler } from '../src/6-datasource/5-cosmos'
import { traceErrorMiddleware } from '../src/error'
import { fail } from '../src/typescript'

export interface MockData {
  [container: string]: {
    [query: string]: Array<unknown>
  }
}

export function createUnitTestContext(typedefs: DocumentNode, mockData: MockData, customResolvers: IResolvers = {}) {
  const compiler = CosmosDefaultCompiler.fromTypeDefs(typedefs)
  const schema = mergeSchemas({ schemas: [compiler.schema], resolvers: customResolvers })
  const resolvers = compiler.resolvers
  const metaSchema = compiler.metaSchema

  expect(validateSchema(schema)).toHaveLength(0)

  const query: CosmosHandler = async (_context, _database, container, sql, _cursor, _limit) => {
    const asd = _cursor ? ` @${_cursor}` : ``
    const params = sql.parameters.length ? ` (${sql.parameters.map((x) => `${x.name}=${x.value}`).toString()})` : ``
    const key = `${sql.query}${asd}${params}`

    const response = mockData[container]?.[key]?.slice()
    if (!response) {
      console.info(`Add following key: ${container} ${key}`)
      fail(`${container} ${key}`)
    }

    const continuationToken = Object(response[0]).continuationToken ?? null
    if (continuationToken) {
      response.shift()
    }

    return { continuationToken: continuationToken, resources: response } as any
  }

  const context: GraphQLCosmosConceptContext = {
    dataSources: {
      graphqlCosmos: new GraphQLCosmosDataSource(
        metaSchema,
        defaultDataLoader(),
        query,
        combineDataSourcePlugins([]),
        traceErrorMiddleware
      ),
    },
  }

  context.dataSources.graphqlCosmos.initialize({
    context,
  })

  const execute2 = async (query: string, logErrors: boolean = true) => {
    const doc = parse(query)
    expect(validate(schema, doc)).toHaveLength(0)
    const result = await execute(schema, doc, undefined, context)

    if (logErrors) {
      for (const err of result.errors ?? []) {
        console.error(err.path.join(`/`), err.originalError)
      }
    }

    return result
  }

  const printSchemaAndResolvers = () => {
    console.log(printSchemaWithDirectives(schema))
    console.log(resolvers)
  }

  return { execute: execute2, resolvers, context, metaSchema, schema, print: printSchemaAndResolvers }
}
