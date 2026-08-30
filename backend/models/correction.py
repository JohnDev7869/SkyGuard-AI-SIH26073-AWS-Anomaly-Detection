import numpy as np

class Corrector:
    def __init__(self):
        # We will use a simplified 1D Kalman Filter per parameter
        # state: (value, velocity)
        pass

    def apply_kalman_1d(self, history, current_time, process_noise=1e-2, measurement_noise=0.1):
        """
        history: list of (time_sec, value)
        """
        if len(history) < 2:
            return history[-1][1] if history else None
            
        # Initialize
        x = np.array([history[0][1], 0.0]) # [position, velocity]
        P = np.eye(2) * 1.0
        
        for i in range(1, len(history)):
            dt = history[i][0] - history[i-1][0]
            z = history[i][1]
            
            # Predict
            F = np.array([[1, dt], [0, 1]])
            Q = np.array([[process_noise, 0], [0, process_noise]])
            x = F @ x
            P = F @ P @ F.T + Q
            
            # Update
            H = np.array([[1, 0]])
            R = np.array([[measurement_noise]])
            y = z - (H @ x)[0]
            S = H @ P @ H.T + R
            K = P @ H.T @ np.linalg.inv(S)
            
            x = x + (K @ [y]).flatten()
            P = (np.eye(2) - K @ H) @ P
            
        # Predict for current time
        dt = current_time - history[-1][0]
        F = np.array([[1, dt], [0, 1]])
        x_pred = F @ x
        
        return float(x_pred[0])

    def correct(self, reading, history_df, neighbor_readings=None):
        """
        reading: anomalous reading
        history_df: recent clean readings for this station
        neighbor_readings: readings from neighbors at the same time
        """
        corrected = {}
        
        for param in ['temperature', 'pressure', 'humidity']:
            kalman_est = None
            if len(history_df) > 0:
                # Convert history to (timestamp_sec, value)
                # assuming index or a 'ts' column can be parsed. For simplicity, we just use pseudo-time 1,2,3...
                # if actual timestamps are needed we parse them. Here we just use step = 1.
                hist_vals = history_df[param].dropna().values
                hist_pairs = [(float(i), float(v)) for i, v in enumerate(hist_vals)]
                if hist_pairs:
                    kalman_est = self.apply_kalman_1d(hist_pairs, len(hist_pairs))
            
            spatial_est = None
            if neighbor_readings:
                vals = [r[param] for r in neighbor_readings if param in r]
                if vals:
                    spatial_est = np.mean(vals)
                    
            # Blend the estimates
            if kalman_est is not None and spatial_est is not None:
                # 50/50 blend
                corrected[param] = 0.5 * kalman_est + 0.5 * spatial_est
            elif kalman_est is not None:
                corrected[param] = kalman_est
            elif spatial_est is not None:
                corrected[param] = spatial_est
            else:
                # Fallback to last known good value or current reading
                corrected[param] = reading[param]
                
        return corrected
