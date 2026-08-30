# SkyGuard AI

An intelligent real-time anomaly detection system for Automatic Weather Stations (AWS).

## Architecture

1. **Simulator**: Generates realistic T/P/RH data for 15 stations and injects anomalies (spikes, drift, etc.).
2. **Edge Pre-Filter**: Filters obvious bounds at the edge to reduce load.
3. **MQTT + DB**: Ingests data via Mosquitto and stores in SQLite.
4. **Detection Ensemble**:
   - *Statistical*: Isolation Forest for univariate spikes.
   - *Temporal*: LSTM-Autoencoder for seasonal/diurnal deviations.
   - *Multivariate*: Mahalanobis distance for physical correlation checks.
   - *Spatial*: Z-Score across neighboring stations.
5. **Fusion & Explainability**: XGBoost Meta-classifier trained on sub-detectors, providing SHAP values.
6. **Dashboard**: React dashboard visualizing the network, anomalies, SHAP values, and suggested corrections.

## Running the Prototype

### Prerequisites
- Docker & Docker Compose

### Start Services
Run the following in the root directory:
```bash
docker compose up --build
```

### Components
1. **MQTT Broker**: `localhost:1883`
2. **Backend API**: `http://localhost:8000`
3. **Frontend Dashboard**: `http://localhost:5173`

### Start the Simulator
To inject data and anomalies into the system, open a separate terminal and run:
```bash
cd simulator
# Ensure you have the required python packages (e.g. paho-mqtt)
pip install paho-mqtt
python station_sim.py
```

### Demo Flow
1. Open the Dashboard (`http://localhost:5173`).
2. Watch the simulator emit normal readings.
3. When the simulator injects an anomaly (e.g. a spike or cross-parameter inconsistency), watch the network map pin turn Red.
4. Click the Alert in the feed to see the SHAP explanation indicating which detector triggered the alarm.
5. Click the station on the map to view the detailed time-series graph with the corrected value overlaid.
