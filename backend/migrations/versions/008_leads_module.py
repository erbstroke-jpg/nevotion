"""Leads module: add lead_id to tasks, create lead_files table

Revision ID: 008
Revises: 007
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tasks', sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_tasks_lead_id', 'tasks', ['lead_id'])

    op.create_table(
        'lead_files',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('file_type', sa.String(40), nullable=False, server_default=''),
        sa.Column('uploaded_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_files_lead_id', 'lead_files', ['lead_id'])


def downgrade():
    op.drop_index('ix_lead_files_lead_id', 'lead_files')
    op.drop_table('lead_files')
    op.drop_index('ix_tasks_lead_id', 'tasks')
    op.drop_column('tasks', 'lead_id')
