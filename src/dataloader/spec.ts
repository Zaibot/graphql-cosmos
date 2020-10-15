import { SqlOpScalar } from '../sql/op'

export interface DataLoaderSpec {
  database: string
  container: string
  id: SqlOpScalar[]
  columns: string[]
}
