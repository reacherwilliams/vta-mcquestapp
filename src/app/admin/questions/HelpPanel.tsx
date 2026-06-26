"use client"

import { useState } from "react"
import katex from "katex"

// ── Inline KaTeX renderer (client-safe) ───────────────────────────────────────

function Math({ latex, display = false }: { latex: string; display?: boolean }) {
  let html = ""
  try {
    html = katex.renderToString(latex, { displayMode: display, throwOnError: false, output: "html" })
  } catch {
    html = `<code>${latex}</code>`
  }
  return (
    <span
      className={display ? "block my-1 text-center" : "inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── LaTeX reference data ──────────────────────────────────────────────────────

const LATEX_SECTIONS = [
  {
    title: "Fractions & Powers",
    examples: [
      { label: "Fraction",         code: "\\frac{a}{b}",       display: false },
      { label: "Power / exponent", code: "x^{2}",              display: false },
      { label: "Subscript",        code: "x_{n}",              display: false },
      { label: "Square root",      code: "\\sqrt{x}",          display: false },
      { label: "nth root",         code: "\\sqrt[3]{8}",       display: false },
      { label: "Combined example", code: "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", display: true },
    ],
  },
  {
    title: "Operators & Relations",
    examples: [
      { label: "Times (×)",             code: "a \\times b",    display: false },
      { label: "Division (÷)",          code: "a \\div b",      display: false },
      { label: "Dot product (·)",       code: "a \\cdot b",     display: false },
      { label: "Plus or minus (±)",     code: "\\pm",           display: false },
      { label: "Less/equal (≤)",        code: "\\leq",          display: false },
      { label: "Greater/equal (≥)",     code: "\\geq",          display: false },
      { label: "Not equal (≠)",         code: "\\neq",          display: false },
      { label: "Approximately (≈)",     code: "\\approx",       display: false },
      { label: "Proportional to (∝)",   code: "\\propto",       display: false },
      { label: "Infinity (∞)",          code: "\\infty",        display: false },
    ],
  },
  {
    title: "Greek Letters",
    examples: [
      { label: "Alpha (α)",    code: "\\alpha",   display: false },
      { label: "Beta (β)",     code: "\\beta",    display: false },
      { label: "Gamma (γ/Γ)", code: "\\gamma,\\ \\Gamma", display: false },
      { label: "Delta (δ/Δ)", code: "\\delta,\\ \\Delta", display: false },
      { label: "Epsilon (ε)",  code: "\\epsilon", display: false },
      { label: "Theta (θ)",    code: "\\theta",   display: false },
      { label: "Lambda (λ)",   code: "\\lambda",  display: false },
      { label: "Mu (μ)",       code: "\\mu",      display: false },
      { label: "Pi (π)",       code: "\\pi",      display: false },
      { label: "Sigma (σ/Σ)", code: "\\sigma,\\ \\Sigma", display: false },
      { label: "Omega (ω/Ω)", code: "\\omega,\\ \\Omega", display: false },
      { label: "Phi (φ)",      code: "\\phi",     display: false },
    ],
  },
  {
    title: "Calculus",
    examples: [
      { label: "Derivative",          code: "\\frac{dy}{dx}",           display: false },
      { label: "Second derivative",   code: "\\frac{d^2y}{dx^2}",       display: false },
      { label: "Partial derivative",  code: "\\frac{\\partial f}{\\partial x}", display: false },
      { label: "Indefinite integral", code: "\\int f(x)\\,dx",          display: true  },
      { label: "Definite integral",   code: "\\int_0^\\infty e^{-x}\\,dx", display: true },
      { label: "Limit",               code: "\\lim_{x \\to 0} \\frac{\\sin x}{x}", display: true },
      { label: "Sum",                 code: "\\sum_{i=1}^{n} i^2",      display: true  },
      { label: "Product",             code: "\\prod_{i=1}^{n} i",       display: true  },
    ],
  },
  {
    title: "Physics",
    examples: [
      { label: "Vector arrow",      code: "\\vec{F}",               display: false },
      { label: "Unit vector (hat)", code: "\\hat{n}",               display: false },
      { label: "Magnitude",         code: "|\\vec{v}|",             display: false },
      { label: "Dot product",       code: "\\vec{A} \\cdot \\vec{B}", display: false },
      { label: "Cross product",     code: "\\vec{A} \\times \\vec{B}", display: false },
      { label: "Kinematic eq.",     code: "v^2 = u^2 + 2as",        display: true  },
      { label: "Newton's 2nd law",  code: "F = ma",                 display: true  },
      { label: "Units in text",     code: "9.81\\ \\text{m/s}^2",  display: false },
    ],
  },
  {
    title: "Chemistry",
    examples: [
      { label: "Water formula",      code: "\\text{H}_2\\text{O}",              display: false },
      { label: "Reaction arrow",     code: "\\rightarrow",                      display: false },
      { label: "Equilibrium",        code: "\\rightleftharpoons",               display: false },
      { label: "Ionic charge",       code: "\\text{Ca}^{2+}",                  display: false },
      { label: "Anion",              code: "\\text{Cl}^{-}",                   display: false },
      { label: "Balanced equation",  code: "2\\text{H}_2 + \\text{O}_2 \\rightarrow 2\\text{H}_2\\text{O}", display: true },
      { label: "Concentration",      code: "[\\text{HCl}]",                    display: false },
    ],
  },
  {
    title: "Geometry & Trigonometry",
    examples: [
      { label: "Sine",           code: "\\sin(\\theta)",          display: false },
      { label: "Cosine",         code: "\\cos(\\theta)",          display: false },
      { label: "Tangent",        code: "\\tan(\\theta)",          display: false },
      { label: "Inverse trig",   code: "\\sin^{-1}(x)",          display: false },
      { label: "Degrees",        code: "90^{\\circ}",            display: false },
      { label: "Angle notation", code: "\\angle ABC",             display: false },
      { label: "Pythagoras",     code: "a^2 + b^2 = c^2",        display: true  },
      { label: "Area formula",   code: "A = \\frac{1}{2}bh",     display: true  },
    ],
  },
  {
    title: "Statistics & Probability",
    examples: [
      { label: "Sample mean",      code: "\\bar{x}",                         display: false },
      { label: "Population mean",  code: "\\mu",                             display: false },
      { label: "Std deviation",    code: "\\sigma",                          display: false },
      { label: "Probability",      code: "P(A \\cup B)",                     display: false },
      { label: "Intersection",     code: "P(A \\cap B)",                     display: false },
      { label: "Normal dist.",     code: "X \\sim N(\\mu, \\sigma^2)",       display: false },
      { label: "Binomial coeff.",  code: "\\binom{n}{k}",                    display: false },
      { label: "Binomial dist.",   code: "P(X=k) = \\binom{n}{k}p^k(1-p)^{n-k}", display: true },
    ],
  },
  {
    title: "Formatting Tips",
    examples: [
      { label: "Plain text in math",   code: "\\text{velocity}",                 display: false },
      { label: "Units after number",   code: "3.0\\ \\text{m/s}",               display: false },
      { label: "Thin space",           code: "f(x)\\,dx",                        display: false },
      { label: "Scaled parentheses",   code: "\\left(\\frac{a}{b}\\right)",      display: false },
      { label: "Scaled brackets",      code: "\\left[\\frac{a}{b}\\right]",      display: false },
      { label: "Overline (mean)",      code: "\\overline{AB}",                   display: false },
      { label: "Underline",            code: "\\underline{x}",                   display: false },
      { label: "Bold math",            code: "\\mathbf{F}",                      display: false },
    ],
  },
]

// ── Writing tips ──────────────────────────────────────────────────────────────

const WRITING_TIPS = [
  {
    icon: "✅",
    title: "One clear question, one correct answer",
    body: "Every question should have exactly one unambiguously correct option (unless Allow Multiple Correct is on). Ambiguous wording lets students argue multiple answers — avoid it.",
  },
  {
    icon: "🎯",
    title: "Distractors should be plausible mistakes",
    body: "Wrong options should represent common misconceptions or calculation errors — not obviously absurd values. Use the Rationale field to explain why each distractor is wrong.",
  },
  {
    icon: "📐",
    title: "Match difficulty to the label",
    body: "EASY = direct recall or single-step calculation. MEDIUM = two-step reasoning or application. HARD = multi-step or conceptual analysis. CHALLENGE = synthesis across multiple concepts.",
  },
  {
    icon: "⚖️",
    title: "Keep options parallel in structure",
    body: "If three options are numbers in m/s², the fourth should be too — not a sentence. Mismatched structure gives away the answer.",
  },
  {
    icon: "🔢",
    title: "Use display mode for stand-alone equations",
    body: 'A formula that sits on its own line should use "display mode" (check the toggle). Inline mode is for math inside a sentence, like "the velocity v satisfies v = u + at".',
  },
  {
    icon: "📝",
    title: "Always fill in the explanation",
    body: "Students see the explanation after answering. A full worked solution reinforces learning — don't just say \"B is correct\", show the working.",
  },
  {
    icon: "🚫",
    title: "Never copy verbatim past-paper text",
    body: 'Use the source note to credit inspiration (e.g. "Inspired by CIE 0625/22 Q5") but rewrite the question in your own words. Verbatim reproduction violates copyright.',
  },
  {
    icon: "🏷️",
    title: "Tag thoughtfully",
    body: "Tags power the filter and recommendations. Include the year, paper number, and topic code — e.g. \"2024\", \"Paper 2\", \"kinematics\". Avoid vague tags like \"physics\".",
  },
]

// ── Panel component ───────────────────────────────────────────────────────────

type Tab = "guide" | "latex" | "tips"

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("guide")
  const [openSection, setOpenSection] = useState<string | null>("Fractions & Powers")
  const [copied, setCopied] = useState<string | null>(null)

  function copy(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      {/* Panel */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">Question Editor Help</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">LaTeX reference, writing guide, and tips</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close help"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {([
            { id: "guide", label: "Editor Guide" },
            { id: "latex", label: "LaTeX Math" },
            { id: "tips",  label: "Writing Tips" },
          ] as { id: Tab; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === id
                  ? "border-b-2 border-lime-600 text-lime-700 dark:border-lime-500 dark:text-lime-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Guide tab ────────────────────────────────────────────────────── */}
          {tab === "guide" && (
            <div className="p-5 space-y-6">
              {/* Block types */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Content Block Types</h3>
                <div className="space-y-2">
                  {[
                    {
                      kind: "text",
                      color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                      title: "Text block",
                      body: "Plain prose. Use this for the narrative part of a question — the setup, the units, the instruction. Supports line breaks.",
                    },
                    {
                      kind: "math",
                      color: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",
                      title: "Math block (LaTeX)",
                      body: 'Mathematical expressions rendered with KaTeX. Toggle "display mode" to centre the equation on its own line, or leave it off for inline math.',
                    },
                    {
                      kind: "image",
                      color: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
                      title: "Image block",
                      body: "Upload a PNG, JPEG, or WebP diagram. Fill in the alt text — it's required for accessibility and exam-compliance.",
                    },
                    {
                      kind: "graph",
                      color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                      title: "Graph / SVG block",
                      body: "Upload an SVG vector graphic. Treated separately from images for layout reasons — use this for axes, circuit diagrams, and ray diagrams.",
                    },
                  ].map(({ kind, color, title, body }) => (
                    <div key={kind} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${color}`}>{kind}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Workflow */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Step-by-step Workflow</h3>
                <ol className="space-y-3">
                  {[
                    { n: "1", title: "Set taxonomy first", body: "Pick Subject → Chapter (→ Unit if needed) in the sidebar. This determines which curriculum the question belongs to." },
                    { n: "2", title: "Write the stem", body: 'Add a "Text" block for the question prose. Add a "Math" block below it if you need a displayed formula.' },
                    { n: "3", title: "Enter 2–5 answer options", body: "Click the circle to mark the correct answer (lime = correct). Add a Rationale for each wrong option explaining the common mistake." },
                    { n: "4", title: "Write the explanation", body: "Show the full working — not just the answer. Students see this after submitting." },
                    { n: "5", title: "Set difficulty & tags", body: "Tag with year, paper number, and topic (e.g. \"2024\", \"Paper 2\", \"kinematics\")." },
                    { n: "6", title: "Save or submit", body: '"Save as draft" stores it privately. "Submit for review" sends it to the moderation queue (requires 2 approvals to publish).' },
                  ].map(({ n, title, body }) => (
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

              {/* Keyboard shortcuts */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Shortcuts</h3>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["Preview tab", "Switch between Edit and Preview to see how your question looks to students"],
                    ["+ Text", "Adds a new plain-text block to the current section"],
                    ["+ Math (LaTeX)", "Adds a new LaTeX math block — type the LaTeX code in the input that appears"],
                    ["display mode ☑", "Check this to centre the equation on its own line (block mode vs inline)"],
                    ["✕ button", "Removes that block from the stem, option, or explanation"],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex gap-3">
                      <code className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">{key}</code>
                      <span className="text-slate-500 dark:text-slate-400">{desc}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── LaTeX tab ─────────────────────────────────────────────────────── */}
          {tab === "latex" && (
            <div className="p-5 space-y-3">
              {/* Quick explainer */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">LaTeX</strong> is the standard for typesetting mathematics. Type it in a Math block and the app renders it using KaTeX.
                  Click any code snippet below to copy it to clipboard.
                </p>
                <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Inline mode</span> — math inside a sentence,
                    e.g. <span className="font-mono text-[11px]">{`x^2 + 1`}</span> renders as <Math latex="x^2 + 1" />
                  </div>
                </div>
                <div className="mt-1.5 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Display mode ☑</span> — centred on its own line,
                    e.g. <span className="font-mono text-[11px]">{`\\frac{a}{b}`}</span> renders as <Math latex="\frac{a}{b}" display />
                  </div>
                </div>
              </div>

              {/* Common mistakes */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="mb-2 text-xs font-bold text-amber-800 dark:text-amber-400">Common mistakes</p>
                <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
                  <li>Use <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{`{}`}</code> for multi-character exponents/subscripts: <code className="font-mono">x^{`{10}`}</code> not <code className="font-mono">x^10</code></li>
                  <li>Escape special chars: <code className="font-mono">%</code> → <code className="font-mono">\%</code>, <code className="font-mono">&amp;</code> → <code className="font-mono">\&amp;</code></li>
                  <li>Use <code className="font-mono">\text{`{}`}</code> for words inside math: <code className="font-mono">\text{`{m/s}`}</code></li>
                  <li>Add a thin space before units: <code className="font-mono">9.81\ \text{`{m/s}`}^2</code> (that's a backslash-space)</li>
                  <li>Chemical symbols need <code className="font-mono">\text{`{}`}</code>: <code className="font-mono">\text{`{H}`}_2\text{`{O}`}</code></li>
                </ul>
              </div>

              {/* Sections */}
              {LATEX_SECTIONS.map((section) => (
                <div key={section.title} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setOpenSection(openSection === section.title ? null : section.title)}
                  >
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{section.title}</span>
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`h-4 w-4 text-slate-400 transition-transform ${openSection === section.title ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {openSection === section.title && (
                    <div className="border-t border-slate-100 dark:border-slate-800">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-slate-400 dark:text-slate-500 w-28">Name</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-400 dark:text-slate-500">Code (click to copy)</th>
                            <th className="px-4 py-2 text-left font-semibold text-slate-400 dark:text-slate-500">Renders as</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {section.examples.map((ex) => (
                            <tr key={ex.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{ex.label}</td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => copy(ex.code)}
                                  className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-lime-100 hover:text-lime-700 transition-colors dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-lime-950/40 dark:hover:text-lime-400"
                                  title="Click to copy"
                                >
                                  {copied === ex.code ? "Copied!" : ex.code}
                                </button>
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                                <Math latex={ex.code} display={ex.display} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Tips tab ──────────────────────────────────────────────────────── */}
          {tab === "tips" && (
            <div className="p-5 space-y-4">
              {WRITING_TIPS.map(({ icon, title, body }) => (
                <div key={title} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-xl shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
                  </div>
                </div>
              ))}

              {/* Difficulty guide */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Difficulty Reference</h3>
                <div className="space-y-2">
                  {[
                    { level: "EASY",      color: "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400",   desc: "Direct recall or single-step calculation. First attempt → roughly 80%+ of students should get this right." },
                    { level: "MEDIUM",    color: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",       desc: "Two-step reasoning or straightforward application. Expect ~50–70% correct rate." },
                    { level: "HARD",      color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400", desc: "Multi-step or requires insight. Includes unfamiliar contexts or data analysis. ~30–50% correct." },
                    { level: "CHALLENGE", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",   desc: "Synthesis across multiple concepts or very rigorous mathematical treatment. Top-band only. <30% correct." },
                  ].map(({ level, color, desc }) => (
                    <div key={level} className="flex gap-3 items-start">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${color}`}>{level}</span>
                      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
