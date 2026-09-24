import { createMMKV } from 'react-native-mmkv';
import { DEFAULT_MAP_TYPE, isMapType, MapType } from '@/config/mapTiles';

// Same factory pattern as OfflineMapManager / KeyManager (react-native-mmkv v4
// is a Nitro module - no `new MMKV()`).
const storage = createMMKV({ id: 'roamate-map-prefs' });
const KEY = 'mapType';

/** The map view the person last picked; Terrain (the app's original view) if they never chose or the saved value is unreadable. */
export function loadMapType(): MapType {
  try {
    const saved = storage.getString(KEY);
    return isMapType(saved) ? saved : DEFAULT_MAP_TYPE;
  } catch {
    return DEFAULT_MAP_TYPE;
  }
}

export function saveMapType(type: MapType): void {
  try {
    storage.set(KEY, type);
  } catch {
    // Not remembering the choice is fine - the picker still works this session.
  }
}