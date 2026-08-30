import numpy as np
from scipy.spatial.distance import mahalanobis

class MultivariateDetector:
    def __init__(self, threshold_percentile=99):
        self.threshold_percentile = threshold_percentile
        self.mean = None
        self.cov_inv = None
        self.threshold = 0.0
        self.is_fitted = False

    def fit(self, history_df):
        """
        history_df should be a pandas DataFrame containing historical 
        readings for a specific station or across the network.
        Need at least some valid rows to compute covariance.
        """
        data = history_df[['temperature', 'pressure', 'humidity']].dropna().values
        if len(data) < 10:
            return
            
        self.mean = np.mean(data, axis=0)
        cov = np.cov(data, rowvar=False)
        
        # Add small ridge to diagonal for numerical stability
        cov += np.eye(cov.shape[0]) * 1e-5
        self.cov_inv = np.linalg.inv(cov)
        
        # Calculate distances for training data to find threshold
        distances = []
        for row in data:
            dist = mahalanobis(row, self.mean, self.cov_inv)
            distances.append(dist)
            
        self.threshold = np.percentile(distances, self.threshold_percentile)
        self.is_fitted = True

    def predict(self, reading):
        """
        reading: dict with temperature, pressure, humidity
        """
        if not self.is_fitted:
            return {'detector_name': 'multivariate', 'is_anomaly': False, 'score': 0.0}
            
        vec = np.array([reading['temperature'], reading['pressure'], reading['humidity']])
        dist = mahalanobis(vec, self.mean, self.cov_inv)
        
        is_anomaly = dist > self.threshold
        
        return {
            'detector_name': 'multivariate',
            'is_anomaly': is_anomaly,
            'score': dist,
            'details': {'mahalanobis_distance': dist, 'threshold': self.threshold}
        }
