/**
 * CHK-05: the pure logic behind the checklist tab's three views - By
 * category / To do and done / By person - plus the "who's in charge" helpers.
 * No React in here, so it's all unit-tested (see __tests__/checklistViews.test.ts).
 */

export type ChecklistKind = 'PACKING' | 'GROCERY';
export type ChecklistViewKey = 'category' | 'todo' | 'people';
export type TodoFilter = 'ALL' | 'MINE' | 'SHARED' | 'PERSONAL';

/** The parts of a checklist item the views need (ChecklistScreen's Item satisfies this). */
export interface ViewItem {
  id: string;
  label: string;
  checked: boolean;
  /** Absent is treated as SHARED. PERSONAL items are only ever returned to their owner, so they're always "mine". */
  visibility?: 'PERSONAL' | 'SHARED';
  assignedToUserId?: string | null;
  packingItemCategory?: 'CLOTHING' | 'ELECTRONICS' | 'TOILETRIES' | 'GEAR' | null;
  storeCategory?: string | null;
}

export interface Member {
  userId: string;
  displayName: string;
}

export interface CategoryOption {
  /** What's stored/sent: a PackingItemCategory name, a store-section string, or null for "Other". */
  value: string | null;
  label: string;
}

export const OTHER_LABEL = 'Other';

export const PACKING_CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'TOILETRIES', label: 'Toiletries' },
  { value: 'GEAR', label: 'Gear' },
  { value: null, label: OTHER_LABEL },
];

/** Grocery store sections are free text on the server, so this is just the built-in starter set. Anything else typed in still gets its own section. */
export const GROCERY_SECTION_OPTIONS: CategoryOption[] = [
  { value: 'Produce', label: 'Produce' },
  { value: 'Dairy', label: 'Dairy' },
  { value: 'Pantry', label: 'Pantry' },
  { value: 'Drinks', label: 'Drinks' },
  { value: null, label: OTHER_LABEL },
];

export function categoryOptionsFor(kind: ChecklistKind): CategoryOption[] {
  return kind === 'GROCERY' ? GROCERY_SECTION_OPTIONS : PACKING_CATEGORY_OPTIONS;
}

/** Wording that differs between the Packing and Grocery tabs. */
export function kindText(kind: ChecklistKind) {
  return kind === 'GROCERY'
    ? { categoryView: 'Section', todoView: 'To buy', categoryNoun: 'Store section', todo: 'To buy', done: 'In cart', progressUnit: 'bought' }
    : { categoryView: 'Category', todoView: 'To do', categoryNoun: 'Category', todo: 'To pack', done: 'Packed', progressUnit: 'packed' };
}

/** Packing opens on Category, Grocery on To buy - store sections start empty until items are sorted. */
export function defaultView(kind: ChecklistKind): ChecklistViewKey {
  return kind === 'GROCERY' ? 'todo' : 'category';
}

export function isViewKey(value: unknown): value is ChecklistViewKey {
  return value === 'category' || value === 'todo' || value === 'people';
}

export function isPersonal(item: ViewItem): boolean {
  return item.visibility === 'PERSONAL';
}

/** The stored category value for an item: a PackingItemCategory name, a trimmed store section, or null. */
export function categoryValueOf(item: ViewItem, kind: ChecklistKind): string | null {
  if (kind === 'PACKING') {
    return item.packingItemCategory ?? null;
  }
  const section = item.storeCategory?.trim();
  return section ? section : null;
}

/** Display text for a stored category value ('CLOTHING' -> 'Clothing', null -> 'Other', 'Meat' -> 'Meat'). */
export function categoryLabelOf(value: string | null, kind: ChecklistKind): string {
  if (value === null) {
    return OTHER_LABEL;
  }
  const known = categoryOptionsFor(kind).find(option => option.value === value);
  if (known) {
    return known.label;
  }
  return kind === 'PACKING' ? value.charAt(0) + value.slice(1).toLowerCase() : value;
}

/** Unchecked first, checked last - each keeping its original relative order (Array#sort is stable). */
export function undoneFirst<T extends ViewItem>(items: T[]): T[] {
  return [...items.filter(i => !i.checked), ...items.filter(i => i.checked)];
}

export interface Section<T extends ViewItem> {
  /** Stable key (category value, user id, or a fixed word) - safe to use as a collapse-state key. */
  key: string;
  title: string;
  /** Present on person sections: null for "Nobody yet". */
  userId?: string | null;
  items: T[];
  doneCount: number;
}

function makeSection<T extends ViewItem>(key: string, title: string, items: T[], userId?: string | null): Section<T> {
  const ordered = undoneFirst(items);
  const section: Section<T> = { key, title, items: ordered, doneCount: ordered.filter(i => i.checked).length };
  if (userId !== undefined) {
    section.userId = userId;
  }
  return section;
}

