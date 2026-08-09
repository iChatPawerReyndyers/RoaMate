import { Model, Query } from '@nozbe/watermelondb';
import { children, date, field, text } from '@nozbe/watermelondb/decorators';
import type ExpensePayment from './ExpensePayment';
import type ExpenseParticipant from './ExpenseParticipant';

export default class Expense extends Model {
  static table = 'expenses';
  static associations = {
    expense_payments: { type: 'has_many' as const, foreignKey: 'expense_id' },
    expense_participants: { type: 'has_many' as const, foreignKey: 'expense_id' },
  };

  @text('server_id') serverId?: string;
  @text('trip_id') tripId!: string;
  @text('description') description!: string;
  @field('total_amount_cents') totalAmountCents!: number;
  @date('expense_date') expenseDate!: Date;
  @text('category') category?: string;
  @text('created_by_user_id') createdByUserId!: string;
  @field('flagged_duplicate') flaggedDuplicate!: boolean;
  @field('synced') synced!: boolean;
  @field('deleted') deleted!: boolean;

  @children('expense_payments') payments!: Query<ExpensePayment>;
  @children('expense_participants') participants!: Query<ExpenseParticipant>;
}
