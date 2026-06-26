"use client"

import Link from "next/link"
import { useState } from "react"

type Interval = "monthly" | "yearly"

const FEATURES_FREE = [
  "10 questions per day",
  "All subjects (IGCSE, A-Level)",
  "Wrong-answer Revision Deck",
  "Basic progress tracking",
]

const FEATURES_PRO = [
  "Unlimited questions",
  "All gamification — XP, levels, streaks, badges",
  "Exam mode (timed sessions)",
  "Leagues & weekly leaderboard",
  "Priority support",
]

const FEATURES_FAMILY = [
  "Everything in Pro",
  "Up to 4 linked student accounts",
  "Parent dashboard (coming soon)",
  "One shared billing",
]

const FAQ = [
  {
    q: "Are these real past-paper questions?",
    a: "No — MCQ MasterLoop uses exam-style originals written by experienced teachers and examiners, mapped precisely to each syllabus. We never reproduce verbatim questions from IBO, CAIE, or College Board papers.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings and you retain access until the end of the current billing period. No questions asked.",
  },
  {
    q: "What is the refund policy?",
    a: "We offer a 14-day money-back guarantee for new Pro or Pro Family subscriptions. Contact support@mcq-masterloop.com.",
  },
  {
    q: "Is there a free trial?",
    a: "The free tier lets you do 10 questions a day indefinitely. No credit card needed.",
  },
  {
    q: "Will there be a mobile app?",
    a: "Yes — iOS and Android apps are in development. Your subscription will carry over automatically.",
  },
]

export function PricingClient({ currentPlan, isSignedIn }: { currentPlan: string; isSignedIn: boolean }) {
  const [interval, setInterval] = useState<Interval>("yearly")
  const [loading, setLoading] = useState<string | null>(null)

  async function subscribe(plan: "PRO" | "PRO_FAMILY") {
    if (!isSignedIn) { window.location.href = `/register?callbackUrl=/pricing`; return }
    setLoading(plan)
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    else setLoading(null)
  }

  async function manageSubscription() {
    setLoading("portal")
    const res = await fetch("/api/billing/portal", { method: "POST" })
    const { url } = await res.json()
    if (url) window.location.href = url
    else setLoading(null)
  }

  const isManaged = currentPlan !== "FREE" && isSignedIn

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Simple pricing.<br />No surprises.
        </h1>
        <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
          Start free. Upgrade when you&apos;re ready to go further.
        </p>
      </div>

      {/* Interval toggle */}
      <div className="mt-8 flex justify-center">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={[
                "relative rounded-lg px-5 py-2 text-sm font-semibold transition",
                interval === i
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
              ].join(" ")}
            >
              {i.charAt(0).toUpperCase() + i.slice(1)}
              {i === "yearly" && (
                <span className="absolute -top-2 -right-3 rounded-full bg-lime-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-900">
                  −33%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Free</p>
          <p className="mt-3 text-4xl font-black text-slate-900 dark:text-slate-100">$0</p>
          <p className="text-sm text-slate-400">forever</p>
          <ul className="mt-6 flex-1 space-y-3">
            {FEATURES_FREE.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="#65a30d" strokeWidth="2.5" className="mt-0.5 h-4 w-4 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {currentPlan === "FREE" && isSignedIn ? (
              <div className="rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-400 dark:border-slate-700">
                Current plan
              </div>
            ) : (
              <Link
                href={isSignedIn ? "/practice" : "/register"}
                className="block rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {isSignedIn ? "Stay on free" : "Get started free"}
              </Link>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border-2 border-lime-500 bg-white p-8 shadow-lg dark:bg-slate-900">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-lime-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-900">
            Most popular
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-lime-600 dark:text-lime-400">Pro</p>
          <div className="mt-3">
            {interval === "yearly" ? (
              <>
                <span className="text-4xl font-black text-slate-900 dark:text-slate-100">$5.49</span>
                <span className="text-slate-400">/mo</span>
                <p className="text-sm text-slate-400">billed $65.99/yr · save $24</p>
              </>
            ) : (
              <>
                <span className="text-4xl font-black text-slate-900 dark:text-slate-100">$9.99</span>
                <span className="text-slate-400">/mo</span>
              </>
            )}
          </div>
          <ul className="mt-6 flex-1 space-y-3">
            {FEATURES_PRO.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="#65a30d" strokeWidth="2.5" className="mt-0.5 h-4 w-4 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {currentPlan === "PRO" && isSignedIn ? (
              <button onClick={manageSubscription} disabled={loading === "portal"}
                className="w-full rounded-xl border-b-4 border-lime-700 bg-lime-500 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60">
                {loading === "portal" ? "Loading…" : "Manage subscription"}
              </button>
            ) : isManaged ? null : (
              <button onClick={() => subscribe("PRO")} disabled={!!loading}
                className="w-full rounded-xl border-b-4 border-lime-700 bg-lime-500 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-60">
                {loading === "PRO" ? "Redirecting…" : isSignedIn ? "Upgrade to Pro" : "Start Pro"}
              </button>
            )}
          </div>
        </div>

        {/* Pro Family */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Pro Family</p>
          <div className="mt-3">
            {interval === "yearly" ? (
              <>
                <span className="text-4xl font-black text-slate-900 dark:text-slate-100">$8.99</span>
                <span className="text-slate-400">/mo</span>
                <p className="text-sm text-slate-400">billed $107.99/yr · save $72</p>
              </>
            ) : (
              <>
                <span className="text-4xl font-black text-slate-900 dark:text-slate-100">$14.99</span>
                <span className="text-slate-400">/mo</span>
              </>
            )}
          </div>
          <ul className="mt-6 flex-1 space-y-3">
            {FEATURES_FAMILY.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="#65a30d" strokeWidth="2.5" className="mt-0.5 h-4 w-4 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {currentPlan === "PRO_FAMILY" && isSignedIn ? (
              <button onClick={manageSubscription} disabled={loading === "portal"}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400">
                {loading === "portal" ? "Loading…" : "Manage subscription"}
              </button>
            ) : isManaged ? null : (
              <button onClick={() => subscribe("PRO_FAMILY")} disabled={!!loading}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400">
                {loading === "PRO_FAMILY" ? "Redirecting…" : "Get Pro Family"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feature comparison */}
      <div className="mt-16">
        <h2 className="mb-6 text-center text-xl font-bold text-slate-800 dark:text-slate-200">Compare plans</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-6 py-4 text-left font-semibold text-slate-500 dark:text-slate-400">Feature</th>
                <th className="px-4 py-4 text-center font-semibold text-slate-500 dark:text-slate-400">Free</th>
                <th className="px-4 py-4 text-center font-bold text-lime-600 dark:text-lime-400">Pro</th>
                <th className="px-4 py-4 text-center font-semibold text-slate-500 dark:text-slate-400">Family</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {[
                ["Questions per day",           "10",    "Unlimited", "Unlimited"],
                ["All subjects",                "✓",     "✓",         "✓"],
                ["Revision Deck",               "✓",     "✓",         "✓"],
                ["XP, levels & streaks",        "—",     "✓",         "✓"],
                ["Badges",                      "—",     "✓",         "✓"],
                ["Leagues",                     "—",     "✓",         "✓"],
                ["Exam mode",                   "—",     "✓",         "✓"],
                ["Student accounts",            "1",     "1",         "Up to 4"],
              ].map(([feature, free, pro, family]) => (
                <tr key={feature}>
                  <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">{feature}</td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{free}</td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-slate-200">{pro}</td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{family}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="mb-6 text-center text-xl font-bold text-slate-800 dark:text-slate-200">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {q}
              </summary>
              <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
