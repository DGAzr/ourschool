"""add points shop

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-07 21:00:00.000000

Adds the Points Shop: a catalog of reward items students buy with points.

Four tables, created in FK order:
- ``shop_categories`` — admin-defined storefront categories (mirror Subjects).
- ``shop_images`` — bytea blob store for item photos (no item FK; items
  reference images by external_id).
- ``shop_items`` — purchasable catalog items.
- ``shop_redemptions`` — student "orders" with snapshotted item name/cost.

Seeds four default categories idempotently (WHERE NOT EXISTS on name).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shop_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=True
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(
        op.f("ix_shop_categories_id"), "shop_categories", ["id"], unique=False
    )

    op.create_table(
        "shop_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(op.f("ix_shop_images_id"), "shop_images", ["id"], unique=False)
    op.create_index(
        op.f("ix_shop_images_external_id"),
        "shop_images",
        ["external_id"],
        unique=True,
    )

    op.create_table(
        "shop_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cost_points", sa.Integer(), nullable=False),
        sa.Column("quantity_available", sa.Integer(), nullable=True),
        sa.Column("fulfillment_type", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("image_ids", sa.JSON(), nullable=False),
        sa.Column("total_redeemed", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"], ["shop_categories.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(op.f("ix_shop_items_id"), "shop_items", ["id"], unique=False)
    op.create_index(
        op.f("ix_shop_items_category_id"),
        "shop_items",
        ["category_id"],
        unique=False,
    )

    op.create_table(
        "shop_redemptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("cost_points", sa.Integer(), nullable=False),
        sa.Column("fulfillment_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("point_transaction_id", sa.Integer(), nullable=True),
        sa.Column("refund_transaction_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["student_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["item_id"], ["shop_items.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["point_transaction_id"], ["point_transactions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["refund_transaction_id"], ["point_transactions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["decided_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_index(
        op.f("ix_shop_redemptions_id"), "shop_redemptions", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_shop_redemptions_student_id"),
        "shop_redemptions",
        ["student_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_shop_redemptions_item_id"),
        "shop_redemptions",
        ["item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_shop_redemptions_status"),
        "shop_redemptions",
        ["status"],
        unique=False,
    )

    # Seed default categories (idempotent — only insert names not already present).
    op.execute(
        """
        INSERT INTO shop_categories (external_id, name, color, icon, sort_order, created_at)
        SELECT gen_random_uuid()::text, v.name, v.color, v.icon, v.sort_order, now()
        FROM (VALUES
            ('Treats',      '#C0892F', E'\U0001F369', 0),
            ('Privileges',  '#4F7CAC', E'\U0001F39F', 1),
            ('Supplies',    '#4E8D6E', E'✏',     2),
            ('Experiences', '#9A8A4F', E'\U0001F3A2', 3)
        ) AS v(name, color, icon, sort_order)
        WHERE NOT EXISTS (
            SELECT 1 FROM shop_categories c WHERE c.name = v.name
        )
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_shop_redemptions_status"), table_name="shop_redemptions")
    op.drop_index(op.f("ix_shop_redemptions_item_id"), table_name="shop_redemptions")
    op.drop_index(
        op.f("ix_shop_redemptions_student_id"), table_name="shop_redemptions"
    )
    op.drop_index(op.f("ix_shop_redemptions_id"), table_name="shop_redemptions")
    op.drop_table("shop_redemptions")

    op.drop_index(op.f("ix_shop_items_category_id"), table_name="shop_items")
    op.drop_index(op.f("ix_shop_items_id"), table_name="shop_items")
    op.drop_table("shop_items")

    op.drop_index(op.f("ix_shop_images_external_id"), table_name="shop_images")
    op.drop_index(op.f("ix_shop_images_id"), table_name="shop_images")
    op.drop_table("shop_images")

    op.drop_index(op.f("ix_shop_categories_id"), table_name="shop_categories")
    op.drop_table("shop_categories")
