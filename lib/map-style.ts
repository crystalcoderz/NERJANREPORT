/**
 * Console-style dark Google Maps theme shared by every map surface in the app
 * so the cartography matches the ops dashboard chrome.
 */
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1d23" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d23" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b93a3" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3a3f4b" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#8b93a3" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#20242c" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2f3a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1d23" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3f4b" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1d23" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#c9a95c" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#12151a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
]

/** Marker/overlay colors keyed to the risk tiers used by the network risk model. */
export const riskHex: Record<string, string> = {
  low: "#34d399",
  moderate: "#fbbf24",
  high: "#f87171",
  severe: "#ef4444",
}
