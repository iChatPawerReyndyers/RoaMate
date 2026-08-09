import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class ChecklistItem extends Model {
  static table = 'checklist_items';

  @text('server_id') serverId?: string;
  @text('trip_id') tripId!: string;
  @text('category') category!: 'PACKING' | 'GROCERY' | 'CUSTOM';
  @text('label') label!: string;
  @field('checked') checked!: boolean;
  @text('assigned_to_user_id') assignedToUserId?: string;
  @text('converted_expense_id') convertedExpenseId?: string;
  @field('synced') synced!: boolean;
}
