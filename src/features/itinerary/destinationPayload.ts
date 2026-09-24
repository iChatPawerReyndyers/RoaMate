import type { Destination, DestinationPriority } from './ItineraryScreen';

interface BuildPinPayloadInput {
  tripId: string;
  name: string;
  lat: number;
  lng: number;
  priority: DestinationPriority;
  /** 'YYYY-MM-DD', or null for Unscheduled. */
  assignedDay: string | null;
  /** Whole minutes, or null for "no planned stay". */
  plannedDurationMinutes: number | null;
  /** Set when quick-editing an existing stop; undefined/null for a brand-new pin. */
  editingId?: string | null;
  /** The stop exactly as it was loaded - see the note on buildPinPayload. */
  original?: Destination | null;
}

/**
 * The body POSTed to /api/v1/itinerary/destinations by the map's draft-pin card.
 *
 * PinDestinationRequest is a FULL OVERWRITE on the server (ItineraryService.
 * pinDestination sets every field from the request, so anything omitted becomes
 * null). The card only edits name / priority / day / planned stay, so when
 * editing an existing stop, everything else it carries - notes, address,
 * operating hours, target budget, attachments - has to be handed back
 * unchanged, or every quick edit would silently wipe them.
 */
export function buildPinPayload(input: BuildPinPayloadInput): Record<string, unknown> {
  const { tripId, name, lat, lng, priority, assignedDay, plannedDurationMinutes, editingId, original } = input;
  const preserved =
    editingId && original
      ? {
          notes: original.notes ?? null,
          address: original.address ?? null,
          operatingHours: original.operatingHours ?? null,
          targetBudgetCents: original.targetBudgetCents ?? null,
          attachmentUrls: original.attachmentUrls ?? null,
        }
      : {};

  return {
    ...(editingId ? { id: editingId } : {}),
    tripId,
    name,
    lat,
    lng,
    priority,
    assignedDay,
    plannedDurationMinutes,
    ...preserved,
  };
}