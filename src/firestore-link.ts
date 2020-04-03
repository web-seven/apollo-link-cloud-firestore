import { ApolloLink, Observable } from "apollo-link";
import {
    getMainDefinition
} from "apollo-utilities";
import { firestore } from "firebase";
import {
    createSourceEventStream,
    execute,
    OperationTypeNode,
    ExecutionResult,
    GraphQLObjectType,
} from "graphql";
import { ExecutionResultDataDefault } from "graphql/execution/execute";
import { createFullSchema } from "./graphql";

export type Constructor = new () => Object;

export interface Definition {
    target: Constructor
    objectType: GraphQLObjectType,
}

export interface Options {
    database: firestore.Firestore
    definitions: Definition[],
}

export function createFirestoreLink({ database, definitions }: Options) {

    return new ApolloLink((operation, forward) => {

        const { query, variables, operationName } = operation;
        const context = { database };
        const rootValue = {};
        const mainDefinition = getMainDefinition(query);
        const schema = createFullSchema(definitions);
        const operationType: OperationTypeNode =
            mainDefinition.kind === "OperationDefinition" ? mainDefinition.operation : "query";
        if (operationType === "subscription") {
            return new Observable((observer) => {
                let stream = createSourceEventStream(
                    schema,
                    query,
                    rootValue,
                    context,
                    variables,
                    operationName,
                ) as Promise<ExecutionResult>

                stream.then((iterator: ExecutionResult<ExecutionResultDataDefault>) => {
                    if (iterator.data) {
                        iterator.data.foreach((data: ExecutionResultDataDefault) => {
                            observer.next({ data });
                        })
                    }

                });
            });
        }
        return new Observable((observer) => {
            const result = execute(
                schema,
                query,
                rootValue,
                context,
                variables,
                operationName,
            );

            if(result instanceof Promise) {
                result
                    .then((data: any) => {
                        observer.next(data);
                        observer.complete();
                    })
                    .catch((err: any) => {
                        if (err.name === "AbortError") { return; }
                        if (err.result && err.result.errors) {
                            observer.next(err.result);
                        }
                        observer.error(err);
                    });
            } else {
                console.debug('Result',result);
                observer.next(result);
                observer.complete();
            }
            
        });
    });
}
