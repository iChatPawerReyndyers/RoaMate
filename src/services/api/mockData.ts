import { ACTIVE_SCENARIO } from '@/services/api/mockScenarios';

/**
 * Realistic canned responses for every endpoint the app calls, used only
 * when TEST_MODE (see client.ts) is on and the backend genuinely isn't
 * reachable - lets the whole app be clicked through end to end on a phone
 * with no backend running at all. See client.ts's TEST_MODE and
 * ALLOW_TEST_MODE_IN_RELEASE_BUILDS for how that's gated, and
 * FORCE_MOCK_ONLY for skipping the real network attempt entirely.
 *
 * All the actual data lives in mockScenarios.ts as several complete,
 * swappable scenarios (a fresh empty trip, one with unsettled balances, one
 * with a duplicate-expense conflict to review, etc.) - this file only maps
 * endpoints to whichever scenario is currently active. Change which one is
 * active in mockScenarios.ts (ACTIVE_SCENARIO), not here.
 *
 * Mostly data, not logic: most handlers below just return the active
 * scenario's fixed data, or a trivially-derived value (echoing the request
 * body back). The exception is the three in-memory stores just below
 * (destinations, checklist items, destination notes) - those DO hold a
 * little real mutable state, seeded from the active scenario, so that
 * add/toggle/delete/reorder actually stick for the rest of the session
 * instead of silently reverting on the next screen refresh. Still nothing
 * close to real backend business rules (no validation, no permission
 * checks) - just enough state to make clicking through those flows feel
 * real. Resets to the scenario's original data on every app reload, since
 * it's only ever kept in memory, never persisted to disk.
 */

console.warn(`[mock] active scenario: "${ACTIVE_SCENARIO.key}" - ${ACTIVE_SCENARIO.label}`);

function id(prefix: string, n: number | string): string {
  return `${prefix}-${n}`;
}

type MockRecord = Record<string, unknown> & { id: string };

// --- in-memory stores, reset on every app reload -----------------------

let destinationsStore: MockRecord[] = (ACTIVE_SCENARIO.destinations as MockRecord[]).map(d => ({ ...d }));

const checklistStore: { PACKING: MockRecord[]; GROCERY: MockRecord[] } = {
  PACKING: (ACTIVE_SCENARIO.packingItems as MockRecord[]).map(i => ({ ...i })),
  GROCERY: (ACTIVE_SCENARIO.groceryItems as MockRecord[]).map(i => ({ ...i })),
};

const notesStore: Record<string, MockRecord[]> = {
  // Seed every scenario destination with the scenario's canned notes, keyed
  // by destination id, so DestinationNotesScreen has something to show
  // right away rather than only after the first note is added.
  ...Object.fromEntries(destinationsStore.map(d => [d.id, (ACTIVE_SCENARIO.destinationNotes as MockRecord[]).map(n => ({ ...n }))])),
};

interface MockRoute {
  method: string;
  pattern: RegExp;
  handler: (match: RegExpMatchArray, body: unknown) => unknown;
}

