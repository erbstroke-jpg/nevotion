"""Add missing FK indexes for performance

Revision ID: 015
Revises: 014
Create Date: 2026-06-24
"""
from alembic import op

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    # ColumnDef.department_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_column_defs_department_id ON column_defs (department_id)")

    # SalesRecord.user_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_records_user_id ON sales_records (user_id)")

    # MarketingRecord.user_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_marketing_records_user_id ON marketing_records (user_id)")

    # Task.column_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_column_id ON tasks (column_id)")

    # Task.owner_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_owner_id ON tasks (owner_id)")

    # Meeting.setter_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_meetings_setter_id ON meetings (setter_id)")

    # Meeting.closer_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_meetings_closer_id ON meetings (closer_id)")

    # Project.owner_id — unindexed FK (was not indexed in original servers table)
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_owner_id ON projects (owner_id)")

    # Board.owner_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_boards_owner_id ON boards (owner_id)")

    # Board.department_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_boards_department_id ON boards (department_id)")

    # BoardColumn.board_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_board_columns_board_id ON board_columns (board_id)")

    # Task.board_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_board_id ON tasks (board_id)")

    # Task.requester_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_requester_id ON tasks (requester_id)")

    # AdExpense.responsible_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_ad_expenses_responsible_id ON ad_expenses (responsible_id)")

    # FinanceTransaction.responsible_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_finance_transactions_responsible_id ON finance_transactions (responsible_id)")

    # Deal.responsible_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_deals_responsible_id ON deals (responsible_id)")

    # LeadActivity.responsible_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_lead_activities_responsible_id ON lead_activities (responsible_id)")

    # BugReport.reporter_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_bug_reports_reporter_id ON bug_reports (reporter_id)")

    # Meeting.parent_id — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_meetings_parent_id ON meetings (parent_id)")

    # LeadStageHistory.changed_by — unindexed FK
    op.execute("CREATE INDEX IF NOT EXISTS ix_lead_stage_history_changed_by ON lead_stage_history (changed_by)")

    # AccountBalance.account_id — index by date for latest-per-account queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_account_balances_date ON account_balances (account_id, date DESC)")

    # PayrollRule.employee_id + active_from — composite for date-range queries
    op.execute("CREATE INDEX IF NOT EXISTS ix_payroll_rules_employee_active ON payroll_rules (employee_id, active_from)")


def downgrade():
    indexes = [
        ("ix_column_defs_department_id", "column_defs"),
        ("ix_sales_records_user_id", "sales_records"),
        ("ix_marketing_records_user_id", "marketing_records"),
        ("ix_tasks_column_id", "tasks"),
        ("ix_tasks_owner_id", "tasks"),
        ("ix_meetings_setter_id", "meetings"),
        ("ix_meetings_closer_id", "meetings"),
        ("ix_projects_owner_id", "projects"),
        ("ix_boards_owner_id", "boards"),
        ("ix_boards_department_id", "boards"),
        ("ix_board_columns_board_id", "board_columns"),
        ("ix_tasks_board_id", "tasks"),
        ("ix_tasks_requester_id", "tasks"),
        ("ix_ad_expenses_responsible_id", "ad_expenses"),
        ("ix_finance_transactions_responsible_id", "finance_transactions"),
        ("ix_deals_responsible_id", "deals"),
        ("ix_lead_activities_responsible_id", "lead_activities"),
        ("ix_bug_reports_reporter_id", "bug_reports"),
        ("ix_meetings_parent_id", "meetings"),
        ("ix_lead_stage_history_changed_by", "lead_stage_history"),
        ("ix_account_balances_date", "account_balances"),
        ("ix_payroll_rules_employee_active", "payroll_rules"),
    ]
    for idx_name, _ in indexes:
        op.execute(f"DROP INDEX IF EXISTS {idx_name}")
