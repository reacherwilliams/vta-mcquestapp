import Link from "next/link"

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a1020] px-6 text-white">
      {/* Depth: deep-navy radial base + warm orange glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% -10%, #15294a 0%, #0c1530 45%, #070b16 100%)" }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-168 w-2xl -translate-x-1/2 rounded-full bg-orange-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-orange-600/10 blur-[110px]" />

      <div className="relative z-10 max-w-2xl text-center">
        {/* Wordmark */}
        <div className="mb-8 text-sm font-black tracking-tight">
          <span className="text-white">MCQ</span>{" "}
          <span className="text-orange-500">MasterLoop</span>
        </div>

        {/* Status badge */}
        <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-orange-300 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
          Early build
        </p>

        <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Master past papers.
          <br />
          <span className="text-orange-500">One question</span> at a time.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
          MCQ practice for IGCSE, AS, A2, IB, and AP — built around the questions
          you got wrong, with the gamification you didn&rsquo;t know you needed.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/practice/filter"
            className="rounded-full bg-orange-500 px-7 py-3.5 text-sm font-bold text-[#0a1020] shadow-lg shadow-orange-500/25 transition hover:bg-orange-400 hover:shadow-orange-500/40"
          >
            Start Practice
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link
            href="/practice/demo"
            className="text-sm font-medium text-slate-400 transition hover:text-orange-300"
          >
            Try a demo &rarr;
          </Link>
        </div>
      </div>
    </main>
  )
}
