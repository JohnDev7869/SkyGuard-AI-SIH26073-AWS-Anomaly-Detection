import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from run_skyguard import compute_shap_and_explanation, haversine_distance_km

def test_distinct_neighbor_distances():
    reading = {
        'station_id': 'AWS_GAU',
        'name': 'Guwahati',
        'lat': 26.1445,
        'lon': 91.7362,
        'temperature': 39.5,
        'pressure': 1008,
        'humidity': 75
    }
    neighbors = [
        {'station_id': 'AWS_PAT', 'name': 'Patna', 'lat': 25.5941, 'lon': 85.1376, 'temperature': 34.0},
        {'station_id': 'AWS_CCU', 'name': 'Kolkata', 'lat': 22.5726, 'lon': 88.3639, 'temperature': 31.0},
        {'station_id': 'AWS_IXR', 'name': 'Ranchi', 'lat': 23.3441, 'lon': 85.3096, 'temperature': 28.0},
    ]
    ensemble_results = {
        'statistical': {'score': 0.8},
        'temporal': {'score': 0.5},
        'multivariate': {'score': 0.2},
        'spatial': {'score': 0.9}
    }
    
    res = compute_shap_and_explanation(reading, ensemble_results, 'clean', 'spatial_outlier', neighbors)
    spat = res['spatial_evidence']
    assert spat is not None, "Spatial evidence should not be None"
    
    distances = [n['distance_km'] for n in spat['neighbors']]
    print(f"Target: {spat['target_station']}")
    for n in spat['neighbors']:
        print(f"  Neighbor {n['name']} ({n['station_id']}): {n['distance_km']} km, {n['temperature']}°C")
        
    assert len(distances) == 3
    assert len(set(distances)) == len(distances), f"Distances must be distinct, got {distances}"
    assert distances[0] < distances[1] < distances[2], f"Distances should be sorted ascending: {distances}"
    print("✓ All neighbor distance assertions PASSED successfully!")

if __name__ == '__main__':
    test_distinct_neighbor_distances()
