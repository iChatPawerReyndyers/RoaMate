import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** CHK-02: a user-saved custom checklist template, kept local-only (not synced to the server). */
export default class ChecklistTemplate extends Model {
  static table = 'checklist_templates';

  @text('name') name!: string;
  @text('category') category!: 'PACKING' | 'GROCERY';
  @text('items_json') itemsJson!: string;
  @field('created_at') createdAt!: number;
}
