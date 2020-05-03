import gql from 'graphql-tag';

export const typeDefs = gql`
    directive @cosmos(container: String, field: String) on OBJECT | FIELD_DEFINITION
`;
