import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export default class Member extends Model {
  static table = 'members';

  @text('server_id') serverId!: string;
  @text('trip_id') tripId!: string;
  @text('user_id') userId!: string;
  @text('display_name') displayName!: string;
  @text('role') role!: 'OWNER' | 'CO_ORGANIZER' | 'MEMBER';
}
