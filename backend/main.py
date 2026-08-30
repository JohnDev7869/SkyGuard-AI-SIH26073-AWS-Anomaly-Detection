import asyncio
import json
import os
import paho.mqtt.client as mqtt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from db.database import init_db, get_db_connection
from api.routes_readings import router as readings_router
from api.routes_alerts import router as alerts_router
from api.routes_health import router as health_router
from api.websocket import router as ws_router, manager

from models.statistical_detector import StatisticalDetector
from models.temporal_detector import TemporalDetector
from models.multivariate_detector import MultivariateDetector
from models.spatial_detector import SpatialDetector
from models.fusion_model import FusionModel
from models.root_cause import RootCauseClassifier
from models.correction import Corrector
from models.sensor_health import SensorHealthTracker

app = FastAPI(title="SkyGuard AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(readings_router)
app.include_router(alerts_router)
app.include_router(health_router)
app.include_router(ws_router)

# Global models (in a real app, these would be managed in a better state wrapper)
stat_detector = StatisticalDetector()
temp_detector = TemporalDetector()
multi_detector = MultivariateDetector()
spat_detector = SpatialDetector()
fusion_model = FusionModel()
root_cause = RootCauseClassifier()
corrector = Corrector()
health_tracker = SensorHealthTracker()

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "skyguard-demo/awsnet/+/reading"

# To avoid blocking FastAPI, we'll use a queue for incoming MQTT messages
message_queue = asyncio.Queue()
main_loop = None

def on_mqtt_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8')
        # Push to asyncio queue safely using the main thread's loop
        if main_loop is not None:
            asyncio.run_coroutine_threadsafe(message_queue.put(payload), main_loop)
    except Exception as e:
        print(f"MQTT message error: {e}")

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with rc={rc}")
    client.subscribe(MQTT_TOPIC)

def get_recent_history(station_id, limit=50):
    conn = get_db_connection()
    df = pd.read_sql_query("SELECT * FROM readings WHERE station_id = ? ORDER BY ts DESC LIMIT ?", conn, params=(station_id, limit))
    conn.close()
    return df.iloc[::-1] # return chronologically

def get_neighbors_readings(lat, lon):
    # Dummy implementation for prototype: just get latest reading from all OTHER stations
    conn = get_db_connection()
    res = conn.execute('''
        SELECT r.* FROM readings r
        INNER JOIN (SELECT station_id, MAX(ts) as max_ts FROM readings GROUP BY station_id) grouped
        ON r.station_id = grouped.station_id AND r.ts = grouped.max_ts
    ''').fetchall()
    conn.close()
    return [dict(x) for x in res]

async def process_messages():
    while True:
        payload = await message_queue.get()
        try:
            reading = json.loads(payload)
            station_id = reading['station_id']
            edge_flag = reading.get('edge_flag', 'clean')
            
            name = reading.get('name', f"Station {station_id}")
            lat = reading.get('lat', 20.5937)
            lon = reading.get('lon', 78.9629)
            
            # Save reading to DB immediately
            conn = get_db_connection()
            conn.execute("INSERT OR IGNORE INTO stations (station_id, name, lat, lon) VALUES (?, ?, ?, ?)", 
                         (station_id, name, lat, lon)) 
            
            conn.execute("""
                INSERT INTO readings (station_id, ts, temperature, pressure, humidity, edge_flag)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (station_id, reading['timestamp'], reading['temperature'], reading['pressure'], reading['humidity'], edge_flag))
            conn.commit()

            # Run Detection
            hist_df = get_recent_history(station_id, 20)
            neighbors = get_neighbors_readings(lat, lon)

            # Note: Models are un-fitted at startup. 
            # In a real app we'd trigger fit() after N messages.
            # For hackathon, if not fitted, they fallback gracefully.
            ensemble_results = {
                'statistical': stat_detector.predict(reading),
                'temporal': temp_detector.predict(hist_df),
                'multivariate': multi_detector.predict(reading),
                'spatial': spat_detector.predict(reading, neighbors)
            }

            fusion_res = fusion_model.predict(ensemble_results, edge_flag)
            
            if fusion_res['is_anomaly']:
                rc_label = root_cause.classify(ensemble_results, edge_flag, reading)
                corr_vals = corrector.correct(reading, hist_df, neighbors)
                
                alert_dict = {
                    "station_id": station_id,
                    "ts": reading['timestamp'],
                    "severity": "high" if fusion_res['confidence'] > 0.8 else "medium",
                    "confidence": fusion_res['confidence'],
                    "root_cause": rc_label,
                    "raw_value_json": json.dumps(reading),
                    "corrected_value_json": json.dumps(corr_vals),
                    "shap_json": json.dumps(fusion_res['shap_values']),
                    "status": "active"
                }
                
                conn.execute("""
                    INSERT INTO alerts (station_id, ts, severity, confidence, root_cause, raw_value_json, corrected_value_json, shap_json, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (alert_dict['station_id'], alert_dict['ts'], alert_dict['severity'], alert_dict['confidence'], alert_dict['root_cause'],
                      alert_dict['raw_value_json'], alert_dict['corrected_value_json'], alert_dict['shap_json'], alert_dict['status']))
                conn.commit()
                
                # Broadcast alert
                await manager.broadcast(json.dumps({"type": "NEW_ALERT", "data": alert_dict}))

            # Update health tracker
            # A simple drift score can be reconstruction error from temporal detector
            drift_score = ensemble_results['temporal'].get('score', 0.0)
            if isinstance(drift_score, dict): drift_score = 0.0 # safety
            health_tracker.update(station_id, fusion_res['is_anomaly'], drift_score)
            h_data = health_tracker.get_health(station_id)
            
            conn.execute("""
                INSERT OR REPLACE INTO sensor_health (station_id, rolling_anomaly_rate, drift_trend, last_updated, maintenance_due_estimate)
                VALUES (?, ?, ?, ?, ?)
            """, (station_id, h_data['rolling_anomaly_rate'], h_data['drift_trend'], h_data['last_updated'], h_data['maintenance_due_estimate']))
            conn.commit()
            
            conn.close()

            # Broadcast Reading
            await manager.broadcast(json.dumps({"type": "NEW_READING", "data": reading}))

        except Exception as e:
            print(f"Error processing message: {e}")

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    init_db()
    
    # Pre-train some dummy models or just let them fallback
    # For a real demo, we'd want mock data to `fit` them so they actually predict.
    # We will let them fallback to returning 0/False, but `fusion_model` 
    # heuristic will catch anomalies if edge_flag is suspect.
    # To make the prototype fully functional for the demo, we rely on the anomaly heuristic in `predict`.
    
    # Start MQTT Client
    client = mqtt.Client(client_id="FastAPI_Backend")
    client.on_connect = on_connect
    client.on_message = on_mqtt_message
    
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"Warning: Could not connect to MQTT broker on startup: {e}")
        
    asyncio.create_task(process_messages())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
