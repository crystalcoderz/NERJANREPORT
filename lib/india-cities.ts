import type { LatLng } from "./data"

export type Zone = "North" | "South" | "East" | "West" | "Central" | "Northeast"

export type IndiaCity = {
  name: string
  state: string
  zone: Zone
  coords: LatLng
  /** Metres above sea level — drives the landslide/gradient term in the risk model. */
  elevationM: number
  /** Approximate urban population, used for exposure weighting. */
  population: number
  /** Why this node matters to freight. */
  role: string
  /** Major seaport or inland container hub. */
  port?: boolean
  /** Sits on a recognised flood plain or has a recurring urban-flooding record. */
  floodProne?: boolean
  /** Hill or ghat terrain where slope failure closes roads. */
  hillTerrain?: boolean
  /** Recurring dense-fog belt (Indo-Gangetic plain in winter). */
  fogBelt?: boolean
}

/**
 * Major Indian freight nodes across every zone. Coordinates are city centres and
 * population figures are approximate urban-agglomeration scale — they weight
 * exposure in the risk model rather than being reported as exact census counts.
 */
export const indiaCities: IndiaCity[] = [
  // ---- North ----
  { name: "Delhi", state: "Delhi NCR", zone: "North", coords: { lat: 28.6139, lng: 77.209 }, elevationM: 216, population: 32900000, role: "National capital · largest inland freight market", fogBelt: true, floodProne: true },
  { name: "Jaipur", state: "Rajasthan", zone: "North", coords: { lat: 26.9124, lng: 75.7873 }, elevationM: 431, population: 4100000, role: "NH-48 corridor · textiles and handicraft freight", fogBelt: true },
  { name: "Lucknow", state: "Uttar Pradesh", zone: "North", coords: { lat: 26.8467, lng: 80.9462 }, elevationM: 123, population: 3700000, role: "Awadh distribution hub", fogBelt: true },
  { name: "Kanpur", state: "Uttar Pradesh", zone: "North", coords: { lat: 26.4499, lng: 80.3319 }, elevationM: 126, population: 3100000, role: "Leather and industrial cluster on the Ganga", fogBelt: true, floodProne: true },
  { name: "Varanasi", state: "Uttar Pradesh", zone: "North", coords: { lat: 25.3176, lng: 82.9739 }, elevationM: 81, population: 1600000, role: "Eastern UP node · NW-1 river terminal", fogBelt: true, floodProne: true },
  { name: "Agra", state: "Uttar Pradesh", zone: "North", coords: { lat: 27.1767, lng: 78.0081 }, elevationM: 171, population: 1900000, role: "Yamuna Expressway freight waypoint", fogBelt: true },
  { name: "Ludhiana", state: "Punjab", zone: "North", coords: { lat: 30.901, lng: 75.8573 }, elevationM: 262, population: 1800000, role: "Punjab manufacturing and hosiery hub", fogBelt: true },
  { name: "Amritsar", state: "Punjab", zone: "North", coords: { lat: 31.634, lng: 74.8723 }, elevationM: 234, population: 1300000, role: "Attari border trade gateway", fogBelt: true },
  { name: "Chandigarh", state: "Chandigarh", zone: "North", coords: { lat: 30.7333, lng: 76.7794 }, elevationM: 321, population: 1200000, role: "Tricity administrative and logistics base", fogBelt: true },
  { name: "Dehradun", state: "Uttarakhand", zone: "North", coords: { lat: 30.3165, lng: 78.0322 }, elevationM: 640, population: 800000, role: "Doon valley gateway to Garhwal", hillTerrain: true },
  { name: "Shimla", state: "Himachal Pradesh", zone: "North", coords: { lat: 31.1048, lng: 77.1734 }, elevationM: 2276, population: 200000, role: "Hill capital · NH-5 ghat access", hillTerrain: true },
  { name: "Jammu", state: "Jammu & Kashmir", zone: "North", coords: { lat: 32.7266, lng: 74.857 }, elevationM: 327, population: 700000, role: "Railhead for the Kashmir valley supply line", hillTerrain: true },
  { name: "Srinagar", state: "Jammu & Kashmir", zone: "North", coords: { lat: 34.0837, lng: 74.7973 }, elevationM: 1585, population: 1200000, role: "Valley hub · NH-44 Banihal dependency", hillTerrain: true, floodProne: true },
  { name: "Jodhpur", state: "Rajasthan", zone: "North", coords: { lat: 26.2389, lng: 73.0243 }, elevationM: 231, population: 1300000, role: "Western Rajasthan desert freight node" },

  // ---- West ----
  { name: "Mumbai", state: "Maharashtra", zone: "West", coords: { lat: 19.076, lng: 72.8777 }, elevationM: 14, population: 21700000, role: "Financial capital · JNPT container gateway", port: true, floodProne: true },
  { name: "Pune", state: "Maharashtra", zone: "West", coords: { lat: 18.5204, lng: 73.8567 }, elevationM: 560, population: 7400000, role: "Automotive and IT manufacturing belt" },
  { name: "Ahmedabad", state: "Gujarat", zone: "West", coords: { lat: 23.0225, lng: 72.5714 }, elevationM: 53, population: 8400000, role: "Gujarat industrial and textile core" },
  { name: "Surat", state: "Gujarat", zone: "West", coords: { lat: 21.1702, lng: 72.8311 }, elevationM: 13, population: 7500000, role: "Diamond and synthetic textile export hub", floodProne: true },
  { name: "Vadodara", state: "Gujarat", zone: "West", coords: { lat: 22.3072, lng: 73.1812 }, elevationM: 39, population: 2200000, role: "Petrochemical corridor node" },
  { name: "Rajkot", state: "Gujarat", zone: "West", coords: { lat: 22.3039, lng: 70.8022 }, elevationM: 134, population: 1600000, role: "Saurashtra engineering cluster" },
  { name: "Kandla", state: "Gujarat", zone: "West", coords: { lat: 23.0333, lng: 70.2167 }, elevationM: 5, population: 70000, role: "Deendayal Port · bulk and POL terminal", port: true, floodProne: true },
  { name: "Nashik", state: "Maharashtra", zone: "West", coords: { lat: 19.9975, lng: 73.7898 }, elevationM: 584, population: 2100000, role: "Agri-produce and wine belt on NH-160" },
  { name: "Nagpur", state: "Maharashtra", zone: "West", coords: { lat: 21.1458, lng: 79.0882 }, elevationM: 310, population: 2900000, role: "Geographic centre · MIHAN air-cargo hub" },
  { name: "Panaji", state: "Goa", zone: "West", coords: { lat: 15.4909, lng: 73.8278 }, elevationM: 7, population: 115000, role: "Mormugao port and coastal trade", port: true },

  // ---- Central ----
  { name: "Indore", state: "Madhya Pradesh", zone: "Central", coords: { lat: 22.7196, lng: 75.8577 }, elevationM: 553, population: 3300000, role: "Malwa commercial capital · Pithampur cluster" },
  { name: "Bhopal", state: "Madhya Pradesh", zone: "Central", coords: { lat: 23.2599, lng: 77.4126 }, elevationM: 527, population: 2400000, role: "State capital · central distribution" },
  { name: "Raipur", state: "Chhattisgarh", zone: "Central", coords: { lat: 21.2514, lng: 81.6296 }, elevationM: 298, population: 1500000, role: "Steel, coal and mineral freight origin" },

  // ---- South ----
  { name: "Bengaluru", state: "Karnataka", zone: "South", coords: { lat: 12.9716, lng: 77.5946 }, elevationM: 920, population: 13600000, role: "Technology capital · high-value air cargo", floodProne: true },
  { name: "Chennai", state: "Tamil Nadu", zone: "South", coords: { lat: 13.0827, lng: 80.2707 }, elevationM: 6, population: 11500000, role: "Chennai and Ennore ports · auto export base", port: true, floodProne: true },
  { name: "Hyderabad", state: "Telangana", zone: "South", coords: { lat: 17.385, lng: 78.4867 }, elevationM: 542, population: 10500000, role: "Pharma and electronics manufacturing hub", floodProne: true },
  { name: "Kochi", state: "Kerala", zone: "South", coords: { lat: 9.9312, lng: 76.2673 }, elevationM: 6, population: 2300000, role: "Vallarpadam transshipment terminal", port: true, floodProne: true },
  { name: "Coimbatore", state: "Tamil Nadu", zone: "South", coords: { lat: 11.0168, lng: 76.9558 }, elevationM: 411, population: 2500000, role: "Textile machinery and pump manufacturing" },
  { name: "Visakhapatnam", state: "Andhra Pradesh", zone: "South", coords: { lat: 17.6868, lng: 83.2185 }, elevationM: 45, population: 2400000, role: "Deep-water port · cyclone-exposed coast", port: true },
  { name: "Vijayawada", state: "Andhra Pradesh", zone: "South", coords: { lat: 16.5062, lng: 80.648 }, elevationM: 23, population: 1800000, role: "Krishna delta junction on NH-16", floodProne: true },
  { name: "Thiruvananthapuram", state: "Kerala", zone: "South", coords: { lat: 8.5241, lng: 76.9366 }, elevationM: 16, population: 1700000, role: "Vizhinjam deep-water port catchment", port: true },
  { name: "Kozhikode", state: "Kerala", zone: "South", coords: { lat: 11.2588, lng: 75.7804 }, elevationM: 1, population: 2000000, role: "Malabar coast trade centre", floodProne: true },
  { name: "Madurai", state: "Tamil Nadu", zone: "South", coords: { lat: 9.9252, lng: 78.1198 }, elevationM: 101, population: 1600000, role: "Southern Tamil Nadu distribution" },
  { name: "Tiruchirappalli", state: "Tamil Nadu", zone: "South", coords: { lat: 10.7905, lng: 78.7047 }, elevationM: 78, population: 1100000, role: "Cauvery delta industrial node", floodProne: true },
  { name: "Thoothukudi", state: "Tamil Nadu", zone: "South", coords: { lat: 8.7642, lng: 78.1348 }, elevationM: 3, population: 250000, role: "VOC Port · container and bulk exports", port: true },
  { name: "Mysuru", state: "Karnataka", zone: "South", coords: { lat: 12.2958, lng: 76.6394 }, elevationM: 770, population: 1100000, role: "Industrial satellite of Bengaluru" },
  { name: "Mangaluru", state: "Karnataka", zone: "South", coords: { lat: 12.9141, lng: 74.856 }, elevationM: 22, population: 700000, role: "New Mangalore Port · POL and cashew", port: true, floodProne: true },
  { name: "Puducherry", state: "Puducherry", zone: "South", coords: { lat: 11.9416, lng: 79.8083 }, elevationM: 3, population: 250000, role: "Coromandel coast manufacturing enclave" },

  // ---- East ----
  { name: "Kolkata", state: "West Bengal", zone: "East", coords: { lat: 22.5726, lng: 88.3639 }, elevationM: 9, population: 15100000, role: "Eastern gateway · Haldia and Kolkata docks", port: true, floodProne: true, fogBelt: true },
  { name: "Patna", state: "Bihar", zone: "East", coords: { lat: 25.5941, lng: 85.1376 }, elevationM: 53, population: 2500000, role: "Ganga plain hub · chronic flood exposure", floodProne: true, fogBelt: true },
  { name: "Bhubaneswar", state: "Odisha", zone: "East", coords: { lat: 20.2961, lng: 85.8245 }, elevationM: 45, population: 1300000, role: "Odisha capital · cyclone landfall corridor" },
  { name: "Paradip", state: "Odisha", zone: "East", coords: { lat: 20.3167, lng: 86.6167 }, elevationM: 3, population: 80000, role: "Paradip Port · iron ore and POL", port: true, floodProne: true },
  { name: "Cuttack", state: "Odisha", zone: "East", coords: { lat: 20.4625, lng: 85.8828 }, elevationM: 36, population: 700000, role: "Mahanadi delta distribution centre", floodProne: true },
  { name: "Ranchi", state: "Jharkhand", zone: "East", coords: { lat: 23.3441, lng: 85.3096 }, elevationM: 651, population: 1500000, role: "Chotanagpur plateau mineral hub" },
  { name: "Jamshedpur", state: "Jharkhand", zone: "East", coords: { lat: 22.8046, lng: 86.2029 }, elevationM: 135, population: 1600000, role: "Integrated steel and heavy engineering" },
  { name: "Dhanbad", state: "Jharkhand", zone: "East", coords: { lat: 23.7957, lng: 86.4304 }, elevationM: 222, population: 1200000, role: "Coal capital · rail-heavy outbound freight" },
  { name: "Siliguri", state: "West Bengal", zone: "East", coords: { lat: 26.7271, lng: 88.3953 }, elevationM: 122, population: 900000, role: "Chicken's Neck corridor to the Northeast", floodProne: true },

  // ---- Northeast ----
  { name: "Guwahati", state: "Assam", zone: "Northeast", coords: { lat: 26.1445, lng: 91.7362 }, elevationM: 55, population: 1100000, role: "Northeast gateway · multimodal consolidation", floodProne: true },
  { name: "Shillong", state: "Meghalaya", zone: "Northeast", coords: { lat: 25.5788, lng: 91.8933 }, elevationM: 1496, population: 350000, role: "Meghalaya capital · NH-6 ghat section", hillTerrain: true },
  { name: "Dibrugarh", state: "Assam", zone: "Northeast", coords: { lat: 27.4728, lng: 94.912 }, elevationM: 108, population: 154000, role: "Upper Assam oil and tea hub", floodProne: true },
  { name: "Silchar", state: "Assam", zone: "Northeast", coords: { lat: 24.8333, lng: 92.7789 }, elevationM: 22, population: 173000, role: "Barak Valley hub · flood-cut access", floodProne: true },
  { name: "Imphal", state: "Manipur", zone: "Northeast", coords: { lat: 24.817, lng: 93.9368 }, elevationM: 786, population: 265000, role: "Manipur capital · NH-2 dependency", hillTerrain: true },
  { name: "Aizawl", state: "Mizoram", zone: "Northeast", coords: { lat: 23.7271, lng: 92.7176 }, elevationM: 1132, population: 293000, role: "Hilltop capital · single-corridor access", hillTerrain: true },
  { name: "Agartala", state: "Tripura", zone: "Northeast", coords: { lat: 23.8315, lng: 91.2868 }, elevationM: 13, population: 400000, role: "Border city · Bangladesh transit trade" },
  { name: "Kohima", state: "Nagaland", zone: "Northeast", coords: { lat: 25.6751, lng: 94.1086 }, elevationM: 1444, population: 99000, role: "Ridge capital · landslide-prone approach", hillTerrain: true },
  { name: "Itanagar", state: "Arunachal Pradesh", zone: "Northeast", coords: { lat: 27.0844, lng: 93.6053 }, elevationM: 440, population: 59000, role: "Arunachal capital in the foothills", hillTerrain: true },
  { name: "Gangtok", state: "Sikkim", zone: "Northeast", coords: { lat: 27.3389, lng: 88.6065 }, elevationM: 1650, population: 100000, role: "Himalayan capital · NH-10 lifeline", hillTerrain: true },
  { name: "Tawang", state: "Arunachal Pradesh", zone: "Northeast", coords: { lat: 27.5861, lng: 91.8594 }, elevationM: 3048, population: 11000, role: "High-altitude border town · Sela pass", hillTerrain: true },
]

export const zones: Zone[] = ["North", "South", "East", "West", "Central", "Northeast"]
