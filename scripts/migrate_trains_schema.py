import sqlite3

conn = sqlite3.connect('drishti.db')
cursor = conn.cursor()

columns_to_add = [
    ('train_type', "VARCHAR(64) DEFAULT 'Express'"),
    ('zone', "VARCHAR(16) DEFAULT 'UNKNOWN'"),
    ('priority', "VARCHAR(32) DEFAULT 'NORMAL'"),
    ('running_days', "VARCHAR(64) DEFAULT 'Daily'"),
    ('scheduled_departure', "VARCHAR(16) DEFAULT '00:00'"),
    ('scheduled_arrival', "VARCHAR(16) DEFAULT '00:00'"),
    ('status', "VARCHAR(32) DEFAULT 'RUNNING'"),
    ('risk_status', "VARCHAR(32) DEFAULT 'NORMAL'"),
    ('affected_section', "VARCHAR(128) DEFAULT ''"),
]

cursor.execute('PRAGMA table_info(trains)')
existing_cols = {row[1] for row in cursor.fetchall()}

for col_name, col_def in columns_to_add:
    if col_name not in existing_cols:
        sql = f"ALTER TABLE trains ADD COLUMN {col_name} {col_def}"
        print(f"Running: {sql}")
        cursor.execute(sql)

conn.commit()
conn.close()
print("Migration completed successfully!")
