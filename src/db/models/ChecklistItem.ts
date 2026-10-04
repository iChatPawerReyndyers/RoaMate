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
  /** v4: see db/repositories/checklistRepository.ts for why these were added. */
  @text('visibility') visibility?: string;
  @text('owner_user_id') ownerUserId?: string;
  @text('packing_item_category') packingItemCategory?: string;
  @text('store_category') storeCategory?: string;
  @field('quantity') quantity?: number;
  @text('priority') priority?: string;
  @field('synced') synced!: boolean;
}