"""Dev payroll: delivered_at on servers + DevPayrollConfig table

Revision ID: 013
Revises: 012
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    # delivered_at on servers — date bot was delivered (sub_status = Сдан)
    op.add_column('servers', sa.Column('delivered_at', sa.Date, nullable=True))
    op.create_index('ix_servers_delivered_at', 'servers', ['delivered_at'])

    # Global dev payroll config (prompter / teamlead rates)
    op.create_table(
        'dev_payroll_configs',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('role_kind', sa.String(30), nullable=False, unique=True),  # prompter | teamlead
        sa.Column('new_bot_price', sa.Integer, nullable=False, server_default='5000'),
        sa.Column('support_price', sa.Integer, nullable=False, server_default='1000'),
        sa.Column('base_salary', sa.Integer, nullable=False, server_default='20000'),
        sa.Column('free_bots_limit', sa.Integer, nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_dev_payroll_configs_role_kind', 'dev_payroll_configs', ['role_kind'])


def downgrade():
    op.drop_index('ix_dev_payroll_configs_role_kind', 'dev_payroll_configs')
    op.drop_table('dev_payroll_configs')
    op.drop_index('ix_servers_delivered_at', 'servers')
    op.drop_column('servers', 'delivered_at')
