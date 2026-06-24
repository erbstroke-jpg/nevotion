"""Finance, Payroll, Debt tables + Deal commissions + Server lead_id

Revision ID: 010
Revises: 009
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # ── deal commission fields ──────────────────────────────────────
    op.add_column('deals', sa.Column('setter_commission', sa.Integer, server_default='0', nullable=False))
    op.add_column('deals', sa.Column('closer_commission', sa.Integer, server_default='0', nullable=False))

    # ── server → lead link ─────────────────────────────────────────
    op.add_column('servers', sa.Column(
        'lead_id', sa.Integer,
        sa.ForeignKey('leads.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_servers_lead_id', 'servers', ['lead_id'])

    # ── finance_transactions ───────────────────────────────────────
    op.create_table(
        'finance_transactions',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('type', sa.String(20), nullable=False),              # income | expense
        sa.Column('category', sa.String(120), nullable=True),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('related_lead_id', sa.Integer,
                  sa.ForeignKey('leads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('related_deal_id', sa.Integer,
                  sa.ForeignKey('deals.id', ondelete='SET NULL'), nullable=True),
        sa.Column('account_id', sa.Integer,
                  sa.ForeignKey('accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('responsible_id', sa.Integer,
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('payment_method', sa.String(120), server_default='', nullable=False),
        sa.Column('comment', sa.Text, server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ft_related_lead_id', 'finance_transactions', ['related_lead_id'])
    op.create_index('ix_ft_related_deal_id', 'finance_transactions', ['related_deal_id'])
    op.create_index('ix_ft_account_id', 'finance_transactions', ['account_id'])
    op.create_index('ix_ft_responsible_id', 'finance_transactions', ['responsible_id'])
    op.create_index('ix_ft_type_date', 'finance_transactions', ['type', 'date'])

    # ── payroll_rules ──────────────────────────────────────────────
    op.create_table(
        'payroll_rules',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('employee_id', sa.Integer,
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('base_salary', sa.Integer, server_default='0', nullable=False),
        sa.Column('commission_percent', sa.Integer, server_default='0', nullable=False),
        sa.Column('commission_condition', sa.String(30), server_default='none', nullable=False),
        # none | from_setter | closer_self | any
        sa.Column('active_from', sa.Date, nullable=False),
        sa.Column('active_to', sa.Date, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_pr_employee_id', 'payroll_rules', ['employee_id'])

    # ── payroll_records ────────────────────────────────────────────
    op.create_table(
        'payroll_records',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('employee_id', sa.Integer,
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('base_salary', sa.Integer, server_default='0', nullable=False),
        sa.Column('commission_amount', sa.Integer, server_default='0', nullable=False),
        sa.Column('bonus_amount', sa.Integer, server_default='0', nullable=False),
        sa.Column('penalty_amount', sa.Integer, server_default='0', nullable=False),
        sa.Column('total_amount', sa.Integer, server_default='0', nullable=False),
        sa.Column('status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_prec_employee_id', 'payroll_records', ['employee_id'])

    # ── debts ──────────────────────────────────────────────────────
    op.create_table(
        'debts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('counterparty', sa.String(200), nullable=False),
        sa.Column('direction', sa.String(20), nullable=False),         # we_owe | owed_to_us
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('created_date', sa.Date, nullable=False),
        sa.Column('due_date', sa.Date, nullable=True),
        sa.Column('status', sa.String(20), server_default='active', nullable=False),
        # active | partial | paid | overdue
        sa.Column('comment', sa.Text, server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── account_balances ───────────────────────────────────────────
    op.create_table(
        'account_balances',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('account_id', sa.Integer,
                  sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('balance', sa.Integer, nullable=False),
        sa.Column('comment', sa.Text, server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ab_account_id', 'account_balances', ['account_id'])


def downgrade():
    op.drop_index('ix_ab_account_id', 'account_balances')
    op.drop_table('account_balances')
    op.drop_table('debts')
    op.drop_index('ix_prec_employee_id', 'payroll_records')
    op.drop_table('payroll_records')
    op.drop_index('ix_pr_employee_id', 'payroll_rules')
    op.drop_table('payroll_rules')
    op.drop_index('ix_ft_type_date', 'finance_transactions')
    op.drop_index('ix_ft_responsible_id', 'finance_transactions')
    op.drop_index('ix_ft_account_id', 'finance_transactions')
    op.drop_index('ix_ft_related_deal_id', 'finance_transactions')
    op.drop_index('ix_ft_related_lead_id', 'finance_transactions')
    op.drop_table('finance_transactions')
    op.drop_index('ix_servers_lead_id', 'servers')
    op.drop_column('servers', 'lead_id')
    op.drop_column('deals', 'closer_commission')
    op.drop_column('deals', 'setter_commission')
