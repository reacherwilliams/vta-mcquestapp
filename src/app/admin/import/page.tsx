import { ImportClient } from "./ImportClient"

export const metadata = { title: "Admin — Bulk Import" }

export default function BulkImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Bulk import</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Import up to 200 questions from an Excel template (.xlsx) or raw JSON. All questions are created as DRAFT and require review before publishing.
        </p>
      </div>

      {/* Format reference */}
      <details className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          JSON format reference
        </summary>
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
{`{
  "curriculumCode": "IBDP",
  "questions": [
    {
      "subjectCode": "PHY",
      "chapterName": "Kinematics",
      "difficulty": "MEDIUM",
      "tags": ["Paper 2", "2024"],
      "sourceNote": "Original — exam-style",
      "aiAssisted": false,
      "allowMultipleCorrect": false,
      "stem": [
        { "kind": "text", "text": "A ball is thrown vertically upward with speed 15 m/s. What is the maximum height reached? (g = 10 m/s²)" }
      ],
      "options": [
        { "sortOrder": 0, "isCorrect": false, "content": { "kind": "text", "text": "7.5 m" } },
        { "sortOrder": 1, "isCorrect": true,  "content": { "kind": "text", "text": "11.25 m" } },
        { "sortOrder": 2, "isCorrect": false, "content": { "kind": "text", "text": "15 m" } },
        { "sortOrder": 3, "isCorrect": false, "content": { "kind": "text", "text": "22.5 m" } }
      ],
      "explanation": [
        { "kind": "text", "text": "Using v² = u² − 2gh, h = u²/2g = 225/20 = 11.25 m" }
      ]
    }
  ]
}`}
          </pre>
        </div>
      </details>

      <ImportClient />
    </div>
  )
}
