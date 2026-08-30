import numpy as np

class SpatialDetector:
    def __init__(self, z_threshold=3.0):
        self.z_threshold = z_threshold
        # Cache for neighbor associations if needed, but for prototype we can compute on the fly
        # assuming `neighbors_readings` is provided in predict.

    def predict(self, target_reading, neighbors_readings):
        """
        target_reading: dict with temperature, pressure, humidity
        neighbors_readings: list of dicts with same keys from nearby stations at the same time
        """
        if not neighbors_readings or len(neighbors_readings) < 3:
            return {'detector_name': 'spatial', 'is_anomaly': False, 'score': 0.0}

        results = {}
        max_z = 0.0
        
        for param in ['temperature', 'pressure', 'humidity']:
            neighbor_vals = [r[param] for r in neighbors_readings if param in r]
            if not neighbor_vals:
                continue
                
            mean = np.mean(neighbor_vals)
            std = np.std(neighbor_vals) + 1e-5 # prevent div by zero
            
            val = target_reading[param]
            z_score = abs(val - mean) / std
            
            results[param] = {
                'z_score': z_score,
                'is_anomaly': z_score > self.z_threshold
            }
            if z_score > max_z:
                max_z = z_score

        is_anomaly = any(r['is_anomaly'] for r in results.values())
        
        return {
            'detector_name': 'spatial',
            'is_anomaly': is_anomaly,
            'score': max_z,
            'details': results
        }
