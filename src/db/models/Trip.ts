import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Trip extends Model {
  static table = 'trips';

  @text('server_id') serverId!: string;
  @text('name') name!: string;
  @text('start_date') startDate?: string;
  @text('end_date') endDate?: string;
  @text('invite_code') inviteCode!: string;
  @text('default_currency') defaultCurrency!: string;
  @field('synced') synced!: boolean;
}
