/**
 * Multiple full mock datasets ("scenarios") for testing the app on a real
 * device with no backend deployed yet. Each scenario is a complete,
 * internally-consistent snapshot of one trip - switch ACTIVE_SCENARIO in
 * mockData.ts to see the app in a different state without touching a
 * server. For process only, same as mockData.ts itself: nothing here is
 * meant to simulate real backend business logic, just give every screen
 * something believable to render.
 *
 * Add a new scenario by copying one of these and changing what's
 * interesting about it - mockData.ts's routes read generically from
 * whichever scenario is active, so a new one needs no other code changes.
 */

const MOCK_USER_ID = 'mock-user-1';

/**
 * TRIP-02: role strings must match the backend's real TripRole enum
 * (OWNER, CO_ORGANIZER, MEMBER) - not arbitrary strings. ItineraryContainer's
 * own admin check is `new Set(['OWNER', 'CO_ORGANIZER'])`; anything else
 * silently evaluates as non-admin, which is exactly what happened here
 * before this was caught (role: 'ADMIN' matched neither the real backend
 * nor the frontend's own check, so itinerary edit controls never showed
 * up while testing with mock data).
 */
function tripMembers(displayName: string, tripId: string) {
  return [
    { id: `member-${tripId}-1`, tripId, userId: MOCK_USER_ID, displayName, role: 'OWNER' },
    { id: `member-${tripId}-2`, tripId, userId: 'mock-user-2', displayName: 'Jamie (mock)', role: 'MEMBER' },
    { id: `member-${tripId}-3`, tripId, userId: 'mock-user-3', displayName: 'Alex (mock)', role: 'MEMBER' },
  ];
}

export interface MockScenario {
  key: string;
  /** Shown in a console.warn when the app starts, so it's obvious from Metro logs which scenario is active. */
  label: string;
  trip: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    inviteCode: string;
    inviteSecret: string;
    defaultCurrency: string;
    members: ReturnType<typeof tripMembers>;
  };
  expenses: unknown[];
  settlement: { tripId: string; balances: unknown[]; suggestedTransfers: unknown[] };
  duplicates: { expenses: unknown[] }[];
  destinations: unknown[];
  destinationNotes: unknown[];
  packingItems: unknown[];
  groceryItems: unknown[];
  kittyDeposits: unknown[];
  memberLocations: unknown[];
  activitySummary: { totalDistanceMeters: number; totalElevationGainMeters: number; totalSteps: number; sessionCount: number };
}

/**
 * "active" - a trip that's already a couple days in: some expenses logged,
 * balances unsettled, itinerary partly planned, a mixed packing/grocery
 * list. The general-purpose default for clicking through most screens.
 */
