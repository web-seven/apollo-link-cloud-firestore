import { ApolloLink, Observable } from "apollo-link";
import {
    getMainDefinition,
    hasDirectives,
} from "apollo-utilities";
import { firestore } from "firebase";
import {
    createSourceEventStream,
    DocumentNode,
    execute,
    OperationTypeNode,
    ExecutionResult,
} from "graphql";
import { createFullSchema } from "./graphql";
import { ExecutionResultDataDefault } from "graphql/execution/execute";

export interface Options {
    database: firestore.Firestore;
    partialSchema: DocumentNode;
}

export function createFirestoreLink({ database, partialSchema }: Options) {

    const schema = createFullSchema(partialSchema);

    return new ApolloLink((operation, forward) => {

        const { query, variables, operationName } = operation;
        const context = { database };
        const rootValue = {};
        const mainDefinition = getMainDefinition(query);
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
            ) as Promise<ExecutionResult>;

            result.then((data: any) => {
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
        });
    });
}
