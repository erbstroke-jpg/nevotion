"""Unique (user_id, record_date) for sales and marketing records.

Revision ID: 004
Revises: 003
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    # Remove duplicate rows before adding constraint (keep the latest by id)
    op.execute("""
        DELETE FROM sales_records
        WHERE id NOT IN (
            SELECT MAX(id) FROM sales_records
            GROUP BY user_id, record_date
        )
    """)
    op.execute("""
        DELETE FROM marketing_records
        WHERE id NOT IN (
            SELECT MAX(id) FROM marketing_records
            GROUP BY user_id, record_date
        )
    """)
    op.create_unique_constraint(
        "uq_sales_user_date", "sales_records", ["user_id", "record_date"]
    )
    op.create_unique_constraint(
        "uq_marketing_user_date", "marketing_records", ["user_id", "record_date"]
    )


def downgrade():
    op.drop_constraint("uq_sales_user_date", "sales_records", type_="unique")
    op.drop_constraint("uq_marketing_user_date", "marketing_records", type_="unique")
