import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", "skyguard.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Wipe old data for fresh hackathon demo
    conn.execute("DROP TABLE IF EXISTS sensor_health")
    conn.execute("DROP TABLE IF EXISTS alerts")
    conn.execute("DROP TABLE IF EXISTS readings")
    conn.execute("DROP TABLE IF EXISTS stations")
    
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
