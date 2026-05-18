import Link from "next/link"

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 px-6 text-white">
      <div className="max-w-2xl text-center">
        <p className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur">
          MCQuest — early build
        </p>
        <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
          Master past papers.
          <br />
          One question at a time.
        </h1>
        <p className="mt-6 text-lg text-white/85">
          MCQ practice for IGCSE, AS, A2, IB, and AP — built around the
          questions you got wrong, with the gamification you didn&rsquo;t know
          you needed.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-purple-700 transition hover:scale-105"
          >
            Sign in
          </Link>
          <Link
            href="/practice"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Try a demo
          </Link>
        </div>
      </div>
    </main>
  )
}
