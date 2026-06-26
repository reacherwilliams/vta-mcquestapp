"use client"

import { useEffect, useState } from "react"

type NetworkStatus = { connected: boolean; connectionType: string }

let _Network: typeof import("@capacitor/network").Network | null = null

async function getNetwork() {
  if (_Network) return _Network
  try {
    const { Network } = await import("@capacitor/network")
    _Network = Network
    return _Network
  } catch {
    return null
  }
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const net = await getNetwork()
  if (!net) return { connected: navigator.onLine, connectionType: "unknown" }
  try {
    const status = await net.getStatus()
    return { connected: status.connected, connectionType: status.connectionType }
  } catch {
    return { connected: navigator.onLine, connectionType: "unknown" }
  }
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function setup() {
      const net = await getNetwork()
      if (net) {
        const initial = await net.getStatus().catch(() => ({ connected: true }))
        setOnline(initial.connected)
        const handle = await net.addListener("networkStatusChange", (s) => setOnline(s.connected))
        cleanup = () => handle.remove()
      } else {
        setOnline(navigator.onLine)
        const onOnline = () => setOnline(true)
        const onOffline = () => setOnline(false)
        window.addEventListener("online", onOnline)
        window.addEventListener("offline", onOffline)
        cleanup = () => {
          window.removeEventListener("online", onOnline)
          window.removeEventListener("offline", onOffline)
        }
      }
    }

    setup()
    return () => cleanup?.()
  }, [])

  return online
}
