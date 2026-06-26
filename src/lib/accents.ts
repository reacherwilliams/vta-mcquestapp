// Brand accent palette. Each accent must keep WCAG AA on the duo CTA
// (`-500` fill with slate-900 text) and not collide with the semantic
// emerald/rose used for correct/wrong feedback. Purple stays banned.
//
// Tailwind v4 only emits classes that appear literally in source, so
// every utility lives here as a full string — do not template them.

export const ACCENT_KEYS = ["lime", "orange", "amber", "pink", "sky", "teal"] as const
export type Accent = (typeof ACCENT_KEYS)[number]

export type AccentTheme = {
  label: string
  swatch: string
  duoProgress: string
  duoChip: string
  duoOptionHover: string
  duoOptionSelected: string
  duoLabelSelected: string
  duoCtaBorder: string
  duoCtaFill: string
  swissActiveRule: string
  swissActiveLabel: string
  swissActiveLink: string
}

export const ACCENTS: Record<Accent, AccentTheme> = {
  lime: {
    label: "Lime",
    swatch: "bg-lime-500",
    duoProgress: "bg-lime-500",
    duoChip: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    duoOptionHover: "hover:border-lime-400 hover:bg-lime-50/60",
    duoOptionSelected: "border-lime-500 bg-lime-50 dark:border-lime-400 dark:bg-lime-950/40",
    duoLabelSelected: "border-lime-600 bg-lime-600 text-white",
    duoCtaBorder: "border-lime-700",
    duoCtaFill: "bg-lime-500 text-slate-900 hover:bg-lime-400",
    swissActiveRule: "border-lime-600 text-lime-800 dark:text-lime-300",
    swissActiveLabel: "text-lime-800 dark:text-lime-300",
    swissActiveLink: "text-lime-700 hover:text-lime-900 dark:text-lime-400 dark:hover:text-lime-200",
  },
  orange: {
    label: "Orange",
    swatch: "bg-orange-500",
    duoProgress: "bg-orange-500",
    duoChip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    duoOptionHover: "hover:border-orange-400 hover:bg-orange-50/60",
    duoOptionSelected: "border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-950/40",
    duoLabelSelected: "border-orange-600 bg-orange-600 text-white",
    duoCtaBorder: "border-orange-700",
    duoCtaFill: "bg-orange-500 text-slate-900 hover:bg-orange-400",
    swissActiveRule: "border-orange-600 text-orange-800 dark:text-orange-300",
    swissActiveLabel: "text-orange-800 dark:text-orange-300",
    swissActiveLink: "text-orange-700 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-200",
  },
  sky: {
    label: "Sky",
    swatch: "bg-sky-500",
    duoProgress: "bg-sky-500",
    duoChip: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    duoOptionHover: "hover:border-sky-400 hover:bg-sky-50/60",
    duoOptionSelected: "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40",
    duoLabelSelected: "border-sky-600 bg-sky-600 text-white",
    duoCtaBorder: "border-sky-700",
    duoCtaFill: "bg-sky-500 text-slate-900 hover:bg-sky-400",
    swissActiveRule: "border-sky-600 text-sky-800 dark:text-sky-300",
    swissActiveLabel: "text-sky-800 dark:text-sky-300",
    swissActiveLink: "text-sky-700 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-200",
  },
  amber: {
    label: "Amber",
    swatch: "bg-amber-500",
    duoProgress: "bg-amber-500",
    duoChip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    duoOptionHover: "hover:border-amber-400 hover:bg-amber-50/60",
    duoOptionSelected: "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40",
    duoLabelSelected: "border-amber-600 bg-amber-600 text-white",
    duoCtaBorder: "border-amber-700",
    duoCtaFill: "bg-amber-500 text-slate-900 hover:bg-amber-400",
    swissActiveRule: "border-amber-600 text-amber-800 dark:text-amber-300",
    swissActiveLabel: "text-amber-800 dark:text-amber-300",
    swissActiveLink: "text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200",
  },
  pink: {
    label: "Pink",
    swatch: "bg-pink-500",
    duoProgress: "bg-pink-500",
    duoChip: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
    duoOptionHover: "hover:border-pink-400 hover:bg-pink-50/60",
    duoOptionSelected: "border-pink-500 bg-pink-50 dark:border-pink-400 dark:bg-pink-950/40",
    duoLabelSelected: "border-pink-600 bg-pink-600 text-white",
    duoCtaBorder: "border-pink-700",
    duoCtaFill: "bg-pink-500 text-slate-900 hover:bg-pink-400",
    swissActiveRule: "border-pink-600 text-pink-800 dark:text-pink-300",
    swissActiveLabel: "text-pink-800 dark:text-pink-300",
    swissActiveLink: "text-pink-700 hover:text-pink-900 dark:text-pink-400 dark:hover:text-pink-200",
  },
  teal: {
    label: "Teal",
    swatch: "bg-teal-500",
    duoProgress: "bg-teal-500",
    duoChip: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    duoOptionHover: "hover:border-teal-400 hover:bg-teal-50/60",
    duoOptionSelected: "border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/40",
    duoLabelSelected: "border-teal-600 bg-teal-600 text-white",
    duoCtaBorder: "border-teal-700",
    duoCtaFill: "bg-teal-500 text-slate-900 hover:bg-teal-400",
    swissActiveRule: "border-teal-600 text-teal-800 dark:text-teal-300",
    swissActiveLabel: "text-teal-800 dark:text-teal-300",
    swissActiveLink: "text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-200",
  },
}

export function resolveAccent(raw: string | undefined): Accent {
  return (ACCENT_KEYS as readonly string[]).includes(raw ?? "") ? (raw as Accent) : "lime"
}
