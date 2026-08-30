import urllib.request
import json
import time

def post(path, payload):
    req = urllib.request.Request(
        'http://127.0.0.1:8000' + path,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def get(path):
    with urllib.request.urlopen('http://127.0.0.1:8000' + path) as r:
        return json.loads(r.read().decode())

print("=== 1. Injecting Manual Dropout Anomaly on AWS_MUM ===")
inj_res = post('/api/simulator/inject-manual', {
    'station_id': 'AWS_MUM',
    'temperature': -999.0,
    'pressure': 1010.0,
    'humidity': 0.0,
    'anomaly_type': 'dropout',
    'severity': 'high'
})
print("Injection Response Root Cause:", inj_res.get('root_cause'))
assert inj_res.get('is_anomaly') is True, "Must be flagged as anomaly"
assert inj_res.get('root_cause') == 'dropout', f"Expected dropout, got {inj_res.get('root_cause')}"

print("\n=== 2. Verifying Alert Exists in Alerts Tab / Feed ===")
alerts = get('/api/alerts?status=active')
mum_alerts = [a for a in alerts if a['station_id'] == 'AWS_MUM']
print(f"Total Active Alerts on AWS_MUM: {len(mum_alerts)}")
assert len(mum_alerts) > 0, "Active alert must exist for AWS_MUM"
latest = mum_alerts[0]
print(f"Latest Alert: Station={latest['station_id']}, RootCause={latest['root_cause']}, Severity={latest['severity']}")
assert latest['root_cause'] == 'dropout', "Alert root cause must be dropout"
assert latest['severity'] == 'high', "Severity must be high"

print("\n=== 3. Verifying Station Readings Output ===")
readings = get('/api/stations/AWS_MUM/readings?limit=5')
assert len(readings) > 0, "Readings must not be empty"
latest_reading = readings[-1] # most recent
print(f"Latest Reading: Temp={latest_reading.get('temperature')}, Anomaly={latest_reading.get('is_anomaly')}, Label={latest_reading.get('anomaly_label')}, Corrected={latest_reading.get('corrected_temp')}")
assert latest_reading.get('is_anomaly') is True, "Must be marked as anomaly in graph"
assert latest_reading.get('corrected_temp') > -100, f"Corrected temp must be valid baseline, got {latest_reading.get('corrected_temp')}"

print("\n[OK] DROPOUT PIPELINE & ALERTS TAB INTEGRATION VERIFIED 100%!")
