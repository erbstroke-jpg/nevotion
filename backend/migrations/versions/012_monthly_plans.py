"""MonthlyPlan — monthly KPI plans

Revision ID: 012
Revises: 011
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'monthly_plans',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('year', sa.Integer, nullable=False),
        sa.Column('month', sa.Integer, nullable=False),
        sa.Column('plan_revenue', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_leads', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_meetings', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_sales', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_cpl', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_cac', sa.Integer, server_default='0', nullable=False),
        sa.Column('plan_expenses', sa.Integer, server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('year', 'month', name='uq_monthly_plans_year_month'),
    )
    op.create_index('ix_mp_year_month', 'monthly_plans', ['year', 'month'])


def downgrade():
    op.drop_index('ix_mp_year_month', 'monthly_plans')
    op.drop_table('monthly_plans')
