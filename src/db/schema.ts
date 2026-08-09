import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Local-first schema (WatermelonDB over SQLite, encrypted at rest via
 * SQLCipher - see services/security/KeyManager.ts). Mirrors the backend's
 * Flyway schema field-for-field so sync mapping stays mechanical rather
 * than requiring translation logic.
 */
export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'trips',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'start_date', type: 'string', isOptional: true },
        { name: 'end_date', type: 'string', isOptional: true },
        { name: 'invite_code', type: 'string' },
        { name: 'default_currency', type: 'string' },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'members',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        { name: 'display_name', type: 'string' },
        { name: 'role', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'total_amount_cents', type: 'number' },
        { name: 'expense_date', type: 'number' },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'created_by_user_id', type: 'string' },
        { name: 'flagged_duplicate', type: 'boolean' },
        { name: 'synced', type: 'boolean' },
        { name: 'deleted', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'expense_payments',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'source', type: 'string' }, // KITTY | MEMBER_ABONO
        { name: 'payer_user_id', type: 'string', isOptional: true },
        { name: 'amount_paid_cents', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'expense_participants',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        { name: 'fair_share_cents', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'kitty_deposits',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'depositor_user_id', type: 'string' },
        { name: 'amount_cents', type: 'number' },
        { name: 'deposited_at', type: 'number' },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'destinations',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lng', type: 'number', isOptional: true },
        { name: 'assigned_day', type: 'string', isOptional: true },
        { name: 'sort_order', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'address', type: 'string', isOptional: true },
        { name: 'operating_hours', type: 'string', isOptional: true },
        { name: 'target_budget_cents', type: 'number', isOptional: true },
        { name: 'attachment_urls', type: 'string', isOptional: true },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'location_notes',
      columns: [
        { name: 'destination_id', type: 'string', isIndexed: true },
        { name: 'author_user_id', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'activity_sessions',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        { name: 'type', type: 'string' }, // WALKING | MOUNTAIN_ELEVATION | CAVE_DEPTH
        { name: 'step_count', type: 'number', isOptional: true },
        { name: 'distance_meters', type: 'number', isOptional: true },
        { name: 'elevation_gain_meters', type: 'number', isOptional: true },
        { name: 'relative_depth_meters', type: 'number', isOptional: true },
        { name: 'destination_id', type: 'string', isOptional: true },
        { name: 'started_at', type: 'number' },
        { name: 'last_batch_at', type: 'number' },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'checklist_items',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string' },
        { name: 'label', type: 'string' },
        { name: 'checked', type: 'boolean' },
        { name: 'assigned_to_user_id', type: 'string', isOptional: true },
        { name: 'converted_expense_id', type: 'string', isOptional: true },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'beacon_alerts',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'raised_by_user_id', type: 'string' },
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
        { name: 'raised_at', type: 'number' },
        { name: 'acknowledged', type: 'boolean' },
        { name: 'synced', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'checklist_templates',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' }, // PACKING | GROCERY
        { name: 'items_json', type: 'string' }, // JSON string array of item labels
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'event_queue',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'event_type', type: 'string' },
        { name: 'client_timestamp', type: 'number' },
        { name: 'payload_json', type: 'string' },
        { name: 'uploaded', type: 'boolean', isIndexed: true },
      ],
    }),
  ],
});