const active: MockScenario = {
  key: 'active',
  label: 'Active trip, mid-way through, unsettled balances',
  trip: {
    id: 'mock-trip-active',
    name: 'Baguio Weekend (Mock)',
    startDate: '2026-09-04',
    endDate: '2026-09-07',
    inviteCode: 'MOCK01',
    inviteSecret: 'mock0000000000000000000000000000000000000000000000000000000000',
    defaultCurrency: 'PHP',
    members: tripMembers('You', 'mock-trip-active'),
  },
  expenses: [
    {
      id: 'expense-1',
      description: 'Van rental to Baguio',
      totalAmountCents: 450000,
      expenseDate: '2026-09-04T09:00:00Z',
      category: 'Transport',
      createdByUserId: MOCK_USER_ID,
      flaggedDuplicate: false,
      payments: [{ source: 'MEMBER_ABONO', payerUserId: MOCK_USER_ID, amountPaidCents: 450000 }],
      participants: [
        { userId: MOCK_USER_ID, fairShareCents: 150000 },
        { userId: 'mock-user-2', fairShareCents: 150000 },
        { userId: 'mock-user-3', fairShareCents: 150000 },
      ],
    },
    {
      id: 'expense-2',
      description: 'Airbnb - 2 nights',
      totalAmountCents: 600000,
      expenseDate: '2026-09-04T14:00:00Z',
      category: 'Lodging',
      createdByUserId: 'mock-user-2',
      flaggedDuplicate: false,
      payments: [{ source: 'KITTY', amountPaidCents: 600000 }],
      participants: [
        { userId: MOCK_USER_ID, fairShareCents: 200000 },
        { userId: 'mock-user-2', fairShareCents: 200000 },
        { userId: 'mock-user-3', fairShareCents: 200000 },
      ],
    },
  ],
  settlement: {
    tripId: 'mock-trip-active',
    balances: [
      { userId: MOCK_USER_ID, totalPaidCents: 450000, totalFairShareCents: 350000, netDeltaCents: 100000 },
      { userId: 'mock-user-2', totalPaidCents: 0, totalFairShareCents: 350000, netDeltaCents: -350000 },
      { userId: 'mock-user-3', totalPaidCents: 0, totalFairShareCents: 350000, netDeltaCents: -350000 },
    ],
    suggestedTransfers: [
      { fromUserId: 'mock-user-2', toUserId: MOCK_USER_ID, amountCents: 100000 },
      { fromUserId: 'mock-user-3', toUserId: MOCK_USER_ID, amountCents: 250000 },
    ],
  },
  duplicates: [],
  destinations: [
    { id: 'destination-1', name: 'Burnham Park', notes: 'Bike rentals near the lagoon', assignedDay: '2026-09-05', lat: 16.4113, lng: 120.5943 },
    { id: 'destination-2', name: 'Session Road', notes: 'Good for night market food', assignedDay: '2026-09-05', lat: 16.4139, lng: 120.5936 },
    { id: 'destination-3', name: 'Mines View Park', notes: undefined, assignedDay: '2026-09-06', lat: 16.4275, lng: 120.6303 },
  ],
  destinationNotes: [{ id: 'note-1', authorUserId: 'mock-user-2', body: 'Great sunset spot around 5:30pm.' }],
  packingItems: [
    { id: 'item-1', label: 'Jacket', checked: false, visibility: 'PERSONAL' },
    { id: 'item-2', label: 'Power bank', checked: true, visibility: 'SHARED', assignedToUserId: MOCK_USER_ID },
    { id: 'item-3', label: 'First aid kit', checked: false, visibility: 'SHARED' },
  ],
  groceryItems: [
    { id: 'item-4', label: 'Bottled water', checked: false, visibility: 'SHARED', quantity: 6, priority: 'HIGH', storeCategory: 'Beverages' },
    { id: 'item-5', label: 'Instant coffee', checked: false, visibility: 'SHARED', quantity: 1, priority: 'MEDIUM', storeCategory: 'Beverages' },
  ],
  kittyDeposits: [{ id: 'deposit-1', depositorUserId: MOCK_USER_ID, amount: 6000 }],
  memberLocations: [{ userId: 'mock-user-2', lat: 16.4113, lng: 120.5943, capturedAt: new Date().toISOString(), stale: false }],
  activitySummary: { totalDistanceMeters: 3200, totalElevationGainMeters: 140, totalSteps: 4300, sessionCount: 2 },
};

/**
 * "freshTrip" - a trip that was just created, nothing logged yet. Tests
 * every screen's empty state at once: no expenses (FinanceSummaryScreen's
 * zero-balance path), no destinations (ItineraryHub's empty prompt), no
 * checklist items (TemplatePicker should show instead of a list), no
 * member locations (MapScreen's "No member locations shared yet" banner).
 */
const freshTrip: MockScenario = {
  key: 'freshTrip',
  label: 'Brand new trip, nothing logged yet - tests empty states',
  trip: {
    id: 'mock-trip-fresh',
    name: 'Palawan Trip (Mock)',
    startDate: '2026-11-10',
    endDate: '2026-11-14',
    inviteCode: 'MOCK02',
    inviteSecret: 'mock1111111111111111111111111111111111111111111111111111111111',
    defaultCurrency: 'PHP',
    members: tripMembers('You', 'mock-trip-fresh'),
  },
  expenses: [],
  settlement: {
    tripId: 'mock-trip-fresh',
    balances: [
      { userId: MOCK_USER_ID, totalPaidCents: 0, totalFairShareCents: 0, netDeltaCents: 0 },
      { userId: 'mock-user-2', totalPaidCents: 0, totalFairShareCents: 0, netDeltaCents: 0 },
      { userId: 'mock-user-3', totalPaidCents: 0, totalFairShareCents: 0, netDeltaCents: 0 },
    ],
    suggestedTransfers: [],
  },
  duplicates: [],
  destinations: [],
  destinationNotes: [],
  packingItems: [],
  groceryItems: [],
  kittyDeposits: [],
  memberLocations: [],
  activitySummary: { totalDistanceMeters: 0, totalElevationGainMeters: 0, totalSteps: 0, sessionCount: 0 },
};

