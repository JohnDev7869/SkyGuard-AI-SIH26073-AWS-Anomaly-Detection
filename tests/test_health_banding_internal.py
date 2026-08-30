"""
P2.2 Verification Test — Health Banding Threshold Consistency
Verifies that Healthy (<10%), Warning (10-25%), and Critical (>25%) thresholds
are strictly and purely derived without contradiction across all 25 stations.
"""

import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from run_skyguard import SensorHealthTracker, INDIAN_CITIES

def test_banding():
    print(">> Testing Health Banding Consistency (P2.2)...")
    tracker = SensorHealthTracker()
    
    HEALTHY_MAX = 0.10
    WARNING_MAX = 0.25
    
    # Test specific threshold bounds
    test_cases = [
        (0.00, "Healthy", "Healthy"),
        (0.05, "Healthy", "Healthy"),
        (0.099, "Healthy", "Healthy"),
        (0.10, "Warning", "Warning (Within 7 days)"),
        (0.18, "Warning", "Warning (Within 7 days)"),
        (0.25, "Warning", "Warning (Within 7 days)"),
        (0.251, "Critical", "Urgent (Within 24h)"),
        (0.50, "Critical", "Urgent (Within 24h)"),
    ]
    
    for rate, exp_status, exp_due in test_cases:
        sid = "AWS_TEST"
        tracker.stats[sid] = {
            'anomaly_history': [1.0] * int(rate * 1000) + [0.0] * (1000 - int(rate * 1000)),
            'drift_history': [0.0] * 1000
        }
        h = tracker.get_health(sid)
        assert h['health_status'] == exp_status, f"Rate {rate*100}% got status {h['health_status']}, expected {exp_status}"
        assert h['maintenance_due_estimate'] == exp_due, f"Rate {rate*100}% got due {h['maintenance_due_estimate']}, expected {exp_due}"
        print(f"Rate {rate*100:4.1f}% -> Status: {h['health_status']:8s} | Maintenance: {h['maintenance_due_estimate']}")
        
    print("\n>> Testing all 25 live configured station health states...")
    for city in INDIAN_CITIES:
        sid = city["id"]
        h = tracker.get_health(sid)
        r = h["rolling_anomaly_rate"]
        st = h["health_status"]
        if r > WARNING_MAX:
            assert st == "Critical", f"Station {sid} rate {r*100}% > 25% but got {st}"
        elif r >= HEALTHY_MAX:
            assert st == "Warning", f"Station {sid} rate {r*100}% in [10%, 25%] but got {st}"
        else:
            assert st == "Healthy", f"Station {sid} rate {r*100}% < 10% but got {st}"
            
    print(f">> [PASS] Health banding thresholds verified consistently across all {len(INDIAN_CITIES)} stations!")

if __name__ == "__main__":
    test_banding()
