"""shop goal + item display order

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-08 10:00:00.000000

Two additive columns for the Points Shop tweaks:
- ``student_points.goal_item_id`` — the shop item a student is saving toward
  (their chosen goal), SET NULL if that item is deleted.
- ``shop_items.display_order`` — admin-defined storefront order. Existing rows
  are backfilled by current ``created_at DESC`` (newest first) so the order
  matches what admins already see on first load.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # shop_items.display_order (server_default 0 so the NOT NULL add is safe).
    op.add_column(
        "shop_items",
        sa.Column(
            "display_order", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    # Backfill: newest item first (matches the prior created_at DESC ordering).
    op.execute(
        """
        UPDATE shop_items AS s
        SET display_order = ranked.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) - 1 AS rn
            FROM shop_items
        ) AS ranked
        WHERE s.id = ranked.id
        """
    )
    # Drop the server_default now that rows are populated; app supplies the value.
    op.alter_column("shop_items", "display_order", server_default=None)

    # student_points.goal_item_id (nullable FK, SET NULL on item delete).
    op.add_column(
        "student_points",
        sa.Column("goal_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_student_points_goal_item_id_shop_items",
        "student_points",
        "shop_items",
        ["goal_item_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_student_points_goal_item_id_shop_items",
        "student_points",
        type_="foreignkey",
    )
    op.drop_column("student_points", "goal_item_id")
    op.drop_column("shop_items", "display_order")
