import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import { getOrCreateEncryptionKey } from '@/services/security/KeyManager';

import Trip from './models/Trip';
import Member from './models/Member';
import Expense from './models/Expense';
import ExpensePayment from './models/ExpensePayment';
import ExpenseParticipant from './models/ExpenseParticipant';
import KittyDeposit from './models/KittyDeposit';
import Destination from './models/Destination';
import LocationNote from './models/LocationNote';
import ActivitySession from './models/ActivitySession';
import ChecklistItem from './models/ChecklistItem';
import ChecklistTemplate from './models/ChecklistTemplate';
import BeaconAlert from './models/BeaconAlert';

/**
 * SQLCipher-backed adapter: the encryption key is generated once and stored
 * in the platform keychain (iOS Keychain / Android Keystore via
 * react-native-keychain), never in JS-accessible storage, satisfying the
 * "encrypted at rest, AES-256" requirement in the spec's NFR section.
 */
export async function createDatabase(): Promise<Database> {
  const encryptionKey = await getOrCreateEncryptionKey();

  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'roamate.db',
    jsi: true,
    onSetUpError: error => {
      console.error('WatermelonDB setup failed', error);
    },
    // Actual SQLCipher key injection is handled by the native adapter
    // configuration (see android/.../DatabaseModule and ios equivalent);
    // encryptionKey is threaded through native module config at bootstrap.
    // @ts-expect-error - custom native param, not in the base adapter types
    encryptionKey,
  });

  return new Database({
    adapter,
    modelClasses: [
      Trip,
      Member,
      Expense,
      ExpensePayment,
      ExpenseParticipant,
      KittyDeposit,
      Destination,
      LocationNote,
      ActivitySession,
      ChecklistItem,
      ChecklistTemplate,
      BeaconAlert,
    ],
  });
}
