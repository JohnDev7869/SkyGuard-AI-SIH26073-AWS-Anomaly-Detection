import urllib.request
import json

def get(path):
    with urllib.request.urlopen('http://127.0.0.1:8000' + path) as r:
        return json.loads(r.read().decode())

print("=== Testing Station Health Banding Thresholds ===")
stations = get('/api/stations')
assert len(stations) == 25, f"Expected 25 stations, got {len(stations)}"

HEALTHY_MAX = 0.10
WARNING_MAX = 0.25

for s in stations:
    h = s.get('health')
    if not h:
        continue
    rate = h.get('rolling_anomaly_rate', 0.0)
    due = h.get('maintenance_due_estimate', 'Healthy')
    
    if rate > WARNING_MAX:
        assert "Urgent" in due, f"Station {s['name']} has rate {rate*100}% (>25%) but due is '{due}'"
    elif rate >= HEALTHY_MAX:
        assert "Warning" in due, f"Station {s['name']} has rate {rate*100}% (10-25%) but due is '{due}'"
    else:
        assert due == "Healthy", f"Station {s['name']} has rate {rate*100}% (<10%) but due is '{due}'"

print(f"[OK] Verified health banding consistency across all {len(stations)} stations successfully!")
