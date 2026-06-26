"use client"

import { useEffect } from "react"
import { initRevenueCat } from "@/lib/native/purchases"

export function RevenueCatInit({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return
    initRevenueCat(userId)
  }, [userId])

  return null
}
