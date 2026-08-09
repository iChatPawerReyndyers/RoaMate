import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export default class ActivitySession extends Model {
  static table = 'activity_sessions';

  @text('trip_id') tripId!: string;
  @text('user_id') userId!: string;
  @text('type') type!: 'WALKING' | 'MOUNTAIN_ELEVATION' | 'CAVE_DEPTH';
  @field('step_count') stepCount?: number;
  @field('distance_meters') distanceMeters?: number;
  @field('elevation_gain_meters') elevationGainMeters?: number;
  @field('relative_depth_meters') relativeDepthMeters?: number;
  @text('destination_id') destinationId?: string;
  @date('started_at') startedAt!: Date;
  @date('last_batch_at') lastBatchAt!: Date;
  @field('synced') synced!: boolean;
}
