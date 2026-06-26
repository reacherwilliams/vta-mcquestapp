"use client"

import Link from "next/link"
import { useState, useRef } from "react"

type ResultItem = { index: number; id?: string; error?: string }

type ImportResult = {
  created: number
  failed: number
  results: ResultItem[]
}

export function ImportClient() {
  const [json, setJson] = useState("")
  const [loading, setLoading] = useState(false)
  const [parseError, setParseError] = useState("")
  const [result, setResult] = useState<ImportResult | null>(null)
  const [xlsxFilename, setXlsxFilename] = useState<string | null>(null)
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError("")
    setResult(null)

    if (file.name.endsWith(".xlsx")) {
      setXlsxFile(file)
      setXlsxFilename(file.name)
      setJson("")
      return
    }

    // JSON
    setXlsxFile(null)
    setXlsxFilename(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setJson(ev.target?.result as string ?? "")
    }
    reader.readAsText(file)
  }

  function clearFile() {
    setXlsxFile(null)
    setXlsxFilename(null)
    setJson("")
    setParseError("")
    setResult(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit() {
    setParseError("")
    setResult(null)
    setLoading(true)

    try {
      if (xlsxFile) {
        // Excel import
        const fd = new FormData()
        fd.append("file", xlsxFile)
        const res = await fetch("/api/admin/import/excel", { method: "POST", body: fd })
        const data = await res.json()
        if (!res.ok) {
          setParseError(data.error ?? "Import failed.")
        } else {
          setResult(data as ImportResult)
          clearFile()
        }
      } else {
        // JSON import
        let parsed: unknown
        try {
          parsed = JSON.parse(json)
        } catch {
          setParseError("Invalid JSON — check your syntax.")
          setLoading(false)
          return
        }
        const res = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        })
        const data = await res.json()
        if (!res.ok) {
          setParseError(data.error ?? "Import failed.")
        } else {
          setResult(data as ImportResult)
          setJson("")
        }
      }
    } catch {
      setParseError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && (!!xlsxFile || !!json.trim())

  return (
    <div className="space-y-5">
      {/* Download template */}
      <div className="flex items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 px-5 py-4 dark:border-lime-900 dark:bg-lime-950/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-lime-700 dark:text-lime-500">
          <path d="M12 16l-4-4h2.5V4h3v8H16l-4 4z" /><path d="M4 20h16" strokeLinecap="round" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-lime-800 dark:text-lime-300">Download Excel template</p>
          <p className="text-xs text-lime-700/80 dark:text-lime-400/70">
            Pre-filled with your curricula, subjects, and chapters. Includes dropdown validation and a sample row.
          </p>
        </div>
        <a
          href="/api/admin/import/template"
          download="mcq-masterloop-import-template.xlsx"
          className="shrink-0 rounded-xl border border-lime-600 bg-lime-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-lime-400 active:translate-y-px"
        >
          Download
        </a>
      </div>

      {/* File picker */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        {xlsxFilename ? (
          <div className="flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-lime-600">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12h8M12 8v8" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{xlsxFilename}</span>
            <button
              type="button"
              onClick={clearFile}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Remove file"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Drop a .xlsx or .json file, or paste JSON below</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              Choose file
            </button>
          </>
        )}
      </div>

      {/* JSON textarea — hidden when xlsx loaded */}
      {!xlsxFilename && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Or paste JSON directly
          </label>
          <textarea
            value={json}
            onChange={(e) => { setJson(e.target.value); setParseError(""); setResult(null) }}
            rows={14}
            spellCheck={false}
            placeholder={`{ "curriculumCode": "IBDP", "questions": [...] }`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-700 placeholder:text-slate-300 focus:border-lime-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600"
          />
        </div>
      )}

      {parseError && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
          {parseError}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="rounded-xl border-b-4 border-lime-700 bg-lime-500 px-6 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-lime-400 active:translate-y-px active:border-b-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Importing…" : xlsxFilename ? "Import Excel file" : "Import questions"}
      </button>

      {/* Results */}
      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{result.created}</p>
              <p className="text-xs text-slate-500">created</p>
            </div>
            {result.failed > 0 && (
              <div className="text-center">
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{result.failed}</p>
                <p className="text-xs text-slate-500">failed</p>
              </div>
            )}
          </div>

          {result.failed > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Errors</p>
              {result.results.filter((r) => r.error).map((r) => (
                <p key={r.index} className="text-xs text-rose-500">
                  Question {r.index + 1}: {r.error}
                </p>
              ))}
            </div>
          )}

          {result.created > 0 && (
            <Link
              href="/admin/questions?status=DRAFT"
              className="mt-4 inline-block text-sm font-semibold text-lime-700 hover:underline dark:text-lime-400"
            >
              View imported questions in moderation queue →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
