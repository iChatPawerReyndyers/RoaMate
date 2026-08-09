import { Model } from '@nozbe/watermelondb';
import { field, relation, text } from '@nozbe/watermelondb/decorators';
import type Expense from './Expense';

export default class ExpensePayment extends Model {
  static table = 'expense_payments';
  static associations = {
    expenses: { type: 'belongs_to' as const, key: 'expense_id' },
  };

  @text('expense_id') expenseId!: string;
  @text('source') source!: 'KITTY' | 'MEMBER_ABONO';
  @text('payer_user_id') payerUserId?: string;
  @field('amount_paid_cents') amountPaidCents!: number;

  @relation('expenses', 'expense_id') expense!: Expense;
}
