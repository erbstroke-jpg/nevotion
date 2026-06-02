"""initial_schema

Revision ID: 001
Revises: 
Create Date: 2026-06-01

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('admin','staff', name='role'), nullable=False, server_default='staff'),
        sa.Column('position', sa.String(80), server_default='Сотрудник'),
        sa.Column('is_founder', sa.Boolean(), server_default='false'),
        sa.Column('avatar_color', sa.String(20), server_default='indigo'),
        sa.Column('is_online', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # departments
    op.create_table('departments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('slug', sa.String(60), unique=True),
        sa.Column('icon', sa.String(40), server_default='folder'),
        sa.Column('admin_only', sa.Boolean(), server_default='false'),
        sa.Column('kind', sa.String(40), server_default='generic'),
        sa.Column('content', sa.Text(), server_default=''),
        sa.Column('embed_url', sa.String(500), server_default=''),
    )

    # user_departments (m2m)
    op.create_table('user_departments',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id', ondelete='CASCADE'), primary_key=True),
    )

    # servers
    op.create_table('servers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('company', sa.String(160), nullable=False),
        sa.Column('status', sa.Enum('new','support', name='serverstatus'), server_default='new'),
        sa.Column('connected_at', sa.Date()),
        sa.Column('notes', sa.String(500), server_default=''),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # boards
    op.create_table('boards',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), server_default='Доска'),
        sa.Column('kind', sa.String(40), server_default='personal'),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id', ondelete='CASCADE'), nullable=True),
    )

    # board_columns
    op.create_table('board_columns',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('board_id', sa.Integer(), sa.ForeignKey('boards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('color', sa.String(20), server_default='#767586'),
        sa.Column('position', sa.Integer(), server_default='0'),
        sa.Column('is_done', sa.Boolean(), server_default='false'),
    )

    # tasks
    op.create_table('tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('tag', sa.String(60), server_default='Задача'),
        sa.Column('tag_color', sa.String(20), server_default='indigo'),
        sa.Column('priority', sa.Enum('low','med','high', name='priority'), server_default='med'),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.Date(), nullable=True),
        sa.Column('position', sa.Integer(), server_default='0'),
        sa.Column('board_id', sa.Integer(), sa.ForeignKey('boards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('column_id', sa.Integer(), sa.ForeignKey('board_columns.id', ondelete='SET NULL'), nullable=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('requester_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assignee_ids', postgresql.JSON(), server_default='[]'),
        sa.Column('task_type', sa.String(80), server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # sales_records
    op.create_table('sales_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('metrics', postgresql.JSON(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # marketing_records
    op.create_table('marketing_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('fields', postgresql.JSON(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # column_defs (sales/marketing dynamic columns)
    op.create_table('column_defs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(80), nullable=False),
        sa.Column('label', sa.String(120), nullable=False),
        sa.Column('kind', sa.String(20), server_default='number'),
        sa.Column('position', sa.Integer(), server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('column_defs')
    op.drop_table('marketing_records')
    op.drop_table('sales_records')
    op.drop_table('tasks')
    op.drop_table('board_columns')
    op.drop_table('boards')
    op.drop_table('servers')
    op.drop_table('user_departments')
    op.drop_table('departments')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS role")
    op.execute("DROP TYPE IF EXISTS serverstatus")
    op.execute("DROP TYPE IF EXISTS priority")
