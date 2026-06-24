"""Deals table + reject fields on leads

Revision ID: 009
Revises: 008
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'deals',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Integer, default=0, nullable=False),
        sa.Column('paid_amount', sa.Integer, default=0, nullable=False),
        sa.Column('payment_date', sa.Date, nullable=True),
        sa.Column('payment_method', sa.String(120), default='', nullable=False),
        sa.Column('status', sa.String(30), default='pending', nullable=False),
        sa.Column('setter_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('closer_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('deal_type', sa.String(40), default='', nullable=False),
        sa.Column('contract_sent_at', sa.Date, nullable=True),
        sa.Column('expected_payment_date', sa.Date, nullable=True),
        sa.Column('responsible_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_deals_lead_id', 'deals', ['lead_id'])
    op.create_index('ix_deals_setter_id', 'deals', ['setter_id'])
    op.create_index('ix_deals_closer_id', 'deals', ['closer_id'])

    op.add_column('leads', sa.Column(
        'reject_reason_id', sa.Integer,
        sa.ForeignKey('reject_reasons.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.add_column('leads', sa.Column('reject_comment', sa.Text, server_default='', nullable=False))
    op.create_index('ix_leads_reject_reason_id', 'leads', ['reject_reason_id'])


def downgrade():
    op.drop_index('ix_leads_reject_reason_id', 'leads')
    op.drop_column('leads', 'reject_comment')
    op.drop_column('leads', 'reject_reason_id')
    op.drop_index('ix_deals_closer_id', 'deals')
    op.drop_index('ix_deals_setter_id', 'deals')
    op.drop_index('ix_deals_lead_id', 'deals')
    op.drop_table('deals')
