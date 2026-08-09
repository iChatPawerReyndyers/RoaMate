import { Model } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import type Expense from './Expense';

export default class ExpenseParticipant extends Model {
  static table = 'expense_participants';
  static associations = {
    expenses: { type: 'belongs_to' as const, key: 'expense_id' },
  };

  @text('expense_id') expenseId!: string;
  @text('user_id') userId!: string;
  @field('fair_share_cents') fairShareCents!: number;

  @relation('expenses', 'expense_id') expense!: Expense;
}
