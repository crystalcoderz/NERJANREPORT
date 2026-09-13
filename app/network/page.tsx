import type { Metadata } from "next"
import { NetworkConsole } from "@/components/network/network-console"

export const metadata: Metadata = {
  title: "National Risk Grid — Jan Report",
  description:
    "Live weather and terrain risk scoring across major Indian freight nodes, from metro ports to Himalayan hill capitals.",
}

export default function NetworkPage() {
  return <NetworkConsole />
}
