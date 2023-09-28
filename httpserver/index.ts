import * as Effect from "@effect/io/Effect"
import * as Http from "@effect/platform-node/HttpServer"
import { runMain } from "@effect/platform-node/Runtime"
import { pipe } from "effect"
import { createServer } from "node:http"

const ServerLive = Http.server.layer(() => createServer(), { port: 3000 })

const handler = Http.server.serve(Effect.succeed(Http.response.text("Hello learn effect-ts")))

const main: Effect.Effect<never, never, void> = pipe(
    handler,
    Effect.scoped,
    Effect.provide(ServerLive),
    Effect.catchAll(Effect.logError),
)

runMain(main)