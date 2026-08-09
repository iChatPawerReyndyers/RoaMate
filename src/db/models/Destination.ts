import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Destination extends Model {
  static table = 'destinations';

  @text('server_id') serverId?: string;
  @text('trip_id') tripId!: string;
  @text('name') name!: string;
  @field('lat') lat?: number;
  @field('lng') lng?: number;
  @text('assigned_day') assignedDay?: string;
  @field('sort_order') sortOrder!: number;
  @text('notes') notes?: string;
  @text('address') address?: string;
  @text('operating_hours') operatingHours?: string;
  @field('target_budget_cents') targetBudgetCents?: number;
  @text('attachment_urls') attachmentUrls?: string;
  @field('synced') synced!: boolean;
}
