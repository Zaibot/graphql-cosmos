import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLSchema,
  GraphQLString,
  getDirectiveValues,
  DirectiveNode,
} from "graphql";
import { SchemaDirectiveVisitor } from "graphql-tools";
import { isSqlOperation } from "../../../sql/op";

export class WhereDirective extends SchemaDirectiveVisitor<{
  op?: string;
  ours?: string;
}> {
  static getDirectiveDeclaration(directiveName: string, schema: GraphQLSchema) {
    const previousDirective = schema.getDirective(directiveName);
    if (previousDirective) {
      return previousDirective;
    }

    return new GraphQLDirective({
      name: directiveName,
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: {
        op: {
          type: GraphQLString,
        },
        ours: {
          type: GraphQLString,
        },
      },
    });
  }

  static getOp(
    directiveName: string,
    schema: GraphQLSchema,
    node: { readonly directives?: readonly DirectiveNode[] | undefined }
  ) {
    const directive = WhereDirective.getDirectiveDeclaration(
      directiveName,
      schema
    );
    const values = getDirectiveValues(directive, node);
    const raw = values?.op as string | undefined;
    return raw?.split(`,`).filter(isSqlOperation);
  }

  static getOurs(
    directiveName: string,
    schema: GraphQLSchema,
    node: { readonly directives?: readonly DirectiveNode[] | undefined }
  ) {
    const directive = WhereDirective.getDirectiveDeclaration(
      directiveName,
      schema
    );
    const values = getDirectiveValues(directive, node);
    const raw = values?.ours as string | undefined;
    return raw;
  }

  get argOp() {
    const raw = this.args.op as string | undefined;
    return raw?.split(`,`).filter(isSqlOperation);
  }

  get argOurs() {
    return this.args.ours as string | undefined;
  }

  visitFieldDefinition() {
    // noop
  }
}
