import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class LocationNote extends Model {
  static table = 'location_notes';

  @text('destination_id') destinationId!: string;
  @text('author_user_id') authorUserId!: string;
  @text('body') body!: string;
  @field('synced') synced!: boolean;
}
