import time
import math
import json
import random
import datetime
import sys
import os
import paho.mqtt.client as mqtt
from anomaly_injector import AnomalyInjector

# Import EdgePreFilter
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from edge.prefilter import EdgePreFilter

NUM_STATIONS = 25
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
PUBLISH_INTERVAL = 2 # seconds

def generate_stations(num_stations):
    cities = [
        {"id": "AWS_MUM", "name": "Mumbai", "lat": 19.0760, "lon": 72.8777, "t": 30, "p": 1010, "h": 75},
        {"id": "AWS_DEL", "name": "Delhi", "lat": 28.7041, "lon": 77.1025, "t": 35, "p": 1005, "h": 40},
        {"id": "AWS_BLR", "name": "Bangalore", "lat": 12.9716, "lon": 77.5946, "t": 25, "p": 1015, "h": 60},
        {"id": "AWS_HYD", "name": "Hyderabad", "lat": 17.3850, "lon": 78.4867, "t": 32, "p": 1010, "h": 50},
        {"id": "AWS_MAA", "name": "Chennai", "lat": 13.0827, "lon": 80.2707, "t": 33, "p": 1008, "h": 80},
        {"id": "AWS_CCU", "name": "Kolkata", "lat": 22.5726, "lon": 88.3639, "t": 31, "p": 1009, "h": 78},
        {"id": "AWS_PNQ", "name": "Pune", "lat": 18.5204, "lon": 73.8567, "t": 28, "p": 1012, "h": 55},
        {"id": "AWS_AMD", "name": "Ahmedabad", "lat": 23.0225, "lon": 72.5714, "t": 36, "p": 1006, "h": 45},
        {"id": "AWS_STV", "name": "Surat", "lat": 21.1702, "lon": 72.8311, "t": 34, "p": 1008, "h": 65},
        {"id": "AWS_JAI", "name": "Jaipur", "lat": 26.9124, "lon": 75.7873, "t": 38, "p": 1002, "h": 30},
        {"id": "AWS_LKO", "name": "Lucknow", "lat": 26.8467, "lon": 80.9462, "t": 34, "p": 1005, "h": 50},
        {"id": "AWS_KNP", "name": "Kanpur", "lat": 26.4499, "lon": 80.3319, "t": 35, "p": 1004, "h": 48},
        {"id": "AWS_NAG", "name": "Nagpur", "lat": 21.1458, "lon": 79.0882, "t": 37, "p": 1005, "h": 40},
        {"id": "AWS_IDR", "name": "Indore", "lat": 22.7196, "lon": 75.8577, "t": 32, "p": 1009, "h": 50},
        {"id": "AWS_BHO", "name": "Bhopal", "lat": 23.2599, "lon": 77.4126, "t": 33, "p": 1008, "h": 52},
        {"id": "AWS_COK", "name": "Kochi", "lat": 9.9312, "lon": 76.2673, "t": 30, "p": 1011, "h": 82},
        {"id": "AWS_TRV", "name": "Trivandrum", "lat": 8.5241, "lon": 76.9366, "t": 31, "p": 1010, "h": 80},
        {"id": "AWS_VTZ", "name": "Visakhapatnam", "lat": 17.6868, "lon": 83.2185, "t": 32, "p": 1009, "h": 76},
        {"id": "AWS_PAT", "name": "Patna", "lat": 25.5941, "lon": 85.1376, "t": 34, "p": 1006, "h": 55},
        {"id": "AWS_IXC", "name": "Chandigarh", "lat": 30.7333, "lon": 76.7794, "t": 32, "p": 1008, "h": 45},
        {"id": "AWS_BBI", "name": "Bhubaneswar", "lat": 20.2961, "lon": 85.8245, "t": 33, "p": 1007, "h": 70},
        {"id": "AWS_GAU", "name": "Guwahati", "lat": 26.1445, "lon": 91.7362, "t": 29, "p": 1010, "h": 75},
        {"id": "AWS_IXR", "name": "Ranchi", "lat": 23.3441, "lon": 85.3096, "t": 28, "p": 1011, "h": 50},
        {"id": "AWS_MYQ", "name": "Mysore", "lat": 12.2958, "lon": 76.6394, "t": 26, "p": 1014, "h": 58},
        {"id": "AWS_CJB", "name": "Coimbatore", "lat": 11.0168, "lon": 76.9558, "t": 28, "p": 1012, "h": 62},
    ]
    
    stations = []
    for city in cities[:num_stations]:
        stations.append({
            "station_id": city["id"],
            "name": city["name"],
            "lat": city["lat"],
            "lon": city["lon"],
            "base_temp": city["t"],
            "base_pressure": city["p"],
            "base_humidity": city["h"],
            "phase_offset": random.uniform(0, 2 * math.pi)
        })
    return stations

def generate_clean_reading(station, t):
    # Simulated diurnal pattern (24h period, scaled for faster demo: let's say 1 "day" = 5 minutes = 300s)
    # Actually, let's keep it somewhat realistic but compressed if needed. We'll use actual time for now,
    # but speed up the diurnal cycle so it's visible. Let's make 1 hour = 60 seconds (1 minute).
    # So 24 hours = 24 minutes.
    cycle_speedup = 60 # 60x faster
    virtual_t = t * cycle_speedup
    
    # 24 hours in seconds = 86400
    diurnal_factor = math.sin(virtual_t * 2 * math.pi / 86400 + station['phase_offset'])
    
    # Temp peaks in day
    temperature = station['base_temp'] + 5 * diurnal_factor + random.gauss(0, 0.2)
    
    # Humidity dips when temp peaks
    humidity = station['base_humidity'] - 15 * diurnal_factor + random.gauss(0, 1.0)
    humidity = max(0, min(100, humidity))
    
    # Pressure has small semi-diurnal tides and weather changes (using a slower sine)
    weather_factor = math.sin(virtual_t * 2 * math.pi / (86400 * 3)) # 3 day cycle
    pressure = station['base_pressure'] + 3 * weather_factor - 0.5 * diurnal_factor + random.gauss(0, 0.5)

    return {
        "station_id": station["station_id"],
        "name": station["name"],
        "lat": station["lat"],
        "lon": station["lon"],
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "temperature": round(temperature, 2),
        "pressure": round(pressure, 2),
        "humidity": round(humidity, 2)
    }

def main():
    stations = generate_stations(NUM_STATIONS)
    injector = AnomalyInjector(rate=0.20, ground_truth_file="ground_truth.csv")
    edge_filter = EdgePreFilter(window_size=5)
    
    client = mqtt.Client(client_id="StationSimulator")
    
    connected = False
    while not connected:
        try:
            print(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            connected = True
        except Exception as e:
            print(f"Connection failed: {e}. Retrying in 2 seconds...")
            time.sleep(2)

    client.loop_start()
    
    start_time = time.time()
    
    print("Simulator started. Publishing readings...")
    try:
        while True:
            current_time = time.time()
            elapsed = current_time - start_time
            
            for station in stations:
                clean_reading = generate_clean_reading(station, elapsed)
                
                # Apply anomalies (may return None if dropped)
                final_reading = injector.apply(clean_reading)
                
                if final_reading is not None:
                    # Run it through the edge filter
                    final_reading_json = edge_filter.process(json.dumps(final_reading))
                    
                    topic = f"skyguard-demo/awsnet/{station['station_id']}/reading"
                    client.publish(topic, final_reading_json)
                    print(f"Published to {topic}: {final_reading_json}")
            
            time.sleep(PUBLISH_INTERVAL)
            
    except KeyboardInterrupt:
        print("Simulator stopped.")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
