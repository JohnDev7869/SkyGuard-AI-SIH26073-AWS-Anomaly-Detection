-- Schema for SkyGuard AI Prototype

CREATE TABLE IF NOT EXISTS stations (
    station_id TEXT PRIMARY KEY,
    name TEXT,
    lat REAL,
    lon REAL,
    install_date TEXT
);

CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT,
    ts TEXT,
    temperature REAL,
    pressure REAL,
    humidity REAL,
    edge_flag TEXT,
    FOREIGN KEY(station_id) REFERENCES stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_readings_station_ts ON readings(station_id, ts);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT,
    ts TEXT,
    severity TEXT,
    confidence REAL,
    root_cause TEXT,
    raw_value_json TEXT,
    corrected_value_json TEXT,
    shap_json TEXT,
    status TEXT,
    FOREIGN KEY(station_id) REFERENCES stations(station_id)
);

CREATE TABLE IF NOT EXISTS sensor_health (
    station_id TEXT PRIMARY KEY,
    rolling_anomaly_rate REAL,
    drift_trend REAL,
    last_updated TEXT,
    maintenance_due_estimate TEXT,
    FOREIGN KEY(station_id) REFERENCES stations(station_id)
);
