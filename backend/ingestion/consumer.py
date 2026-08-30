import paho.mqtt.client as mqtt
import json
import sqlite3
import os
import sys

# Add parent directory to path to import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.database import get_db_connection, init_db

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "awsnet/+/reading"

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        station_id = payload['station_id']
        ts = payload['timestamp']
        temperature = payload['temperature']
        pressure = payload['pressure']
        humidity = payload['humidity']
        # The simulator doesn't run the edge prefilter natively, but we can assume it passes 'clean' if not there
        edge_flag = payload.get('edge_flag', 'clean')

        conn = get_db_connection()
        
        # Ensure station exists
        conn.execute("INSERT OR IGNORE INTO stations (station_id, name) VALUES (?, ?)", 
                     (station_id, f"Station {station_id}"))

        # Insert reading
        conn.execute("""
            INSERT INTO readings (station_id, ts, temperature, pressure, humidity, edge_flag)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (station_id, ts, temperature, pressure, humidity, edge_flag))
        
        conn.commit()
        conn.close()
        
        # Print for debug
        print(f"Ingested reading for {station_id} at {ts}")
        
    except Exception as e:
        print(f"Error processing message: {e}")

def main():
    init_db() # Ensure DB is created
    
    client = mqtt.Client(client_id="BackendIngestion")
    client.on_connect = on_connect
    client.on_message = on_message
    
    print(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    
    client.loop_forever()

if __name__ == "__main__":
    main()
