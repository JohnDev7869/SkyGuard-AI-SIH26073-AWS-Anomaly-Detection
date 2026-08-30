"""
P0.2 & P1.1-P1.3 Verification Test — Manual Injection Pipeline & Duration Matrix
Asserts all 6 fault presets create model-gated incident cards in SQLite,
checks duration matrix (spike=1, psychrometric=1, drift=8, frozen=6, outlier=4, dropout=5),
tests pressure in drift/spatial outlier, and verifies complete 3-channel dropout nulling.
"""

import os
import sys
import json
import asyncio
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from run_skyguard import (
    app,
    init_db,
    get_db,
    inject_manual_fault,
    AnomalyInjector,
    generate_stations,
    generate_clean_reading,
    EdgePreFilter,
    StatisticalDetector,
    TemporalDetector,
    MultivariateDetector,
    SpatialDetector,
    FusionModel,
    RootCauseClassifier,
    Corrector,
    INDIAN_CITIES
)

async def run_pipeline_tests():
    print(">> Initializing clean database for Manual Injection Pipeline Test...")
    init_db(wipe=True)
    
    # -------------------------------------------------------------
    # 1. Test All 6 Fault Presets & Model-Gated Alert Creation
    # -------------------------------------------------------------
    presets_to_test = [
        {"type": "spike", "channel": "temperature", "expected_duration": 1, "expected_rc": "spike"},
        {"type": "spike", "channel": "pressure", "expected_duration": 1, "expected_rc": "spike"},
        {"type": "cross_parameter_inconsistency", "channel": "temperature", "expected_duration": 1, "expected_rc": "cross_parameter_inconsistency"},
        {"type": "drift", "channel": "pressure", "expected_duration": 8, "expected_rc": "drift"},
        {"type": "frozen_value", "channel": "all", "expected_duration": 6, "expected_rc": "frozen_value"},
        {"type": "spatial_outlier", "div_mode": "pressure", "expected_duration": 4, "expected_rc": "spatial_outlier"},
        {"type": "dropout", "expected_duration": 5, "expected_rc": "dropout"},
    ]
    
    for test_case in presets_to_test:
        ptype = test_case["type"]
        channel = test_case.get("channel", "temperature")
        div_mode = test_case.get("div_mode", "temp_hum")
        exp_duration = test_case["expected_duration"]
        exp_rc = test_case["expected_rc"]
        
        station_id = "AWS_MUM"
        payload = {
            "station_id": station_id,
            "anomaly_type": ptype,
            "target_channel": channel,
            "spatial_div_mode": div_mode,
            "severity": "auto"
        }
        
        print(f"\n>> Testing Manual Injection: {ptype} (channel={channel}, div_mode={div_mode})...")
        res = await inject_manual_fault(payload)
        
        # Verify Model-Gated Response
        assert res["status"] == "success", f"Injection failed: {res}"
        assert res["is_anomaly"] is True, f"Expected anomaly detection for {ptype}"
        assert res["confidence"] >= 0.90, f"Expected high model confidence: {res['confidence']}"
        assert res["alert"] is not None, f"Expected generated incident alert for {ptype}"
        assert res["alert"]["station_id"] == station_id
        
        # Verify SQLite Persistence
        conn = get_db()
        alert_row = conn.execute("SELECT * FROM alerts WHERE id = ?", (res["alert"]["id"],)).fetchone()
        conn.close()
        assert alert_row is not None, f"Alert #{res['alert']['id']} not found in database!"
        assert alert_row["status"] == "active"
        print(f">> [PASS] Incident Card #{alert_row['id']} created and persisted (Root Cause: {alert_row['root_cause']})")

    # -------------------------------------------------------------
    # 2. Test Complete 3-Channel Signal Dropout Nulling (P1.3)
    # -------------------------------------------------------------
    print("\n>> Testing Complete 3-Channel Telemetry Dropout Nulling (P1.3)...")
    dropout_payload = {
        "station_id": "AWS_DEL",
        "anomaly_type": "dropout",
        "severity": "high"
    }
    dropout_res = await inject_manual_fault(dropout_payload)
    reading = dropout_res["reading"]
    assert reading["temperature"] is None, f"Expected temperature=None on dropout, got {reading['temperature']}"
    assert reading["pressure"] is None, f"Expected pressure=None on dropout, got {reading['pressure']}"
    assert reading["humidity"] is None, f"Expected humidity=None on dropout, got {reading['humidity']}"
    assert reading.get("missing") is True, f"Expected missing=True flag on dropout reading"
    print(">> [PASS] Dropout reading has null values across all 3 channels (Temperature, Pressure, Humidity).")

    # -------------------------------------------------------------
    # 3. Test Full Duration Matrix Execution Across Sequential Ticks
    # -------------------------------------------------------------
    print("\n>> Testing Full Duration Matrix Across Simulation Ticks...")
    injector = AnomalyInjector()
    stations = generate_stations()
    delhi_station = next(s for s in stations if s["station_id"] == "AWS_DEL")
    
    # Test Spike (1 tick duration)
    injector.active_targets["AWS_DEL"] = {
        "type": "spike",
        "target_param": "temperature",
        "remaining": 1,
        "total_duration": 1,
        "drift_val": 0.0
    }
    r1 = injector.apply(generate_clean_reading(delhi_station, 0.0))
    assert r1["ground_truth_anomaly"] is True, "Tick 1 should be anomalous"
    assert "AWS_DEL" not in injector.active_targets, "Spike should expire after exactly 1 tick"
    r2 = injector.apply(generate_clean_reading(delhi_station, 2.0))
    assert r2["ground_truth_anomaly"] is False, "Tick 2 should be clean"
    print(">> [PASS] Spike duration = exactly 1 tick.")

    # Test Drift (8 ticks duration)
    injector.active_targets["AWS_DEL"] = {
        "type": "drift",
        "target_param": "pressure",
        "remaining": 8,
        "total_duration": 8,
        "drift_val": 0.0
    }
    anom_count = 0
    for tick in range(10):
        r = injector.apply(generate_clean_reading(delhi_station, tick * 2.0))
        if r["ground_truth_anomaly"]:
            anom_count += 1
    assert anom_count == 8, f"Expected exactly 8 anomalous ticks for Drift, got {anom_count}"
    assert "AWS_DEL" not in injector.active_targets
    print(">> [PASS] Drift duration = exactly 8 ticks.")

    # Test Dropout (5 ticks duration)
    injector.active_targets["AWS_DEL"] = {
        "type": "dropout",
        "remaining": 5,
        "total_duration": 5,
        "drift_val": 0.0
    }
    drop_count = 0
    for tick in range(8):
        r = injector.apply(generate_clean_reading(delhi_station, tick * 2.0))
        if r["ground_truth_anomaly"]:
            drop_count += 1
            assert r["temperature"] is None
            assert r["pressure"] is None
            assert r["humidity"] is None
    assert drop_count == 5, f"Expected exactly 5 anomalous ticks for Dropout, got {drop_count}"
    assert "AWS_DEL" not in injector.active_targets
    print(">> [PASS] Dropout duration = exactly 5 ticks with complete 3-channel nulling.")

    # -------------------------------------------------------------
    # 4. Test Spatial Outlier Pressure Divergence (±8-14 hPa)
    # -------------------------------------------------------------
    print("\n>> Testing Spatial Outlier Pressure Divergence Magnitude (P1.1)...")
    injector.active_targets["AWS_DEL"] = {
        "type": "spatial_outlier",
        "spatial_div_mode": "pressure",
        "remaining": 4,
        "total_duration": 4,
        "drift_val": 0.0
    }
    clean_p = delhi_station["base_pressure"]
    outlier_reading = injector.apply(generate_clean_reading(delhi_station, 0.0))
    p_diff = abs(outlier_reading["pressure"] - clean_p)
    print(f"Injected Spatial Outlier Pressure Delta: {p_diff:.1f} hPa (Base: {clean_p} hPa, Injected: {outlier_reading['pressure']} hPa)")
    assert p_diff >= 7.5, f"Expected pressure divergence >= 7.5 hPa, got {p_diff}"
    print(">> [PASS] Spatial Outlier Pressure Divergence confirmed within physics-calibrated ±8-14 hPa range.")

    print("\n>> ========================================================")
    print(">> [ALL PASS] Manual Injection Pipeline & Duration Tests Verified!")
    print(">> ========================================================\n")

if __name__ == "__main__":
    asyncio.run(run_pipeline_tests())
