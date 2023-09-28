import * as Http from "@effect/platform-node/HttpClient";
import { ParseError } from "@effect/schema/ParseResult";
import * as S from "@effect/schema/Schema";
import { Console, Context, Duration, Effect, Layer, LogLevel, Logger, Schedule, pipe } from "effect";

// domain
const Todo = S.struct({
    userId: S.number,
    id: S.number,
    title: S.string,
    completed: S.boolean,
})
type Todo = S.Schema.To<typeof Todo>

const getTodo = (id: number) => Effect.gen(function* (_) {
    yield* _(Effect.logDebug(`getTodo start: ${id}`))
    const client = Http.client.fetch()
    const req = Http.request.get(`https://jsonplaceholder.typicode.com/todos/${id}`)

    const res = yield* _(client(req), Effect.retry(policy))
    const result = yield* _(Http.response.schemaBodyJson(Todo)(res))

    yield* _(Effect.logDebug(`getTodo done: ${id}`))
    return result
}).pipe(Logger.withMinimumLogLevel(LogLevel.Debug))

const getTodos = (ids: number[]) => Effect.all(ids.map((x) => getTodo(x)), { concurrency: 2 })


// retry policy
const policy = pipe(
    Schedule.exponential(Duration.millis(10), 2),
    Schedule.either(Schedule.spaced(Duration.seconds(1))),
    Schedule.compose(Schedule.elapsed),
    Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(20))),
)


// service
interface TodosService {
    readonly getTodo: (id: number) => Effect.Effect<never, ParseError | Http.error.HttpClientError, Todo>
    readonly getTodos: (ids: number[]) => Effect.Effect<never, ParseError | Http.error.HttpClientError, Todo[]>
}
const TodosService = Context.Tag<TodosService>()

const TodosServiceLive = Layer.succeed(TodosService, TodosService.of({
    getTodo: getTodo,
    getTodos: getTodos,
}))


// main function
const main: Effect.Effect<never, never, void> = pipe(
    Effect.all({ TodosService }),
    Effect.flatMap(({ TodosService: srv }) => srv.getTodos([1, 2, 3, 4, 5])),
    Effect.flatMap((x) => Console.log(`result:`, x.map(v => `${v.id} ${v.title}`))),
    Effect.catchTags({
        ParseError: (err) => Console.error(err),
        RequestError: (err) => Console.error(err),
        ResponseError: (err) => Console.error(err),
    }),
    Effect.provide(TodosServiceLive),
)

Effect.runFork(main)