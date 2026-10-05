"""Add revocable browser sessions and temporary student-switch PIN state.

Revision ID: b6f7a8c9d0e1
Revises: a5e6f7b8c9d0
"""

from alembic import op
import sqlalchemy as sa

revision = "b6f7a8c9d0e1"
down_revision = "a5e6f7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "browser_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "original_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "effective_user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_role", sa.String(20), nullable=False),
        sa.Column("generation", sa.Integer, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("pin_hash", sa.String),
        sa.Column("pin_failures", sa.Integer, nullable=False),
        sa.Column("pin_blocked_until", sa.DateTime(timezone=True)),
    )
    for column in ("original_user_id", "effective_user_id", "expires_at"):
        op.create_index(f"ix_browser_sessions_{column}", "browser_sessions", [column])


def downgrade():
    op.drop_table("browser_sessions")
