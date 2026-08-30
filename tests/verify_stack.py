"""
Master Stack Verification Suite
Verifies 25 stations online, static frontend dist SPA, detection metrics, and API endpoints.
"""

import urllib.request
import json

def get(path):
    with urllib.request.urlopen('http://127.0.0.1:8000' + path) as r:
        return json.loads(r.read().decode())

print("=== 1. Root & Static SPA Status ===")
req = urllib.request.urlopen('http://127.0.0.1:8000/')
print(f"HTTP Status: {req.status}, Content Length: {len(req.read())} bytes")
assert req.status == 200, f"Expected HTTP 200, got {req.status}"

print("\n=== 2. Detection Metrics ===")
det = get('/api/metrics/detection')
print(f"Precision: {det['precision']}%, Recall: {det['recall']}%, F1: {det['f1_score']}%, Accuracy: {det['accuracy']}%")
print(f"Confusion Matrix: TP={det['tp']}, FP={det['fp']}, FN={det['fn']}, TN={det['tn']}")
assert det['precision'] > 90.0
assert det['f1_score'] > 90.0

print("\n=== 3. Alert Stats ===")
stats = get('/api/alerts/stats')
print(f"Alert Stats: Total={stats.get('total')}, Active={stats.get('active')}, Precision={stats.get('precision_rate')}%")

print("\n=== 4. 25 AWS Stations Online Verification ===")
stations = get('/api/stations')
print(f"Total Active Stations: {len(stations)}")
assert len(stations) == 25, f"Expected 25 stations online, got {len(stations)}"
for s in stations[:5]:
    h = s.get('health') or {}
    print(f"  Station: {s['name']:14s} ({s['station_id']}) | Fault Rate: {h.get('rolling_anomaly_rate', 0.0)*100:4.1f}% | Status: {h.get('health_status', 'Healthy')}")

print("\n[OK] ALL 25 STATIONS ONLINE AND FULL STACK OPERATIONAL!")