/**
 * "settledUp" - same expenses as `active`, but balances reflect that
 * everyone already paid each other back outside the app (a real, reachable
 * state - settling up doesn't have to happen through RoaMate). Tests the
 * "Everyone is already settled up" copy and a zeroed-out balance list
 * without needing an empty trip to do it.
 */
const settledUp: MockScenario = {
  ...active,
  key: 'settledUp',
  label: 'Expenses exist, but everyone is already settled up',
  trip: { ...active.trip, id: 'mock-trip-settled', name: 'Baguio Weekend (Mock, Settled)', members: tripMembers('You', 'mock-trip-settled') },
  settlement: {
    tripId: 'mock-trip-settled',
    balances: [
      { userId: MOCK_USER_ID, totalPaidCents: 350000, totalFairShareCents: 350000, netDeltaCents: 0 },
      { userId: 'mock-user-2', totalPaidCents: 350000, totalFairShareCents: 350000, netDeltaCents: 0 },
      { userId: 'mock-user-3', totalPaidCents: 350000, totalFairShareCents: 350000, netDeltaCents: 0 },
    ],
    suggestedTransfers: [],
  },
};

/**
 * "duplicatesPending" - has an unresolved flagged-duplicate pair sitting
 * in the Conflict Review Dashboard (FIN-07/08): two near-identical
 * "Boat transfer" charges logged 6 minutes apart, matching the backend's
 * actual 5-10 minute detection window.
 */
const duplicatesPending: MockScenario = {
  ...active,
  key: 'duplicatesPending',
  label: 'Has an unresolved duplicate-expense pair to review',
  trip: { ...active.trip, id: 'mock-trip-duplicates', name: 'Baguio Weekend (Mock, Duplicates)', members: tripMembers('You', 'mock-trip-duplicates') },
  expenses: [
    ...active.expenses,
    {
      id: 'expense-dup-1',
      description: 'Boat transfer',
      totalAmountCents: 80000,
      expenseDate: '2026-09-05T10:00:00Z',
      category: 'Transport',
      createdByUserId: MOCK_USER_ID,
      flaggedDuplicate: true,
      payments: [{ source: 'MEMBER_ABONO', payerUserId: MOCK_USER_ID, amountPaidCents: 80000 }],
      participants: [
        { userId: MOCK_USER_ID, fairShareCents: 40000 },
        { userId: 'mock-user-2', fairShareCents: 40000 },
      ],
    },
    {
      id: 'expense-dup-2',
      description: 'Boat transfer',
      totalAmountCents: 80000,
      expenseDate: '2026-09-05T10:06:00Z',
      category: 'Transport',
      createdByUserId: 'mock-user-2',
      flaggedDuplicate: true,
      payments: [{ source: 'MEMBER_ABONO', payerUserId: 'mock-user-2', amountPaidCents: 80000 }],
      participants: [
        { userId: MOCK_USER_ID, fairShareCents: 40000 },
        { userId: 'mock-user-2', fairShareCents: 40000 },
      ],
    },
  ],
  duplicates: [
    {
      expenses: [
        { id: 'expense-dup-1', description: 'Boat transfer', totalAmountCents: 80000, expenseDateIso: '2026-09-05T10:00:00Z', createdByUserId: MOCK_USER_ID, deleted: false },
        { id: 'expense-dup-2', description: 'Boat transfer', totalAmountCents: 80000, expenseDateIso: '2026-09-05T10:06:00Z', createdByUserId: 'mock-user-2', deleted: false },
      ],
    },
  ],
};

export const scenarios: Record<string, MockScenario> = {
  active,
  freshTrip,
  settledUp,
  duplicatesPending,
};

/**
 * Change this to switch which scenario the whole app sees. Every screen
 * that reads from mockData.ts's routes will reflect whichever one is
 * active next time you reload - no other code changes needed.
 *
 * Assigned directly from one of the scenario constants above (not by
 * indexing the `scenarios` record below) - indexing a Record's value type
 * includes `| undefined` under this project's noUncheckedIndexedAccess
 * tsconfig setting, even for a literal key that's provably present.
 */
export const ACTIVE_SCENARIO: MockScenario = active;
// export const ACTIVE_SCENARIO: MockScenario = freshTrip;
// export const ACTIVE_SCENARIO: MockScenario = settledUp;
// export const ACTIVE_SCENARIO: MockScenario = duplicatesPending;