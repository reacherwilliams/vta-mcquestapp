"use client"

type ImpactStyle = "Light" | "Medium" | "Heavy"
type NotificationType = "Success" | "Warning" | "Error"

let _haptics: typeof import("@capacitor/haptics").Haptics | null = null

async function getHaptics() {
  if (_haptics) return _haptics
  try {
    const { Haptics } = await import("@capacitor/haptics")
    _haptics = Haptics
    return _haptics
  } catch {
    return null
  }
}

export async function impactLight() {
  const h = await getHaptics()
  if (!h) return
  try {
    const { ImpactStyle } = await import("@capacitor/haptics")
    await h.impact({ style: ImpactStyle.Light })
  } catch {}
}

export async function impactMedium() {
  const h = await getHaptics()
  if (!h) return
  try {
    const { ImpactStyle } = await import("@capacitor/haptics")
    await h.impact({ style: ImpactStyle.Medium })
  } catch {}
}

export async function impactHeavy() {
  const h = await getHaptics()
  if (!h) return
  try {
    const { ImpactStyle } = await import("@capacitor/haptics")
    await h.impact({ style: ImpactStyle.Heavy })
  } catch {}
}

export async function notifySuccess() {
  const h = await getHaptics()
  if (!h) return
  try {
    const { NotificationType } = await import("@capacitor/haptics")
    await h.notification({ type: NotificationType.Success })
  } catch {}
}

export async function notifyError() {
  const h = await getHaptics()
  if (!h) return
  try {
    const { NotificationType } = await import("@capacitor/haptics")
    await h.notification({ type: NotificationType.Error })
  } catch {}
}
