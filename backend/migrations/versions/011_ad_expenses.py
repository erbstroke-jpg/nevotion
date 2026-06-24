"""AdExpense — рекламные расходы по источникам

Revision ID: 011
Revises: 010
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ad_expenses',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('source_id', sa.Integer,
                  sa.ForeignKey('lead_sources.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ad_account', sa.String(200), server_default='', nullable=False),
        sa.Column('campaign_name', sa.String(300), server_default='', nullable=False),
        sa.Column('amount', sa.Integer, nullable=False),
        sa.Column('currency', sa.String(20), server_default='сом', nullable=False),
        sa.Column('responsible_id', sa.Integer,
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('comment', sa.Text, server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_ae_date', 'ad_expenses', ['date'])
    op.create_index('ix_ae_source_id', 'ad_expenses', ['source_id'])


def downgrade():
    op.drop_index('ix_ae_source_id', 'ad_expenses')
    op.drop_index('ix_ae_date', 'ad_expenses')
    op.drop_table('ad_expenses')
