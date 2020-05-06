import gql from 'graphql-tag';

export const schema = {
    typeDefs: gql`
        directive @cosmos(container: String, field: String) on OBJECT | FIELD_DEFINITION
    `,
};
