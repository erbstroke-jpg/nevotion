"""Add sub_status, price, color, bot_comment to servers

Revision ID: 006
Revises: 005
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("servers", sa.Column("sub_status", sa.String(40), nullable=True))
    op.add_column("servers", sa.Column("price", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("servers", sa.Column("color", sa.String(20), nullable=False, server_default="green"))
    op.add_column("servers", sa.Column("bot_comment", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("servers", "sub_status")
    op.drop_column("servers", "price")
    op.drop_column("servers", "color")
    op.drop_column("servers", "bot_comment")
