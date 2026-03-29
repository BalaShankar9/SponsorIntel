"""Add swarm operational tables

Revision ID: 002_swarm_tables
Revises: 4de10d305c5c
Create Date: 2026-03-16

Note: These tables were created directly via SQL against Supabase.
This migration file serves as documentation of the schema changes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '002_swarm_tables'
down_revision = '4de10d305c5c'
branch_labels = None
depends_on = None


def upgrade():
    # swarm_metrics
    op.create_table('swarm_metrics',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('run_id', UUID),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('duration_seconds', sa.Integer),
        sa.Column('jobs_scraped', sa.Integer, server_default='0'),
        sa.Column('jobs_validated', sa.Integer, server_default='0'),
        sa.Column('jobs_enriched', sa.Integer, server_default='0'),
        sa.Column('jobs_expired', sa.Integer, server_default='0'),
        sa.Column('errors_total', sa.Integer, server_default='0'),
        sa.Column('errors_by_source', JSONB, server_default='{}'),
        sa.Column('completeness_avg', sa.Float),
        sa.Column('sponsorship_scored_count', sa.Integer, server_default='0'),
        sa.Column('llm_calls_count', sa.Integer, server_default='0'),
        sa.Column('llm_avg_latency_ms', sa.Float),
    )
    op.create_index('idx_swarm_metrics_date', 'swarm_metrics', ['started_at'])

    # swarm_alerts
    op.create_table('swarm_alerts',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('alert_type', sa.String(50)),
        sa.Column('source', sa.String(50)),
        sa.Column('severity', sa.String(20)),
        sa.Column('message', sa.Text),
        sa.Column('metrics', JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('acknowledged', sa.Boolean, server_default='false'),
    )
    op.create_index('idx_swarm_alerts_type', 'swarm_alerts', ['alert_type', 'created_at'])

    # swarm_reports
    op.create_table('swarm_reports',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('report_date', sa.Date),
        sa.Column('report_type', sa.String(20)),
        sa.Column('content', sa.Text),
        sa.Column('metrics_snapshot', JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # swarm_errors
    op.create_table('swarm_errors',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('task_name', sa.String(200)),
        sa.Column('agent', sa.String(50)),
        sa.Column('sub_agent', sa.String(100)),
        sa.Column('error_type', sa.String(100)),
        sa.Column('error_message', sa.Text),
        sa.Column('traceback', sa.Text),
        sa.Column('retry_count', sa.Integer, server_default='0'),
        sa.Column('resolved', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_swarm_errors_created', 'swarm_errors', ['created_at'])
    op.create_index('idx_swarm_errors_agent', 'swarm_errors', ['agent'])

    # source_health_log
    op.create_table('source_health_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source', sa.String(50)),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('jobs_returned', sa.Integer),
        sa.Column('success_rate', sa.Float),
        sa.Column('avg_completeness', sa.Float),
        sa.Column('avg_response_time_ms', sa.Float),
        sa.Column('error_count', sa.Integer),
        sa.Column('is_paused', sa.Boolean, server_default='false'),
    )
    op.create_index('idx_source_health_source', 'source_health_log', ['source', 'logged_at'])

    # job_validation_log
    op.create_table('job_validation_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID),
        sa.Column('field', sa.String(100)),
        sa.Column('source_a', sa.String(50)),
        sa.Column('value_a', sa.Text),
        sa.Column('source_b', sa.String(50)),
        sa.Column('value_b', sa.Text),
        sa.Column('resolution', sa.Text),
        sa.Column('reason', sa.String(500)),
        sa.Column('resolved_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_jvl_job', 'job_validation_log', ['job_id'])
    op.create_index('idx_jvl_date', 'job_validation_log', ['resolved_at'])

    # job_change_log
    op.create_table('job_change_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID),
        sa.Column('field', sa.String(100)),
        sa.Column('old_value', sa.Text),
        sa.Column('new_value', sa.Text),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_jcl_job', 'job_change_log', ['job_id'])
    op.create_index('idx_jcl_date', 'job_change_log', ['detected_at'])

    # sponsor_hiring_patterns
    op.create_table('sponsor_hiring_patterns',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('sponsor_id', UUID),
        sa.Column('year_month', sa.String(7)),
        sa.Column('job_count', sa.Integer),
        sa.Column('avg_salary', sa.Float),
        sa.Column('top_role', sa.String(500)),
        sa.UniqueConstraint('sponsor_id', 'year_month'),
    )

    # market_velocity
    op.create_table('market_velocity',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('industry', sa.String(200)),
        sa.Column('location_city', sa.String(200)),
        sa.Column('measured_at', sa.Date),
        sa.Column('avg_days_to_fill', sa.Float),
        sa.Column('new_postings_per_week', sa.Float),
        sa.Column('churn_rate', sa.Float),
        sa.UniqueConstraint('industry', 'location_city', 'measured_at'),
    )


def downgrade():
    for t in ['market_velocity', 'sponsor_hiring_patterns', 'job_change_log',
              'job_validation_log', 'source_health_log', 'swarm_errors',
              'swarm_reports', 'swarm_alerts', 'swarm_metrics']:
        op.drop_table(t)
