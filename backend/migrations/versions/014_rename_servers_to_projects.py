"""Rename servers table to projects (Server→Project semantic rename)

Revision ID: 014
Revises: 013
Create Date: 2026-06-24
"""
from alembic import op

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Rename the table
    op.execute("ALTER TABLE servers RENAME TO projects")

    # 2. Rename the PostgreSQL enum type
    op.execute("ALTER TYPE serverstatus RENAME TO projectstatus")

    # 3. Rename primary key constraint
    op.execute("ALTER TABLE projects RENAME CONSTRAINT servers_pkey TO projects_pkey")

    # 4. Rename indexes created in earlier migrations
    op.execute("ALTER INDEX IF EXISTS ix_servers_delivered_at RENAME TO ix_projects_delivered_at")
    op.execute("ALTER INDEX IF EXISTS ix_servers_lead_id RENAME TO ix_projects_lead_id")

    # 5. Rename FK constraints (PostgreSQL auto-named)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'projects' AND constraint_name = 'servers_owner_id_fkey'
            ) THEN
                ALTER TABLE projects RENAME CONSTRAINT servers_owner_id_fkey TO projects_owner_id_fkey;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'projects' AND constraint_name = 'servers_lead_id_fkey'
            ) THEN
                ALTER TABLE projects RENAME CONSTRAINT servers_lead_id_fkey TO projects_lead_id_fkey;
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'projects' AND constraint_name = 'projects_owner_id_fkey'
            ) THEN
                ALTER TABLE projects RENAME CONSTRAINT projects_owner_id_fkey TO servers_owner_id_fkey;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'projects' AND constraint_name = 'projects_lead_id_fkey'
            ) THEN
                ALTER TABLE projects RENAME CONSTRAINT projects_lead_id_fkey TO servers_lead_id_fkey;
            END IF;
        END $$;
    """)
    op.execute("ALTER INDEX IF EXISTS ix_projects_lead_id RENAME TO ix_servers_lead_id")
    op.execute("ALTER INDEX IF EXISTS ix_projects_delivered_at RENAME TO ix_servers_delivered_at")
    op.execute("ALTER TABLE projects RENAME CONSTRAINT projects_pkey TO servers_pkey")
    op.execute("ALTER TYPE projectstatus RENAME TO serverstatus")
    op.execute("ALTER TABLE projects RENAME TO servers")
