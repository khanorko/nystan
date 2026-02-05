/**
 * Reverse geocoding service using OpenStreetMap Nominatim
 * Converts coordinates to human-readable addresses
 */

export interface PlaceDetails {
  street?: string;        // "Möllevångsgatan 12"
  neighbourhood?: string; // "Möllevången"
  city?: string;          // "Malmö"
  country?: string;       // "Sverige"
  raw?: string;           // Full display_name from Nominatim
}

// In-memory cache to avoid repeated API calls for same location
const cache = new Map<string, PlaceDetails>();

/**
 * Convert coordinates to address details using Nominatim
 * Returns null on error (AI can still work with just coordinates)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<PlaceDetails | null> {
  // Use 4 decimal precision for cache key (~11m accuracy)
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  if (cache.has(key)) {
    return cache.get(key)!;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=sv`,
      {
        headers: {
          'User-Agent': 'Nystan/1.0 (kontextlager app)',
        },
      }
    );

    if (!res.ok) {
      console.warn('Geocoding failed:', res.status);
      return null;
    }

    const data = await res.json();

    if (data.error) {
      console.warn('Geocoding error:', data.error);
      return null;
    }

    const address = data.address || {};

    const place: PlaceDetails = {
      street: formatStreet(address),
      neighbourhood: address.suburb || address.neighbourhood || address.quarter,
      city: address.city || address.town || address.village || address.municipality,
      country: address.country,
      raw: data.display_name,
    };

    cache.set(key, place);
    return place;
  } catch (error) {
    console.warn('Geocoding error:', error);
    return null;
  }
}

/**
 * Format street address with house number if available
 */
function formatStreet(address: Record<string, string>): string | undefined {
  const road = address.road;
  const houseNumber = address.house_number;

  if (!road) return undefined;

  return houseNumber ? `${road} ${houseNumber}` : road;
}

/**
 * Build a human-readable location description for AI prompts
 */
export function buildLocationDescription(place: PlaceDetails | null, lat: number, lng: number): string {
  if (!place || (!place.street && !place.city)) {
    return `Koordinater: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  const parts: string[] = [];

  if (place.street) {
    parts.push(`Adress: ${place.street}`);
  }
  if (place.neighbourhood) {
    parts.push(`Kvarter/Område: ${place.neighbourhood}`);
  }
  if (place.city) {
    parts.push(`Stad: ${place.city}`);
  }
  if (place.country && place.country !== 'Sverige') {
    parts.push(`Land: ${place.country}`);
  }
  parts.push(`Koordinater: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

  return parts.join('\n- ');
}
