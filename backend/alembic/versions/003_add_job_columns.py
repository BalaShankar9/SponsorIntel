"""Add new job and company_profiles columns for agent swarm

Revision ID: 003_job_columns
Revises: 002_swarm_tables
Create Date: 2026-03-16

Note: These columns were added directly via SQL against Supabase.
This migration file serves as documentation of the schema changes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '003_job_columns'
down_revision = '002_swarm_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Jobs table extensions
    op.add_column('jobs', sa.Column('data_quality_score', sa.Integer))
    op.add_column('jobs', sa.Column('is_flagged', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('flag_reason', sa.String(50)))
    op.add_column('jobs', sa.Column('repost_of_job_id', UUID))
    op.add_column('jobs', sa.Column('repost_count', sa.Integer, server_default='0'))
    op.add_column('jobs', sa.Column('closing_signal', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('work_model', sa.String(20)))
    op.add_column('jobs', sa.Column('salary_estimated_min', sa.Float))
    op.add_column('jobs', sa.Column('salary_estimated_max', sa.Float))
    op.add_column('jobs', sa.Column('salary_is_estimated', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('salary_percentile', sa.Float))
    op.add_column('jobs', sa.Column('salary_vs_threshold', sa.String(20)))
    op.add_column('jobs', sa.Column('visa_routes_eligible', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('department', sa.String(100)))
    op.add_column('jobs', sa.Column('benefits', JSONB))
    op.add_column('jobs', sa.Column('red_flags', JSONB))
    op.add_column('jobs', sa.Column('culture_signals', JSONB))
    op.add_column('jobs', sa.Column('education_required', JSONB))
    op.add_column('jobs', sa.Column('certifications_required', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('languages_required', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('source_urls', sa.ARRAY(sa.Text)))

    # Indexes
    op.create_index('idx_jobs_quality', 'jobs', ['data_quality_score'])
    op.create_index('idx_jobs_work_model', 'jobs', ['work_model'])
    op.create_index('idx_jobs_department', 'jobs', ['department'])

    # Company profiles extensions
    op.add_column('company_profiles', sa.Column('name_variants', JSONB))
    op.add_column('company_profiles', sa.Column('careers_page_url', sa.String(2000)))
    op.add_column('company_profiles', sa.Column('has_careers_page', sa.Boolean))


def downgrade():
    # Remove company_profiles columns
    for col in ['name_variants', 'careers_page_url', 'has_careers_page']:
        op.drop_column('company_profiles', col)

    # Remove indexes
    op.drop_index('idx_jobs_department', 'jobs')
    op.drop_index('idx_jobs_work_model', 'jobs')
    op.drop_index('idx_jobs_quality', 'jobs')

    # Remove jobs columns
    for col in ['data_quality_score', 'is_flagged', 'flag_reason', 'repost_of_job_id',
                'repost_count', 'closing_signal', 'work_model', 'salary_estimated_min',
                'salary_estimated_max', 'salary_is_estimated', 'salary_percentile',
                'salary_vs_threshold', 'visa_routes_eligible', 'department', 'benefits',
                'red_flags', 'culture_signals', 'education_required',
                'certifications_required', 'languages_required', 'source_urls']:
        op.drop_column('jobs', col)
