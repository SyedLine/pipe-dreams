export default function App() {
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
      />
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-amber-400/80">
        Hardisty egress monitor
      </p>
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Pipe Dreams</h1>
      <p className="mt-5 max-w-xl text-lg text-zinc-400">
        Where should a WCS barrel at Hardisty go this month, and what is it worth?
      </p>
      <span className="mt-10 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Coming soon
      </span>
      <footer className="absolute bottom-6 text-xs text-zinc-600">
        Public data only. Not investment advice.
      </footer>
    </main>
  )
}
