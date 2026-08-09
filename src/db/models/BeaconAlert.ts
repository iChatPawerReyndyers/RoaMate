import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export default class BeaconAlert extends Model {
  static table = 'beacon_alerts';

  @text('trip_id') tripId!: string;
  @text('raised_by_user_id') raisedByUserId!: string;
  @field('lat') lat!: number;
  @field('lng') lng!: number;
  @date('raised_at') raisedAt!: Date;
  @field('acknowledged') acknowledged!: boolean;
  @field('synced') synced!: boolean;
}
