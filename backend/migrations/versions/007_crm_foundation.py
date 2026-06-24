"""CRM foundation: lookup tables, Lead, LeadStageHistory, LeadActivity, lead_id on meetings

Revision ID: 007
Revises: 006
Create Date: 2026-06-22
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # ── Lookup tables ─────────────────────────────────────────────

    op.create_table(
        'lead_sources',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
    )

    op.create_table(
        'services',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
    )

    op.create_table(
        'lead_stages',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
        sa.Column('norm_days', sa.Integer, nullable=True),
        sa.Column('is_won', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('is_lost', sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column('color', sa.String(30), nullable=False, server_default='#4648d4'),
    )

    op.create_table(
        'reject_reasons',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
    )

    op.create_table(
        'expense_categories',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
    )

    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('currency', sa.String(20), nullable=False, server_default='сом'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
    )

    # ── Lead ─────────────────────────────────────────────────────

    op.create_table(
        'leads',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('client_name', sa.String(200), nullable=False),
        sa.Column('company_name', sa.String(200), nullable=False, server_default=''),
        sa.Column('phone', sa.String(50), nullable=False, server_default=''),
        sa.Column('whatsapp', sa.String(50), nullable=False, server_default=''),
        sa.Column('instagram', sa.String(100), nullable=False, server_default=''),
        sa.Column('email', sa.String(255), nullable=False, server_default=''),
        sa.Column('address', sa.String(300), nullable=False, server_default=''),
        sa.Column('website', sa.String(300), nullable=False, server_default=''),
        sa.Column('industry', sa.String(120), nullable=False, server_default=''),
        sa.Column('employees_count', sa.Integer, nullable=True),
        sa.Column('source_id', sa.Integer, sa.ForeignKey('lead_sources.id', ondelete='SET NULL'), nullable=True),
        sa.Column('service_id', sa.Integer, sa.ForeignKey('services.id', ondelete='SET NULL'), nullable=True),
        sa.Column('stage_id', sa.Integer, sa.ForeignKey('lead_stages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('setter_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('closer_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('potential_amount', sa.Integer, nullable=False, server_default='0'),
        sa.Column('actual_amount', sa.Integer, nullable=False, server_default='0'),
        sa.Column('status', sa.Enum('active', 'archived', name='leadstatus'), nullable=False, server_default='active'),
        sa.Column('next_action_type', sa.String(80), nullable=False, server_default=''),
        sa.Column('next_action_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('comment', sa.Text, nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_leads_phone', 'leads', ['phone'])
    op.create_index('ix_leads_source_id', 'leads', ['source_id'])
    op.create_index('ix_leads_service_id', 'leads', ['service_id'])
    op.create_index('ix_leads_stage_id', 'leads', ['stage_id'])
    op.create_index('ix_leads_setter_id', 'leads', ['setter_id'])
    op.create_index('ix_leads_closer_id', 'leads', ['closer_id'])

    # ── Lead Stage History ────────────────────────────────────────

    op.create_table(
        'lead_stage_history',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_stage_id', sa.Integer, sa.ForeignKey('lead_stages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_stage_id', sa.Integer, sa.ForeignKey('lead_stages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('changed_by', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('comment', sa.Text, nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_stage_history_lead_id', 'lead_stage_history', ['lead_id'])

    # ── Lead Activities ───────────────────────────────────────────

    op.create_table(
        'lead_activities',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_type', sa.String(80), nullable=False, server_default=''),
        sa.Column('channel', sa.String(80), nullable=False, server_default=''),
        sa.Column('description', sa.Text, nullable=False, server_default=''),
        sa.Column('responsible_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_activities_lead_id', 'lead_activities', ['lead_id'])

    # ── Add lead_id to meetings ───────────────────────────────────

    op.add_column('meetings', sa.Column('lead_id', sa.Integer, sa.ForeignKey('leads.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_meetings_lead_id', 'meetings', ['lead_id'])


def downgrade():
    op.drop_index('ix_meetings_lead_id', 'meetings')
    op.drop_column('meetings', 'lead_id')

    op.drop_index('ix_lead_activities_lead_id', 'lead_activities')
    op.drop_table('lead_activities')

    op.drop_index('ix_lead_stage_history_lead_id', 'lead_stage_history')
    op.drop_table('lead_stage_history')

    op.drop_index('ix_leads_phone', 'leads')
    op.drop_index('ix_leads_source_id', 'leads')
    op.drop_index('ix_leads_service_id', 'leads')
    op.drop_index('ix_leads_stage_id', 'leads')
    op.drop_index('ix_leads_setter_id', 'leads')
    op.drop_index('ix_leads_closer_id', 'leads')
    op.drop_table('leads')
    op.execute("DROP TYPE IF EXISTS leadstatus")

    op.drop_table('accounts')
    op.drop_table('expense_categories')
    op.drop_table('reject_reasons')
    op.drop_table('lead_stages')
    op.drop_table('services')
    op.drop_table('lead_sources')
