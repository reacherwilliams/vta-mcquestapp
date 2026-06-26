import katex from "katex"
import { cn } from "@/lib/utils"
import type { ContentBlock, MathBlock } from "@/lib/questions/types"

// KaTeX renders to a string on the server, so math is in the DOM at first
// paint with no client-side hydration cost.
function renderMath(block: MathBlock): string {
  return katex.renderToString(block.latex, {
    displayMode: block.display,
    throwOnError: false,
    output: "html",
  })
}

type Props = {
  block: ContentBlock
  className?: string
  // Layout hint — option grids constrain images differently from stems.
  variant?: "stem" | "option" | "explanation"
}

export function ContentBlockView({ block, className, variant = "stem" }: Props) {
  switch (block.kind) {
    case "text":
      return (
        <p
          className={cn(
            "whitespace-pre-wrap leading-relaxed",
            variant === "stem" && "text-xl font-bold leading-snug text-slate-900 sm:text-2xl dark:text-slate-100",
            variant === "option" && "text-sm sm:text-base text-slate-900 dark:text-slate-100",
            variant === "explanation" && "text-sm text-slate-700 dark:text-slate-300",
            className,
          )}
        >
          {block.text}
        </p>
      )

    case "math":
      return (
        <span
          className={cn(
            block.display ? "block my-2 text-center" : "inline",
            className,
          )}
          dangerouslySetInnerHTML={{ __html: renderMath(block) }}
        />
      )

    case "image":
    case "graph": {
      const isOption = variant === "option"
      return (
        <div
          className={cn(
            "overflow-hidden rounded-md bg-white",
            isOption ? "aspect-square w-full" : "w-full max-w-sm aspect-4/3",
            className,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </div>
      )
    }

    case "mixed":
      return (
        <div className={cn("flex flex-col gap-2", className)}>
          {block.blocks.map((child, i) => (
            <ContentBlockView key={i} block={child} variant={variant} />
          ))}
        </div>
      )
  }
}

export function ContentBlockList({
  blocks,
  variant = "stem",
  className,
}: {
  blocks: ContentBlock[]
  variant?: Props["variant"]
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {blocks.map((b, i) => (
        <ContentBlockView key={i} block={b} variant={variant} />
      ))}
    </div>
  )
}
