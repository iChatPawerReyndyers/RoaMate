/**
 * GEO-05: a distinct color per itinerary leg (1st->2nd, 2nd->3rd, ...), so a
 * multi-stop route reads as separate legs rather than one long gray line.
 * Cycles through ROUTE_LEG_COLORS if there are more legs than colors -
 * two far-apart legs could then share a color, but they're never adjacent
 * on the map so that's not confusable in practice.
 *
 * Deliberately a different palette from the destination-priority colors
 * (navy/gray/purple in MapScreen's destinationPinStyle) so the two color
 * systems - "how important is this stop" vs. "which leg is this" - don't
 * bleed into each other.
 */
export const ROUTE_LEG_COLORS: readonly string[] = [
  '#3D7FE0', // blue
  '#3E9B6C', // green
  '#D9822B', // orange
  '#8E5BD1', // purple
  '#C2477B', // pink
  '#2A9AA8', // teal
  '#B5A130', // olive
  '#B5563C', // brick
];

export function routeLegColor(index: number): string {
  const color = ROUTE_LEG_COLORS[index % ROUTE_LEG_COLORS.length];
  return color ?? (ROUTE_LEG_COLORS[0] as string);
}

export interface LegLabelInput {
  fromId: string;
  toId: string;
}

/** "1 · Burnham Park → Session Rd" - falls back to a short id when a stop's name isn't available (e.g. it was removed after the route was fetched). */
export function legLabel(index: number, segment: LegLabelInput, nameOf: (id: string) => string | undefined): string {
  const fromName = nameOf(segment.fromId) ?? `Stop ${segment.fromId.slice(0, 4)}`;
  const toName = nameOf(segment.toId) ?? `Stop ${segment.toId.slice(0, 4)}`;
  return `${index + 1} · ${fromName} → ${toName}`;
}

export interface DestinationForLegColor {
  id: string;
  lat?: number;
  lng?: number;
}

/**
 * GEO-05/ITIN-07: which leg color "belongs to" each destination, for the
 * Itinerary tab's underline (see PinnedLocationCard). Mirrors exactly how
 * MapScreen builds its routed legs: only destinations with coordinates
 * count, in array order, and a leg runs from the i-th such destination to
 * the (i+1)-th - so this returns the SAME color a stop's outgoing leg has
 * on the map, with no need to fetch a route to compute it (it's index-only).
 * A destination with no coordinates, or the last destination-with-coordinates
 * (nothing leaves it), has no entry in the returned map.
 */
export function legColorByDestinationId(destinations: DestinationForLegColor[]): Map<string, string> {
  const withCoords = destinations.filter(d => d.lat !== undefined && d.lng !== undefined);
  const colors = new Map<string, string>();
  for (let i = 0; i < withCoords.length - 1; i += 1) {
    const stop = withCoords[i];
    if (stop) {
      colors.set(stop.id, routeLegColor(i));
    }
  }
  return colors;
}

export interface StopGradient {
  /** null for the trip's first routed stop - nothing comes before it, so it's drawn solid rather than as a gradient. */
  fromColor: string | null;
  /** This stop's own color - always set. */
  toColor: string;
}

/**
 * ITIN-07 v2: each routed destination gets its OWN fixed color (stop i's
 * color is routeLegColor(i) - same palette as the map's legs, just indexed
 * by stop position instead of leg position), and its underline is a
 * gradient from the PREVIOUS stop's color into its own - "arriving from
 * there, now here". The first stop has no previous color, so it's solid.
 *
 * This replaces legColorByDestinationId's "color of the leg leaving this
 * stop" scheme, which left the trip's last stop with no color at all
 * (nothing leaves it). Every routed stop gets an entry here, including the
 * last one. A destination with no coordinates still gets no entry, same as
 * before - it never had a position in the route to draw from.
 */
export function stopGradientByDestinationId(destinations: DestinationForLegColor[]): Map<string, StopGradient> {
  const withCoords = destinations.filter(d => d.lat !== undefined && d.lng !== undefined);
  const gradients = new Map<string, StopGradient>();
  withCoords.forEach((stop, i) => {
    gradients.set(stop.id, {
      fromColor: i === 0 ? null : routeLegColor(i - 1),
      toColor: routeLegColor(i),
    });
  });
  return gradients;
}