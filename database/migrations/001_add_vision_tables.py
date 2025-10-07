"""
Add vision analysis tables

Revision ID: 001
Revises: None
Create Date: 2025-01-07

Adds vision_logs and vision_corrections tables for FEAT-PROPORTIONS
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Create vision analysis tables"""

    # Table: vision_logs
    op.create_table('vision_logs',
        sa.Column('id', sa.String(36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False, index=True),
        sa.Column('image_url', sa.Text),
        sa.Column('meal_type', sa.String(20)),
        sa.Column('identified_ingredients', sa.JSON),
        sa.Column('estimated_portions', sa.JSON),
        sa.Column('nutritional_analysis', sa.JSON),
        sa.Column('exercise_suggestions', sa.JSON),
        sa.Column('confidence_score', sa.Float),
        sa.Column('processing_time_ms', sa.Integer),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Table: vision_corrections
    op.create_table('vision_corrections',
        sa.Column('id', sa.String(36), primary_key=True, nullable=False),
        sa.Column('vision_log_id', sa.String(36), nullable=False, index=True),
        sa.Column('user_id', sa.String(36), nullable=False, index=True),
        sa.Column('correction_type', sa.String(50)),
        sa.Column('original_data', sa.JSON),
        sa.Column('corrected_data', sa.JSON),
        sa.Column('improvement_score', sa.Float),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # Create indexes for better query performance
    op.create_index('idx_vision_logs_user_id', 'vision_logs', ['user_id'], unique=False)
    op.create_index('idx_vision_logs_created_at', 'vision_logs', ['created_at'], unique=False)
    op.create_index('idx_vision_logs_meal_type', 'vision_logs', ['meal_type'], unique=False)
    op.create_index('idx_vision_corrections_log_id', 'vision_corrections', ['vision_log_id'], unique=False)
    op.create_index('idx_vision_corrections_user_id', 'vision_corrections', ['user_id'], unique=False)


def downgrade():
    """Drop vision analysis tables"""

    # Drop indexes first
    op.drop_index('idx_vision_corrections_user_id', table_name='vision_corrections')
    op.drop_index('idx_vision_corrections_log_id', table_name='vision_corrections')
    op.drop_index('idx_vision_logs_meal_type', table_name='vision_logs')
    op.drop_index('idx_vision_logs_created_at', table_name='vision_logs')
    op.drop_index('idx_vision_logs_user_id', table_name='vision_logs')

    # Drop tables
    op.drop_table('vision_corrections')
    op.drop_table('vision_logs')
