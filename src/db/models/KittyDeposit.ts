import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export default class KittyDeposit extends Model {
  static table = 'kitty_deposits';

  @text('server_id') serverId?: string;
  @text('trip_id') tripId!: string;
  @text('depositor_user_id') depositorUserId!: string;
  @field('amount_cents') amountCents!: number;
  @date('deposited_at') depositedAt!: Date;
  @field('synced') synced!: boolean;
}
