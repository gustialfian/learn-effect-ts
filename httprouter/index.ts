import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Http from "@effect/platform-node/HttpServer"
import { runMain } from "@effect/platform-node/Runtime"
import * as Schema from "@effect/schema/Schema"
import { createServer } from "node:http"


// domain
const Todo = Schema.struct({
    id: Schema.number,
    title: Schema.string
})
const Todos = Schema.array(Todo)
const IdParams = Schema.struct({
    id: Schema.NumberFromString
})
const todoResponse = Http.response.schemaJson(Todo)
const todosResponse = Http.response.schemaJson(Todos)

// handler
const todoAll = Effect.gen(function* (_) {
    return yield* _(todosResponse([
        { id: 0, title: 'foo-0' },
        { id: 1, title: 'foo-1' },
        { id: 3, title: 'foo-3' },
    ]))
})

const todoById = Effect.gen(function* (_) {
    const params = yield* _(Http.router.schemaParams(IdParams))
    return yield* _(todoResponse({ id: params.id, title: 'foo-0' }))
})

const todoCreate = Effect.gen(function* (_) {
    const body = yield* _(Http.request.schemaBodyJson(Todo))
    return yield* _(todoResponse(body))
})

const todoUpdate = Effect.gen(function* (_) {
    const params = yield* _(Http.router.schemaParams(IdParams))
    const body = yield* _(Http.request.schemaBodyJson(Todo))
    return yield* _(todoResponse({ ...body, id: params.id }))
})

const todoDelete = Effect.gen(function* (_) {
    const params = yield* _(Http.router.schemaParams(IdParams))
    return yield* _(todoResponse({ id: params.id, title: 'deleted' }))
})

// routing
const todoRoute = Http.router.empty.pipe(
    Http.router.get("/", todoAll),
    Http.router.get("/:id", todoById),
    Http.router.post("/", todoCreate),
    Http.router.put("/:id", todoUpdate),
    Http.router.del("/:id", todoDelete),
    Http.router.catchAll(() => Effect.succeed(Http.response.empty({ status: 400 }))),
)

const serve = Http.router.empty.pipe(
    Http.router.mount("/todo", todoRoute),
    Http.server.serve(Http.middleware.logger),
    Effect.catchTag("ServeError", (err) => Effect.logError(err)),
)

// setup dependecy
const ServerLive = Http.server.layer(() => createServer(), { port: 3000 })

const HttpLive = Layer.scopedDiscard(serve).pipe(Layer.use(ServerLive))

runMain(Layer.launch(HttpLive))
    