/**
 * View 1: sections in the built-in order (Clothing, Electronics... / Produce,
 * Dairy...), then any other store sections the server has (alphabetical),
 * then "Other" for items with no category. Empty sections are left out.
 */
export function groupByCategory<T extends ViewItem>(items: T[], kind: ChecklistKind): Section<T>[] {
  const buckets = new Map<string | null, T[]>();
  items.forEach(item => {
    const value = categoryValueOf(item, kind);
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(value, [item]);
    }
  });

  const sections: Section<T>[] = [];
  const knownValues = categoryOptionsFor(kind)
    .map(option => option.value)
    .filter((value): value is string => value !== null);

  knownValues.forEach(value => {
    const bucket = buckets.get(value);
    if (bucket) {
      sections.push(makeSection(value, categoryLabelOf(value, kind), bucket));
    }
  });

  [...buckets.keys()]
    .filter((value): value is string => value !== null && !knownValues.includes(value))
    .sort((a, b) => a.localeCompare(b))
    .forEach(value => {
      sections.push(makeSection(value, categoryLabelOf(value, kind), buckets.get(value) as T[]));
    });

  const uncategorised = buckets.get(null);
  if (uncategorised) {
    sections.push(makeSection('__other__', OTHER_LABEL, uncategorised));
  }
  return sections;
}

/** View 2's filter chips. "Mine" = things I own (personal) or was put in charge of; the rest are as labelled. */
export function matchesFilter(item: ViewItem, filter: TodoFilter, currentUserId: string): boolean {
  switch (filter) {
    case 'MINE':
      return isPersonal(item) || item.assignedToUserId === currentUserId;
    case 'SHARED':
      return !isPersonal(item);
    case 'PERSONAL':
      return isPersonal(item);
    default:
      return true;
  }
}

/** View 2: what's left on top, what's finished folded below. Order within each is preserved. */
export function splitTodoDone<T extends ViewItem>(items: T[], filter: TodoFilter, currentUserId: string): { todo: T[]; done: T[] } {
  const visible = items.filter(item => matchesFilter(item, filter, currentUserId));
  return { todo: visible.filter(i => !i.checked), done: visible.filter(i => i.checked) };
}

/** The name shown for a person: "You" for me, their display name, or a neutral fallback for someone no longer on the trip. */
export function memberName(userId: string | null | undefined, members: Member[], currentUserId: string): string {
  if (!userId) {
    return 'Nobody yet';
  }
  if (userId === currentUserId) {
    return 'You';
  }
  return members.find(m => m.userId === userId)?.displayName || 'Someone else';
}

export const NOBODY_KEY = '__nobody__';
export const UNKNOWN_KEY = '__unknown__';

/**
 * View 3: "who's bringing what". Me first (my personal items always count
 * as mine, plus anything shared I'm in charge of), then the other members in
 * trip order, then assignees who've left the trip, then "Nobody yet".
 */
export function groupByPerson<T extends ViewItem>(items: T[], members: Member[], currentUserId: string): Section<T>[] {
  const mine: T[] = [];
  const byMember = new Map<string, T[]>();
  const unknown: T[] = [];
  const nobody: T[] = [];
  const memberIds = new Set(members.map(m => m.userId));

  items.forEach(item => {
    if (isPersonal(item) || item.assignedToUserId === currentUserId) {
      mine.push(item);
    } else if (!item.assignedToUserId) {
      nobody.push(item);
    } else if (memberIds.has(item.assignedToUserId)) {
      const list = byMember.get(item.assignedToUserId);
      if (list) {
        list.push(item);
      } else {
        byMember.set(item.assignedToUserId, [item]);
      }
    } else {
      unknown.push(item);
    }
  });

  const sections: Section<T>[] = [];
  if (mine.length) {
    sections.push(makeSection(currentUserId, 'You', mine, currentUserId));
  }
  members
    .filter(m => m.userId !== currentUserId)
    .forEach(m => {
      const list = byMember.get(m.userId);
      if (list) {
        sections.push(makeSection(m.userId, m.displayName || 'Someone else', list, m.userId));
      }
    });
  if (unknown.length) {
    sections.push(makeSection(UNKNOWN_KEY, 'Someone else', unknown, null));
  }
  if (nobody.length) {
    sections.push(makeSection(NOBODY_KEY, 'Nobody yet', nobody, null));
  }
  return sections;
}

export function progressOf(items: ViewItem[]): { done: number; total: number; percent: number } {
  const total = items.length;
  const done = items.filter(i => i.checked).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

const AVATAR_COLORS = ['#3D7FE0', '#D9822B', '#3E9B6C', '#8E5BD1', '#C2477B', '#2A9AA8'];

/** The same person always gets the same color (a small string hash into a fixed palette). */
export function avatarColor(userId: string | null | undefined): string {
  if (!userId) {
    return '#C9D0DE';
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 4294967296;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}