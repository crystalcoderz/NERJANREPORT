import type { Metadata } from "next"
import { SatelliteCommandCenter } from "@/components/satellite/satellite-command-center"

export const metadata: Metadata = {
  title: "Satellite Command Center — Jan Report",
  description: "Live satellite and hybrid terrain view of the North Eastern Region logistics network with real-time fleet tracking.",
}

export default function SatellitePage() {
  return <SatelliteCommandCenter />
}
