import { Console, Context, Effect, Layer } from "effect";

interface NameService {
    getName: Effect.Effect<never, never, string>
}
const NameService = Context.Tag<NameService>()

const NameServiceLive = Layer.succeed(NameService, NameService.of({
    getName: Effect.succeed('alfian')
}))

const program = Effect.gen(function* (_) {
    const service = yield* _(NameService)
    const name = yield* _(service.getName)
    yield* _(Console.log(`Hello ${name}!`))    
})

const main: Effect.Effect<never, never, void> = Effect.provide(program, NameServiceLive)

Effect.runFork(main)