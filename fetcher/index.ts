import * as Http from "@effect/platform-node/HttpClient";
// import * as NodeClient from "@effect/platform-node/Http/NodeClient"
import { ParseError } from "@effect/schema/ParseResult";
import * as S from "@effect/schema/Schema";
import { Console, Context, Duration, Effect, Layer, LogLevel, Logger, Schedule, pipe } from "effect";

const Todo = S.struct({
    userId: S.number,
    id:  S.number,
    title: S.string,
    completed: S.boolean,
})
type Todo = S.Schema.To<typeof Todo>


const retrySchedule = pipe(
    Schedule.exponential(Duration.millis(10), 2),
    Schedule.either(Schedule.spaced(Duration.seconds(1))),
    Schedule.compose(Schedule.elapsed),
    Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(30))),
)

interface TodosService {
  readonly getTodo: (id: number) => Effect.Effect<never, FetchError | JsonBodyError | ParseError, Todo>
  readonly getTodos: (ids: number[]) => Effect.Effect<never, FetchError | JsonBodyError | ParseError, Todo[]>
}
const TodosService = Context.Tag<TodosService>()

const getTodo = (id: number) => pipe(
    request(`https://jsonplaceholder.typicode.com/todos/${id}`),
    Effect.tap(() => Effect.logDebug(`getTodo ${id} start...`)),
    Effect.tap(() => Effect.sleep(Duration.millis(100))), // simulate waiting
    Effect.flatMap(jsonBody),
    Effect.flatMap(S.parse(Todo)),
    Effect.retry(retrySchedule),
    Effect.tap(() => Effect.logDebug(`getTodo ${id} done!`)),
    Effect.provide(Logger.minimumLogLevel(LogLevel.Debug)),
)

const getTodo1 = (id: number) => Effect.gen(function* (_) {
    const defaultClient = yield* _(Http.client.Client)
    const todoClient = pipe(
        defaultClient,
        Http.client.mapRequest(Http.request.prependUrl("https://jsonplaceholder.typicode.com")),
        Http.client.mapEffect(Http.response.schemaBodyJson(Todo))
    )
    const res = yield* _(Http.request.get(`/todos/${id}`), todoClient)
    return res
})

const getTodos = (ids: number[]) =>
    Effect.all(ids.map((x) => getTodo(x)), { concurrency: 2 })


const TodosServiceLive = Layer.succeed(TodosService, TodosService.of({
    getTodo: getTodo,
    getTodos: getTodos,
}))

const main: Effect.Effect<never, never, void> = pipe(
    // Effect.all({ TodosService }),
    // Effect.flatMap(({ TodosService: srv }) => srv.getTodos([1, 2, 3, 4, 5])),
    getTodo1(1),
    Effect.flatMap((x) => Console.log(`result:`, x)),
    Effect.catchTags({
        // FetchError: (err) => Console.error(err),
        // JsonBodyError: (err) => Console.error(err),
        ParseError: (err) => Console.error(err),
        RequestError: (err) => Console.error(err),
        ResponseError: (err) => Console.error(err),
    }),
    Effect.provide(
        // TodosServiceLive,
        Http.nodeClient.layer
    ),
)

Effect.runFork(main)