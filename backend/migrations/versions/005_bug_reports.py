"""Add bug_reports table.

Revision ID: 005
Revises: 004
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "bug_reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("reporter_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "status",
            sa.Enum("new", "in_progress", "resolved", name="bugstatus"),
            nullable=False,
            server_default="new",
        ),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("bug_reports")
    op.execute("DROP TYPE IF EXISTS bugstatus")
