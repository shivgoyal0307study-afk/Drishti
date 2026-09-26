"""
Database Schema Migration & Initialization Script.
Safe for both brand-new deployments (Render/Cloud) and existing local databases.
"""

import os
import sqlite3
from pathlib import Path
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.db.session import engine, Base
from backend.db.models import Train, Station, TrainTelemetry, DataIngestionRun

def init_and_migrate():
    # 1. Create all tables if they don't exist yet (handles fresh Render/production deployments)
    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)

    # 2. For existing SQLite databases, check if any newly added columns need to be backfilled
    db_path = "drishti.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if table 'trains' exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='trains'")
    if cursor.fetchone():
        cursor.execute("PRAGMA table_info(trains)")
        existing_cols = {row[1] for row in cursor.fetchall()}

        columns_to_add = [
            ("train_type", "VARCHAR(64) DEFAULT 'Express'"),
            ("zone", "VARCHAR(16) DEFAULT 'UNKNOWN'"),
            ("priority", "VARCHAR(32) DEFAULT 'NORMAL'"),
            ("running_days", "VARCHAR(64) DEFAULT 'Daily'"),
            ("scheduled_departure", "VARCHAR(16) DEFAULT '00:00'"),
            ("scheduled_arrival", "VARCHAR(16) DEFAULT '00:00'"),
            ("status", "VARCHAR(32) DEFAULT 'RUNNING'"),
            ("risk_status", "VARCHAR(32) DEFAULT 'NORMAL'"),
            ("affected_section", "VARCHAR(128) DEFAULT ''"),
        ]

        for col_name, col_def in columns_to_add:
            if col_name not in existing_cols:
                sql = f"ALTER TABLE trains ADD COLUMN {col_name} {col_def}"
                print(f"Running: {sql}")
                try:
                    cursor.execute(sql)
                except Exception as e:
                    print(f"Column {col_name} note: {e}")

        conn.commit()

    conn.close()
    print("[OK] Database migration and table check completed successfully!")

if __name__ == "__main__":
    init_and_migrate()
