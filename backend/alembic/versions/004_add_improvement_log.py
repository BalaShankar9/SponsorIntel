"""Add improvement_log table for R&D department

Revision ID: 004_improvement_log
Revises: 003_add_job_columns
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '004_improvement_log'
down_revision = '003_add_job_columns'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('improvement_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('agent', sa.String(100)),
        sa.Column('persona', sa.String(100)),
        sa.Column('analysis_type', sa.String(50)),
        sa.Column('recommendations', JSONB, server_default='[]'),
        sa.Column('metrics', JSONB, server_default='{}'),
        sa.Column('high_quality_sample_size', sa.Integer),
        sa.Column('low_quality_sample_size', sa.Integer),
        sa.Column('active_sources_count', sa.Integer),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_improvement_log_type', 'improvement_log', ['analysis_type', 'created_at'])
    op.create_index('idx_improvement_log_agent', 'improvement_log', ['agent'])


def downgrade():
    op.drop_table('improvement_log')
