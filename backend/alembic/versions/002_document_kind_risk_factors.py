"""document_kind on documents; risk_factors on sections

Revision ID: 002_doc_kind
Revises: 001_initial
Create Date: 2026-03-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_doc_kind"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("document_kind", sa.String(length=32), nullable=False, server_default="generic"),
    )
    op.add_column(
        "sections",
        sa.Column("risk_factors", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.alter_column("documents", "document_kind", server_default=None)


def downgrade() -> None:
    op.drop_column("sections", "risk_factors")
    op.drop_column("documents", "document_kind")
