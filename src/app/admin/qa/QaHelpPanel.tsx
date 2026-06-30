"use client"

// Slide-over help for the QA Testing area — explains the gate, the sandboxed
// test-play, and the originality cross-check. Matches the Question Bank HelpPanel.

const FLOW = [
  { n: "1", title: "Questions arrive after curriculum approval", body: "When a curriculum reviewer approves a question it moves to QA Testing — it is NOT live to students yet. It waits here until an admin passes it." },
  { n: "2", title: "Test-play it like a student", body: "Tap Test → and answer the question exactly as a student would. This is a sandbox: it records nothing — no XP, no streak, no progress. The confidence tap is hidden and the answer reveals as soon as you submit, with the correct option in green." },
  { n: "3", title: "Pass QA, or send it back", body: "If it's good, Pass QA → it goes live (Published). If something's wrong, Send back → it returns to the author as a Draft with your note explaining the fix." },
  { n: "4", title: "Spot-check live questions too", body: "Switch the filter to Published to test questions already live. If you find a broken one, Archive pulls it from students immediately." },
]

const ACTIONS = [
  { label: "Pass QA", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", desc: "IN QA → Published. Makes it visible to students." },
  { label: "Send back", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400", desc: "IN QA → Draft, with a required note for the author." },
  { label: "Archive", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400", desc: "Published → Archived. Pulls a bad live question from students." },
  { label: "Skip / ← Queue", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", desc: "Move to the next question, or exit back to the queue. No decision recorded." },
]

const SIM_BANDS = [
  { band: "🟢 < 70%", color: "text-emerald-700 dark:text-emerald-400", desc: "Looks original — comfortably different from any real past-paper question." },
  { band: "🟡 70–84%", color: "text-amber-700 dark:text-amber-400", desc: "Review — close enough to a real question that you should compare and decide." },
  { band: "🔴 ≥ 85%", color: "text-rose-700 dark:text-rose-400", desc: "Likely too close to a real question — probably needs rewriting or sending back." },
]

export function QaHelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">QA Testing Help</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">How the QA gate, test-play, and originality check work</p>
          </div>
          <button onClick={onClose} aria-label="Close help" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto p-5">
          {/* The gate */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">The QA gate</h3>
            <div className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] font-medium text-cyan-800 dark:border-cyan-800/40 dark:bg-cyan-950/20 dark:text-cyan-300">
              Draft → Subject Review → Curriculum Review → <strong>QA Testing</strong> → Published. Approval no longer publishes instantly — every question is tested here first.
            </div>
            <ol className="space-y-3">
              {FLOW.map(({ n, title, body }) => (
                <li key={n} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-500 text-xs font-black text-white">{n}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Actions */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Actions</h3>
            <div className="space-y-2">
              {ACTIONS.map(({ label, color, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Originality */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Originality cross-check</h3>
            <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              In a test-play, <strong className="text-slate-700 dark:text-slate-300">Check originality</strong> compares the question against the Original Question Bank (real past papers) using on-device similarity — it shows the closest match and a % score:
            </p>
            <div className="space-y-2">
              {SIM_BANDS.map(({ band, color, desc }) => (
                <div key={band} className="flex items-start gap-3">
                  <span className={`w-20 shrink-0 text-xs font-bold ${color}`}>{band}</span>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
              Reviewers see only the <strong>score + citation</strong>. Only a <strong>Super Admin</strong> can <strong>reveal match</strong> to read the actual original — and every reveal is logged.
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
