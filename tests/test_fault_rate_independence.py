"""
P0.1 Verification Test — Fault Rate Independence & Pairwise Correlation
Asserts that station fault rates do not move in lockstep, pairwise event correlation < 0.75 across all pairs,
and state objects have 100% independent memory references.
"""

import os
import sys
import numpy as np

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from run_skyguard import (
    SensorHealthTracker, 
    generate_stations, 
    generate_clean_reading, 
    AnomalyInjector, 
    EdgePreFilter,
    StatisticalDetector,
    TemporalDetector,
    MultivariateDetector,
    SpatialDetector,
    FusionModel,
    INDIAN_CITIES
)

def run_independence_test():
    print(">> Starting P0.1 Fault Rate Independence Test...")
    tracker = SensorHealthTracker()
    injector = AnomalyInjector()
    edge_filter = EdgePreFilter()
    
    stat_det = StatisticalDetector()
    temp_det = TemporalDetector()
    multi_det = MultivariateDetector()
    spat_det = SpatialDetector()
    fusion = FusionModel()
    
    stations = generate_stations()
    station_ids = [s['station_id'] for s in stations]
    
    # 1. State Reference Independence Assertion
    print(">> Checking memory reference independence across all stations...")
    for i in range(len(station_ids)):
        for j in range(i + 1, len(station_ids)):
            s1, s2 = station_ids[i], station_ids[j]
            ref1 = id(tracker.stats[s1]['anomaly_history'])
            ref2 = id(tracker.stats[s2]['anomaly_history'])
            assert ref1 != ref2, f"Shared reference detected between {s1} and {s2}!"
    print(">> [PASS] All station history buffers have 100% distinct memory references.")

    # 2. Multi-Tick Trajectory Recording
    NUM_TICKS = 40
    rate_trajectories = {sid: [] for sid in station_ids}
    event_trajectories = {sid: [] for sid in station_ids}
    delta_trajectories = {sid: [] for sid in station_ids}
    
    for t in range(NUM_TICKS):
        if t in [5, 12, 18, 25]:
            injector.trigger_scheduled_anomaly(stations)
            
        for st in stations:
            sid = st['station_id']
            clean = generate_clean_reading(st, t * 2.0)
            injected = injector.apply(clean)
            filtered = edge_filter.process(injected)
            
            ensemble_res = {
                'statistical': stat_det.predict(filtered),
                'temporal': temp_det.predict([]),
                'multivariate': multi_det.predict(filtered),
                'spatial': spat_det.predict(filtered, [])
            }
            f_res = fusion.predict(ensemble_res, filtered.get('edge_flag', 'clean'))
            
            tracker.update(sid, f_res['is_anomaly'], ensemble_res['temporal'].get('score', 0.0))
            h = tracker.get_health(sid)
            
            rate = h['rolling_anomaly_rate']
            rate_trajectories[sid].append(rate)
            event_trajectories[sid].append(1.0 if f_res['is_anomaly'] else 0.0)
            
            if len(rate_trajectories[sid]) > 1:
                delta = rate_trajectories[sid][-1] - rate_trajectories[sid][-2]
                delta_trajectories[sid].append(round(delta, 5))
            else:
                delta_trajectories[sid].append(0.0)

    # 3. Lockstep Delta Mirroring Test
    # Check that no two stations share identical non-zero delta trajectories for > 1 tick
    lockstep_delta_pairs = 0
    for i in range(len(station_ids)):
        for j in range(i + 1, len(station_ids)):
            s1, s2 = station_ids[i], station_ids[j]
            d1 = np.array(delta_trajectories[s1])
            d2 = np.array(delta_trajectories[s2])
            
            # Non-zero simultaneous identical deltas
            nonzero_identical = (d1 == d2) & (d1 != 0.0)
            streak = 0
            max_streak = 0
            for val in nonzero_identical:
                if val:
                    streak += 1
                    max_streak = max(max_streak, streak)
                else:
                    streak = 0
            if max_streak > 1:
                lockstep_delta_pairs += 1
                
    print(f"Station pairs with lockstep delta mirroring: {lockstep_delta_pairs}")
    assert lockstep_delta_pairs == 0, f"Detected {lockstep_delta_pairs} station pairs with lockstep delta mirroring!"

    # 4. Pairwise Event Correlation Test (< 0.75 across all pairs)
    event_corrs = []
    for i in range(len(station_ids)):
        for j in range(i + 1, len(station_ids)):
            s1, s2 = station_ids[i], station_ids[j]
            e1 = np.array(event_trajectories[s1])
            e2 = np.array(event_trajectories[s2])
            if np.std(e1) > 1e-6 and np.std(e2) > 1e-6:
                c = np.corrcoef(e1, e2)[0, 1]
                if not np.isnan(c):
                    event_corrs.append(c)
                    
    print(f"Pairs with varying events evaluated for Pearson correlation: {len(event_corrs)}")
    if event_corrs:
        avg_corr = np.mean(event_corrs)
        max_corr = np.max(event_corrs)
        print(f"Average pairwise event correlation: {avg_corr:.3f}")
        print(f"Max pairwise event correlation: {max_corr:.3f}")
        assert max_corr < 0.75, f"Pairwise correlation too high: {max_corr:.3f} >= 0.75"
        
    print(">> [PASS] P0.1 Fault Rate Independence verified successfully!")

if __name__ == "__main__":
    run_independence_test()
