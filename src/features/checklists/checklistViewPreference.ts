import { createMMKV } from 'react-native-mmkv';
import { ChecklistKind, ChecklistViewKey, defaultView, isViewKey } from './checklistViews';

// Same factory pattern as the map preference (react-native-mmkv v4 is a Nitro module - no `new MMKV()`).
const storage = createMMKV({ id: 'roamate-checklist-prefs' });

const keyFor = (kind: ChecklistKind) => `view.${kind}`;

/** The view last used on this tab; Packing falls back to Category and Grocery to To buy. Remembered separately per tab. */
export function loadChecklistView(kind: ChecklistKind): ChecklistViewKey {
  try {
    const saved = storage.getString(keyFor(kind));
    return isViewKey(saved) ? saved : defaultView(kind);
  } catch {
    return defaultView(kind);
  }
}

export function saveChecklistView(kind: ChecklistKind, view: ChecklistViewKey): void {
  try {
    storage.set(keyFor(kind), view);
  } catch {
    // Not remembering the choice is fine - the switcher still works this session.
  }
}