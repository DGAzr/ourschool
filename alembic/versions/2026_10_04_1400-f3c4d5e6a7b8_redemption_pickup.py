"""Redemption pickup instructions and refund records.
Revision ID: f3c4d5e6a7b8
Revises: f2b3c4d5e6a7
"""

from alembic import op
import sqlalchemy as sa

revision = "f3c4d5e6a7b8"
down_revision = "f2b3c4d5e6a7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("shop_redemptions", sa.Column("pickup_instructions", sa.Text()))
    op.add_column(
        "shop_redemptions",
        sa.Column(
            "points_refunded", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.execute(
        "UPDATE shop_redemptions SET points_refunded = true WHERE refund_transaction_id IS NOT NULL"
    )


def downgrade():
    op.drop_column("shop_redemptions", "points_refunded")
    op.drop_column("shop_redemptions", "pickup_instructions")
