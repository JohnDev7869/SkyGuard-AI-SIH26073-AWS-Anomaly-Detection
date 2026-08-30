import random
import csv
import os
import time

class AnomalyInjector:
    def __init__(self, rate=0.008, ground_truth_file="ground_truth.csv"):
        self.rate = rate
        self.ground_truth_file = ground_truth_file
        self.anomaly_types = [
            "spike",
            "frozen_value",
            "drift",
            "dropout",
            "cross_parameter_inconsistency",
            "spatial_outlier"
        ]
        # Track ongoing states for persistent anomalies (frozen, drift)
        self.station_states = {}
        
        # Initialize CSV header if not exists
        if not os.path.exists(self.ground_truth_file):
            with open(self.ground_truth_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'station_id', 'anomaly_type', 'description'])

    def log_ground_truth(self, timestamp, station_id, anomaly_type, description):
        with open(self.ground_truth_file, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([timestamp, station_id, anomaly_type, description])

    def apply(self, reading):
        station_id = reading['station_id']
        timestamp = reading['timestamp']
        
        if station_id not in self.station_states:
            self.station_states[station_id] = {'type': 'normal', 'remaining_ticks': 0, 'value': None, 'drift_amount': 0.0}

        state = self.station_states[station_id]

        # Check if we should start a new anomaly (capped at 2 active anomalies across network)
        active_anomalies = sum(1 for s in self.station_states.values() if s['type'] != 'normal')
        if state['type'] == 'normal' and active_anomalies < 2 and random.random() < self.rate:
            state['type'] = random.choice(self.anomaly_types)
            if state['type'] in ['frozen_value', 'drift']:
                state['remaining_ticks'] = random.randint(5, 15)
                state['value'] = {
                    'temperature': reading['temperature'],
                    'pressure': reading['pressure'],
                    'humidity': reading['humidity']
                }
                state['drift_amount'] = 0.0
            
            # For dropout, just drop it once or multiple times
            if state['type'] == 'dropout':
                state['remaining_ticks'] = random.randint(1, 3)

        # Apply anomaly based on current state
        if state['type'] == 'spike':
            param = random.choice(['temperature', 'pressure', 'humidity'])
            magnitude = random.choice([-1, 1]) * random.uniform(10, 30)
            if param == 'pressure':
                magnitude *= 5 # Pressure spikes are larger in hPa
            reading[param] += magnitude
            self.log_ground_truth(timestamp, station_id, 'spike', f"{param} spiked by {magnitude:.2f}")
            state['type'] = 'normal' # Spikes are one-off

        elif state['type'] == 'frozen_value':
            reading['temperature'] = state['value']['temperature'] + random.uniform(-0.01, 0.01)
            reading['pressure'] = state['value']['pressure'] + random.uniform(-0.1, 0.1)
            reading['humidity'] = state['value']['humidity'] + random.uniform(-0.01, 0.01)
            self.log_ground_truth(timestamp, station_id, 'frozen_value', "Values frozen")
            state['remaining_ticks'] -= 1
            if state['remaining_ticks'] <= 0:
                state['type'] = 'normal'

        elif state['type'] == 'drift':
            state['drift_amount'] += random.uniform(0.1, 0.5)
            reading['temperature'] += state['drift_amount']
            self.log_ground_truth(timestamp, station_id, 'drift', f"Temperature drifted by {state['drift_amount']:.2f}")
            state['remaining_ticks'] -= 1
            if state['remaining_ticks'] <= 0:
                state['type'] = 'normal'

        elif state['type'] == 'dropout':
            self.log_ground_truth(timestamp, station_id, 'dropout', "Reading dropped")
            state['remaining_ticks'] -= 1
            if state['remaining_ticks'] <= 0:
                state['type'] = 'normal'
            return None # Indicate dropout

        elif state['type'] == 'cross_parameter_inconsistency':
            # e.g., High humidity + High Temp + Pressure spike simultaneously
            reading['temperature'] = min(reading['temperature'] + 15, 55.0) # Up to 55C
            reading['humidity'] = min(reading['humidity'] + 40, 95.0) # Up to 95%
            reading['pressure'] += 20 # Spike pressure
            self.log_ground_truth(timestamp, station_id, 'cross_parameter_inconsistency', "Physically inconsistent state")
            state['type'] = 'normal'

        elif state['type'] == 'spatial_outlier':
            # Offset significantly so it doesn't match neighbors
            reading['temperature'] += 10
            reading['humidity'] -= 20
            self.log_ground_truth(timestamp, station_id, 'spatial_outlier', "Deviating from spatial trend")
            state['type'] = 'normal'

        return reading
