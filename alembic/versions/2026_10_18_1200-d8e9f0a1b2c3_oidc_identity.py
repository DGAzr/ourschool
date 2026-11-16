"""Bind users to stable OIDC provider identities.

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
"""

from alembic import op
import sqlalchemy as sa

revision = "d8e9f0a1b2c3"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("oidc_issuer", sa.String(), nullable=True))
    op.add_column("users", sa.Column("oidc_subject", sa.String(), nullable=True))
    op.create_unique_constraint(
        "uq_users_oidc_identity", "users", ["oidc_issuer", "oidc_subject"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_oidc_identity", "users", type_="unique")
    op.drop_column("users", "oidc_subject")
    op.drop_column("users", "oidc_issuer")
