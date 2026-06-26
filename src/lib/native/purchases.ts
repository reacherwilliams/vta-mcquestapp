"use client"

// RevenueCat Capacitor SDK wrapper.
// On web (non-Capacitor) all calls are no-ops that return sensible defaults.

export type PurchasesOffering = {
  identifier: string
  serverDescription: string
  packages: PurchasesPackage[]
}

export type PurchasesPackage = {
  identifier: string
  packageType: string
  product: {
    identifier: string
    title: string
    description: string
    price: number
    priceString: string
    currencyCode: string
  }
}

let _Purchases: typeof import("@revenuecat/purchases-capacitor").Purchases | null = null

function isNative(): boolean {
  try {
    // Capacitor sets window.Capacitor.isNativePlatform() when running inside a native shell.
    // On plain web this property is undefined or returns false.
    return !!(window as any).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

async function getSDK() {
  if (!isNative()) return null
  if (_Purchases) return _Purchases
  try {
    const mod = await import("@revenuecat/purchases-capacitor")
    _Purchases = mod.Purchases
    return _Purchases
  } catch {
    return null
  }
}

export async function initRevenueCat(userId: string) {
  const sdk = await getSDK()
  if (!sdk) return
  const apiKey = typeof window !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
    ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY!
    : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY!
  if (!apiKey) return
  try {
    await sdk.configure({ apiKey, appUserID: userId })
  } catch {}
}

export async function getOfferings(): Promise<PurchasesOffering[]> {
  const sdk = await getSDK()
  if (!sdk) return []
  try {
    const result = await sdk.getOfferings()
    // PurchasesOfferings type shape varies by SDK version — use any for safety
    const all = (result as any)?.offerings?.all ?? (result as any)?.all ?? {}
    return Object.values(all) as PurchasesOffering[]
  } catch {
    return []
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<"success" | "cancelled" | "error"> {
  const sdk = await getSDK()
  if (!sdk) return "error"
  try {
    await sdk.purchasePackage({ aPackage: pkg as any })
    return "success"
  } catch (e: any) {
    if (e?.code === "PURCHASE_CANCELLED") return "cancelled"
    return "error"
  }
}

export async function restorePurchases(): Promise<boolean> {
  const sdk = await getSDK()
  if (!sdk) return false
  try {
    await sdk.restorePurchases()
    return true
  } catch {
    return false
  }
}

export async function getCustomerInfo() {
  const sdk = await getSDK()
  if (!sdk) return null
  try {
    return await sdk.getCustomerInfo()
  } catch {
    return null
  }
}
