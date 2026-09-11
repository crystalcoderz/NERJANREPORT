export type RiskLevel = "low" | "moderate" | "high"

export type LatLng = { lat: number; lng: number }

export const cities: Record<string, LatLng> = {
  Guwahati: { lat: 26.1445, lng: 91.7362 },
  Shillong: { lat: 25.5788, lng: 91.8933 },
  Dimapur: { lat: 25.9091, lng: 93.7266 },
  Kohima: { lat: 25.6751, lng: 94.1086 },
  Aizawl: { lat: 23.7271, lng: 92.7176 },
  Silchar: { lat: 24.8333, lng: 92.7789 },
  Imphal: { lat: 24.817, lng: 93.9368 },
  Agartala: { lat: 23.8315, lng: 91.2868 },
  Itanagar: { lat: 27.0844, lng: 93.6053 },
  Tawang: { lat: 27.5861, lng: 91.8594 },
}

export const stats = [
  {
    id: "active",
    label: "Active Shipments",
    value: "12",
    delta: "+20%",
    trend: "up" as const,
    tone: "info" as const,
    icon: "truck" as const,
    spark: [4, 6, 5, 7, 6, 9, 8, 12],
  },
  {
    id: "weather",
    label: "Weather Alerts",
    value: "6",
    delta: "+2",
    trend: "up" as const,
    tone: "moderate" as const,
    icon: "cloud" as const,
    spark: [1, 2, 2, 3, 4, 4, 5, 6],
  },
  {
    id: "ontime",
    label: "On-Time Delivery",
    value: "92%",
    delta: "+5%",
    trend: "up" as const,
    tone: "low" as const,
    icon: "check" as const,
    spark: [82, 84, 83, 86, 88, 89, 90, 92],
  },
  {
    id: "risk",
    label: "High-Risk Routes",
    value: "3",
    delta: "+1",
    trend: "up" as const,
    tone: "high" as const,
    icon: "alert" as const,
    spark: [1, 1, 2, 2, 2, 2, 3, 3],
  },
]

export type RoutePoint = LatLng

// Approximate corridor Guwahati -> Shillong (NH6)
export const activeRoutePath: RoutePoint[] = [
  { lat: 26.1445, lng: 91.7362 },
  { lat: 26.05, lng: 91.79 },
  { lat: 25.95, lng: 91.84 },
  { lat: 25.86, lng: 91.86 },
  { lat: 25.74, lng: 91.87 },
  { lat: 25.65, lng: 91.885 },
  { lat: 25.5788, lng: 91.8933 },
]

export type Incident = {
  id: string
  position: LatLng
  level: RiskLevel | "info"
  title: string
  detail: string
}

export const incidents: Incident[] = [
  {
    id: "inc-1",
    position: { lat: 25.95, lng: 91.84 },
    level: "info",
    title: "Light rain band",
    detail: "Reduced grip, drive with caution near Nongpoh.",
  },
  {
    id: "inc-2",
    position: { lat: 25.74, lng: 91.87 },
    level: "high",
    title: "Landslide-prone stretch",
    detail: "Active slope monitoring near Umsning ghat section.",
  },
  {
    id: "inc-3",
    position: { lat: 25.65, lng: 91.885 },
    level: "moderate",
    title: "Waterlogging reported",
    detail: "Localized flooding after Barapani, expect delays.",
  },
]

export const recommendedRoute = {
  from: "Guwahati",
  to: "Shillong",
  distanceKm: 100,
  etaLabel: "3 hr 10 min",
  risk: "low" as RiskLevel,
  origin: cities.Guwahati,
  destination: cities.Shillong,
}

export const otherRoutes = [
  {
    id: "r-nh6",
    name: "Via Jorabat–Barapani",
    distanceKm: 108,
    etaLabel: "3 hr 35 min",
    risk: "moderate" as RiskLevel,
  },
  {
    id: "r-old",
    name: "Via Old Shillong Road",
    distanceKm: 121,
    etaLabel: "4 hr 20 min",
    risk: "high" as RiskLevel,
  },
]

export type Driver = { id: string; name: string; vehicle: string }

export const drivers: Driver[] = [
  { id: "d-1", name: "Rahul Deka", vehicle: "AS-01 TC 4821 · Truck" },
  { id: "d-2", name: "Bhaskar Nongrum", vehicle: "ML-05 AB 1190 · Truck" },
  { id: "d-3", name: "Imlong Ao", vehicle: "NL-04 CD 3327 · Van" },
  { id: "d-4", name: "Zosangzuala", vehicle: "MZ-01 EF 2204 · Truck" },
  { id: "d-5", name: "Sanjib Barman", vehicle: "AS-25 GH 7710 · Truck" },
  { id: "d-6", name: "Nokmi Wangsa", vehicle: "AR-02 JK 5561 · Van" },
]

export type ShipmentStatus = "In Transit" | "Scheduled" | "Delayed"

export const shipments: {
  id: string
  from: string
  to: string
  status: ShipmentStatus
}[] = [
  { id: "#NER1023", from: "Guwahati", to: "Shillong", status: "In Transit" },
  { id: "#NER1024", from: "Dimapur", to: "Kohima", status: "Scheduled" },
  { id: "#NER1025", from: "Guwahati", to: "Aizawl", status: "Delayed" },
  { id: "#NER1026", from: "Silchar", to: "Imphal", status: "In Transit" },
]

export const weatherAlerts: {
  id: string
  level: RiskLevel
  title: string
  place: string
  eta: string
  kind: "rain" | "landslide" | "fog" | "flood" | "wind"
}[] = [
  {
    id: "wa-1",
    level: "high",
    title: "Heavy Rain Expected",
    place: "Shillong, Meghalaya",
    eta: "in 3 hours",
    kind: "rain",
  },
  {
    id: "wa-2",
    level: "high",
    title: "Landslide Risk",
    place: "Sonapur, NH6",
    eta: "in 4 hours",
    kind: "landslide",
  },
  {
    id: "wa-3",
    level: "moderate",
    title: "Low Visibility",
    place: "Cherrapunji",
    eta: "in 5 hours",
    kind: "fog",
  },
  {
    id: "wa-4",
    level: "high",
    title: "Flood Warning",
    place: "Silchar, Assam",
    eta: "in 6 hours",
    kind: "flood",
  },
  {
    id: "wa-5",
    level: "moderate",
    title: "Strong Winds",
    place: "Tawang, Arunachal",
    eta: "in 7 hours",
    kind: "wind",
  },
  {
    id: "wa-6",
    level: "moderate",
    title: "Road Damage",
    place: "Kohima Ghat",
    eta: "in 8 hours",
    kind: "landslide",
  },
]

export const news = [
  {
    id: "n-1",
    title: "MDoNER issues heavy rainfall alert for Meghalaya & Assam",
    date: "12 Sep 2026",
  },
  {
    id: "n-2",
    title: "Partial road closure on NH6 due to landslide near Sonapur",
    date: "11 Sep 2026",
  },
  {
    id: "n-3",
    title: "New highway maintenance schedule announced for NER corridors",
    date: "10 Sep 2026",
  },
]
