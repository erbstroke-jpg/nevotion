"""add meetings table, pagination support

Revision ID: 003
Revises: 002
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('meetings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('closer_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('setter_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('meeting_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('address', sa.String(300), server_default=''),
        sa.Column('client_name', sa.String(200), nullable=False),
        sa.Column('client_phone', sa.String(50), server_default=''),
        sa.Column('status', sa.Enum('scheduled','closed','minus','push','rescheduled', name='meetingstatus'), server_default='scheduled'),
        sa.Column('notes', sa.Text(), server_default=''),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('meetings.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_meetings_closer_id', 'meetings', ['closer_id'])
    op.create_index('ix_meetings_meeting_date', 'meetings', ['meeting_date'])


def downgrade() -> None:
    op.drop_index('ix_meetings_meeting_date', 'meetings')
    op.drop_index('ix_meetings_closer_id', 'meetings')
    op.drop_table('meetings')
    op.execute("DROP TYPE IF EXISTS meetingstatus")
