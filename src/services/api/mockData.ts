import { ACTIVE_SCENARIO } from '@/services/api/mockScenarios';

/**
 * Realistic canned responses for every endpoint the app calls, used only
 * when TEST_MODE (see client.ts) is on and the backend genuinely isn't
 * reachable - lets the whole app be clicked through end to end on a phone
 * with no backend running at all. See client.ts's TEST_MODE and
 * ALLOW_TEST_MODE_IN_RELEASE_BUILDS for how that's gated.
 *
 * All the actual data lives in mockScenarios.ts as several complete,
 * swappable scenarios (a fresh empty trip, one with unsettled balances, one
 * with a duplicate-expense conflict to review, etc.) - this file only maps
 * endpoints to whichever scenario is currently active. Change which one is
 * active in mockScenarios.ts (ACTIVE_SCENARIO), not here.
 *
 * Deliberately data, not logic: every handler below returns the active
 * scenario's fixed data, or a trivially-derived value (echoing the request
 * body back). It doesn't simulate real backend behavior - e.g. joinTrip
 * doesn't check the invite code, login doesn't check the password -
 * because the point is to unblock UI/navigation testing, not to stand in
 * for the real API's business rules.
 */

console.warn(`[mock] active scenario: "${ACTIVE_SCENARIO.key}" - ${ACTIVE_SCENARIO.label}`);

function id(prefix: string, n: number | string): string {
  return `${prefix}-${n}`;
}

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
  { method: 'POST', pattern: /^\/api\/v1\/finance\/expenses$/, handler: () => ({ id: id('expense', 'new'), status: 'MOCKED_NOT_PERSISTED' }) },
  { method: 'POST', pattern: /^\/api\/v1\/finance\/kitty-deposits$/, handler: () => ({ id: id('deposit', 'new'), status: 'MOCKED_NOT_PERSISTED' }) },
  { method: 'GET', pattern: /^\/api\/v1\/itinerary\/trips\/[^/]+\/destinations$/, handler: () => ACTIVE_SCENARIO.destinations },
  { method: 'POST', pattern: /^\/api\/v1\/itinerary\/destinations$/, handler: () => ({ id: id('destination', 'new'), status: 'MOCKED_NOT_PERSISTED' }) },
  { method: 'GET', pattern: /^\/api\/v1\/itinerary\/destinations\/[^/]+\/notes$/, handler: () => ACTIVE_SCENARIO.destinationNotes },
  { method: 'GET', pattern: /^\/api\/v1\/activity\/destinations\/[^/]+\/summary$/, handler: () => ACTIVE_SCENARIO.activitySummary },
  { method: 'GET', pattern: /^\/api\/v1\/geo\/trips\/[^/]+\/locations$/, handler: () => ACTIVE_SCENARIO.memberLocations },
  {
    method: 'GET',
    pattern: /^\/api\/v1\/checklists\/trips\/[^/?]+\?category=(PACKING|GROCERY)(&.*)?$/,
    handler: (m) => (m[1] === 'GROCERY' ? ACTIVE_SCENARIO.groceryItems : ACTIVE_SCENARIO.packingItems),
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