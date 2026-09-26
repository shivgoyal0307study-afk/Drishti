"""ORM models for auth, audit, and migration tracking."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

# pgvector support for embeddings (optional import for SQLite compatibility)
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    PGVECTOR_AVAILABLE = False
    Vector = None  # type: ignore

from backend.db.session import Base


class SchemaMigration(Base):
    __tablename__ = "schema_migrations"

    version: Mapped[str] = mapped_column(String(64), primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="viewer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trace_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    actor: Mapped[str] = mapped_column(String(120), default="anonymous", nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    resource: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    details: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    zone: Mapped[str] = mapped_column(String(16), default="UNKNOWN", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Train(Base):
    __tablename__ = "trains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    train_name: Mapped[str] = mapped_column(String(255), nullable=False)
    train_type: Mapped[str] = mapped_column(String(64), default="Express", nullable=False)
    zone: Mapped[str] = mapped_column(String(16), default="UNKNOWN", nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="NORMAL", nullable=False)
    running_days: Mapped[str] = mapped_column(String(64), default="Daily", nullable=False)
    route: Mapped[str] = mapped_column(Text, default="", nullable=False)
    origin_station_code: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    destination_station_code: Mapped[str] = mapped_column(String(16), default="", nullable=False)
    scheduled_departure: Mapped[str] = mapped_column(String(16), default="00:00", nullable=False)
    scheduled_arrival: Mapped[str] = mapped_column(String(16), default="00:00", nullable=False)
    current_station_code: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="RUNNING", nullable=False)
    risk_status: Mapped[str] = mapped_column(String(32), default="NORMAL", nullable=False)
    affected_section: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="ntes_live", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class DataIngestionRun(Base):
    __tablename__ = "data_ingestion_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    records_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_valid: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_invalid: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_persisted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="running", nullable=False)
    error_message: Mapped[str] = mapped_column(Text, default="", nullable=False)


class TrainTelemetry(Base):
    __tablename__ = "train_telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    train_pk: Mapped[int] = mapped_column(ForeignKey("trains.id"), index=True, nullable=False)
    train_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    station_code: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    timestamp_utc: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="ntes_live", nullable=False)
    ingestion_run_id: Mapped[int] = mapped_column(ForeignKey("data_ingestion_runs.id"), nullable=False)
    raw_payload: Mapped[str] = mapped_column(Text, default="{}", nullable=False)


class CRSAccident(Base):
    """Historical accident records from Indian Railways CRS system."""
    __tablename__ = "crs_accidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    accident_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    date: Mapped[str] = mapped_column(String(16), nullable=False)
    station: Mapped[str] = mapped_column(String(255), nullable=False)
    deaths: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delay_before_accident_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    root_cause: Mapped[str] = mapped_column(String(255), nullable=False)
    signal_state: Mapped[str] = mapped_column(String(64), nullable=False)
    track_state: Mapped[str] = mapped_column(String(64), nullable=False)
    maintenance_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    narrative_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


if PGVECTOR_AVAILABLE:
    class AccidentEmbedding(Base):
        """Vector embeddings for CRS accident narratives (PostgreSQL + pgvector)."""
        __tablename__ = "accident_embeddings"

        id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
        accident_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
        embedding: Mapped[Vector] = mapped_column(Vector(384), nullable=False)  # all-MiniLM-L6-v2: 384-dim
        model_name: Mapped[str] = mapped_column(String(128), default="all-MiniLM-L6-v2", nullable=False)
        created_at: Mapped[datetime] = mapped_column(
            DateTime,
            default=lambda: datetime.now(timezone.utc),
            nullable=False,
        )
        updated_at: Mapped[datetime] = mapped_column(
            DateTime,
            default=lambda: datetime.now(timezone.utc),
            nullable=False,
        )
