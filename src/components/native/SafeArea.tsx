"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"

// Applies Capacitor safe-area insets as CSS variables on :root.
// Works on iOS (notch, home indicator) and Android cutouts.
// On web it's a no-op — the env() fallbacks in globals.css handle it.
export function SafeAreaProvider() {
  useEffect(() => {
    // Polyfill via CSS env() for all environments (web + native via WKWebView)
    const root = document.documentElement
    root.style.setProperty("--sat", "env(safe-area-inset-top, 0px)")
    root.style.setProperty("--sar", "env(safe-area-inset-right, 0px)")
    root.style.setProperty("--sab", "env(safe-area-inset-bottom, 0px)")
    root.style.setProperty("--sal", "env(safe-area-inset-left, 0px)")
  }, [])

  return null
}

interface SafeAreaViewProps {
  children: React.ReactNode
  className?: string
  top?: boolean
  bottom?: boolean
  sides?: boolean
}

// Wrapper that adds safe-area padding to its children.
export function SafeAreaView({
  children,
  className,
  top = false,
  bottom = false,
  sides = false,
}: SafeAreaViewProps) {
  return (
    <div
      className={cn(className)}
      style={{
        paddingTop: top ? "var(--sat, 0px)" : undefined,
        paddingBottom: bottom ? "var(--sab, 0px)" : undefined,
        paddingLeft: sides ? "var(--sal, 0px)" : undefined,
        paddingRight: sides ? "var(--sar, 0px)" : undefined,
      }}
    >
      {children}
    </div>
  )
}
