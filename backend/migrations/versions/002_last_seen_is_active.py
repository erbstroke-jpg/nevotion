"""add last_seen and is_active to users, remove is_online

Revision ID: 002
Revises: 001
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True))
    op.drop_column('users', 'is_online')


def downgrade() -> None:
    op.add_column('users', sa.Column('is_online', sa.Boolean(), server_default='false', nullable=False))
    op.drop_column('users', 'last_seen')
    op.drop_column('users', 'is_active')
