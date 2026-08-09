import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/**
 * v1 -> v2: adds the ITIN-02 destination fields that existed on the backend
 * but were missing locally (address, operating_hours, target_budget_cents,
 * attachment_urls), plus the new checklist_templates table for CHK-02
 * custom template saving. Existing installs migrate in place; nothing here
 * touches existing rows/columns.
 */
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'destinations',
          columns: [
            { name: 'address', type: 'string', isOptional: true },
            { name: 'operating_hours', type: 'string', isOptional: true },
            { name: 'target_budget_cents', type: 'number', isOptional: true },
            { name: 'attachment_urls', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: 'checklist_templates',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'category', type: 'string' },
            { name: 'items_json', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
