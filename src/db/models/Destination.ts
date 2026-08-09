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
  @field('synced') synced!: boolean;
}