const routes: MockRoute[] = [
  {
    method: 'POST',
    pattern: /^\/api\/v1\/auth\/(login|register)$/,
    handler: (_m, body) => {
      const { username } = (body as { username?: string }) ?? {};
      return {
        accessToken: 'mock-token-do-not-use-in-production',
        tokenType: 'Bearer',
        expiresInSeconds: 3600,
        userId: ACTIVE_SCENARIO.trip.members[0]?.userId ?? 'mock-user-1',
        username: username ?? 'You',
      };
    },
  },
  { method: 'GET', pattern: /^\/api\/v1\/trips$/, handler: () => [ACTIVE_SCENARIO.trip] },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/trips$/,
    handler: (_m, body) => {
      const requested = (body as { name?: string; defaultCurrency?: string }) ?? {};
      return { ...ACTIVE_SCENARIO.trip, name: requested.name ?? ACTIVE_SCENARIO.trip.name, defaultCurrency: requested.defaultCurrency ?? ACTIVE_SCENARIO.trip.defaultCurrency };
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/trips\/join$/,
    handler: () => ({
      id: ACTIVE_SCENARIO.trip.id,
      inviteCode: ACTIVE_SCENARIO.trip.inviteCode,
      name: ACTIVE_SCENARIO.trip.name,
      defaultCurrency: ACTIVE_SCENARIO.trip.defaultCurrency,
    }),
  },
  { method: 'GET', pattern: /^\/api\/v1\/trips\/[^/]+\/members$/, handler: () => ACTIVE_SCENARIO.trip.members },
  { method: 'GET', pattern: /^\/api\/v1\/finance\/trips\/[^/]+\/settlement$/, handler: () => ACTIVE_SCENARIO.settlement },
  { method: 'GET', pattern: /^\/api\/v1\/finance\/trips\/[^/]+\/expenses$/, handler: () => ACTIVE_SCENARIO.expenses },
  { method: 'GET', pattern: /^\/api\/v1\/finance\/trips\/[^/]+\/duplicates$/, handler: () => ACTIVE_SCENARIO.duplicates },
  { method: 'GET', pattern: /^\/api\/v1\/finance\/trips\/[^/]+\/kitty-deposits$/, handler: () => ACTIVE_SCENARIO.kittyDeposits },
  { method: 'POST', pattern: /^\/api\/v1\/finance\/expenses$/, handler: () => ({ id: id('expense', Date.now()), status: 'MOCKED_NOT_PERSISTED' }) },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/finance\/expenses\/[^/]+\/resolve-duplicate(\?.*)?$/,
    handler: () => ({ status: 'MOCKED_NOT_PERSISTED' }),
  },
  { method: 'POST', pattern: /^\/api\/v1\/finance\/kitty-deposits$/, handler: () => ({ id: id('deposit', Date.now()), status: 'MOCKED_NOT_PERSISTED' }) },

  // --- Itinerary destinations: backed by destinationsStore so pin/edit/reorder/remove all stick for the session ---
  { method: 'GET', pattern: /^\/api\/v1\/itinerary\/trips\/[^/]+\/destinations$/, handler: () => destinationsStore },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/itinerary\/destinations$/,
    handler: (_m, body) => {
      const payload = (body as Record<string, unknown>) ?? {};
      // Upsert by id: both EditDestinationRoute (full edit screen) and
      // MapScreen's quick map-based edit send an existing destination's id
      // in the payload when updating, expecting this endpoint to update
      // that record in place - not append a second, duplicate destination
      // alongside the original.
      if (typeof payload.id === 'string') {
        const index = destinationsStore.findIndex(d => d.id === payload.id);
        if (index !== -1) {
          const updated: MockRecord = { ...destinationsStore[index], ...payload, id: payload.id };
          destinationsStore = [...destinationsStore.slice(0, index), updated, ...destinationsStore.slice(index + 1)];
          return updated;
        }
      }
      const created: MockRecord = { id: id('destination', Date.now()), name: 'New destination', priority: 'REQUIRED', ...payload };
      destinationsStore = [...destinationsStore, created];
      notesStore[created.id] = [];
      return created;
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/itinerary\/destinations\/reorder$/,
    handler: (_m, body) => {
      const orderedIds = (body as string[]) ?? [];
      const byId = new Map(destinationsStore.map(d => [d.id, d]));
      const reordered = orderedIds.map(destId => byId.get(destId)).filter((d): d is MockRecord => d !== undefined);
      // Keep any destinations the caller didn't mention (shouldn't normally
      // happen) rather than silently dropping them.
      const remaining = destinationsStore.filter(d => !orderedIds.includes(d.id));
      destinationsStore = [...reordered, ...remaining];
      return { status: 'MOCKED_NOT_PERSISTED' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/v1\/itinerary\/destinations\/([^/]+)$/,
    handler: m => {
      const destinationId = m[1] ?? '';
      destinationsStore = destinationsStore.filter(d => d.id !== destinationId);
      delete notesStore[destinationId];
      return undefined;
    },
  },

  // --- Destination notes: backed by notesStore, keyed by destination id ---
  {
    method: 'GET',
    pattern: /^\/api\/v1\/itinerary\/destinations\/([^/]+)\/notes$/,
    handler: m => notesStore[m[1] ?? ''] ?? [],
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/itinerary\/notes$/,
    handler: (_m, body) => {
      const payload = (body as { destinationId?: string; authorUserId?: string; body?: string }) ?? {};
      const destinationId = payload.destinationId ?? '';
      const created: MockRecord = {
        id: id('note', Date.now()),
        authorUserId: payload.authorUserId ?? 'mock-user-1',
        body: payload.body ?? '',
        createdAt: new Date().toISOString(),
      };
      notesStore[destinationId] = [...(notesStore[destinationId] ?? []), created];
      return created;
    },
  },

  { method: 'GET', pattern: /^\/api\/v1\/activity\/destinations\/[^/]+\/summary$/, handler: () => ACTIVE_SCENARIO.activitySummary },
  { method: 'GET', pattern: /^\/api\/v1\/geo\/trips\/[^/]+\/locations$/, handler: () => ACTIVE_SCENARIO.memberLocations },
  { method: 'POST', pattern: /^\/api\/v1\/geo\/beacons$/, handler: () => ({ status: 'MOCKED_NOT_PERSISTED' }) },
  { method: 'POST', pattern: /^\/api\/v1\/push\/device-tokens\/unregister$/, handler: () => ({ status: 'MOCKED_NOT_PERSISTED' }) },

  // --- Checklists: backed by checklistStore, keyed by PACKING/GROCERY ---
  {
    method: 'GET',
    pattern: /^\/api\/v1\/checklists\/trips\/[^/?]+\?category=(PACKING|GROCERY)(&.*)?$/,
    handler: m => checklistStore[(m[1] as 'PACKING' | 'GROCERY' | undefined) ?? 'PACKING'],
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/checklists\/items$/,
    handler: (_m, body) => {
      const payload = (body as Record<string, unknown>) ?? {};
      const category: 'PACKING' | 'GROCERY' = payload.category === 'GROCERY' ? 'GROCERY' : 'PACKING';
      const created: MockRecord = {
        id: id('item', Date.now()),
        checked: false,
        visibility: 'SHARED',
        ...payload,
      };
      checklistStore[category] = [...checklistStore[category], created];
      return created;
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/v1\/checklists\/items\/([^/]+)\/toggle$/,
    handler: m => {
      const itemId = m[1] ?? '';
      for (const category of ['PACKING', 'GROCERY'] as const) {
        const list = checklistStore[category];
        const index = list.findIndex(item => item.id === itemId);
        if (index !== -1) {
          const current = list[index]!;
          const updated: MockRecord = { ...current, checked: !current.checked };
          checklistStore[category] = [...list.slice(0, index), updated, ...list.slice(index + 1)];
          return updated;
        }
      }
      // Item not found in either store (shouldn't normally happen) - still
      // return something toggle-shaped rather than throwing, since the
      // caller only reads .checked off the response.
      return { id: itemId, checked: true };
    },
  },
];

/**
 * Returns mocked data for a given method+path, or undefined if nothing
 * matches - callers should let the real NetworkUnavailableError propagate
 * in that case rather than fabricating a response for an endpoint this
 * file doesn't know about yet.
 */
export function resolveMockResponse(method: string, path: string, body?: unknown): { data: unknown } | undefined {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = path.match(route.pattern);
    if (match) return { data: route.handler(match, body) };
  }
  return undefined;
}