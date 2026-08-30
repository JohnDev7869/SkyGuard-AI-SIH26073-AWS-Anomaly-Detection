import numpy as np
from sklearn.ensemble import IsolationForest

class StatisticalDetector:
    def __init__(self, contamination=0.05):
        # We use IsolationForest to catch obvious statistical outliers
        self.models = {
            'temperature': IsolationForest(contamination=contamination, random_state=42),
            'pressure': IsolationForest(contamination=contamination, random_state=42),
            'humidity': IsolationForest(contamination=contamination, random_state=42)
        }
        self.is_fitted = {k: False for k in self.models.keys()}

    def fit(self, history_df):
        """
        history_df should be a pandas DataFrame containing historical 
        readings for a specific station or across the network.
        """
        for param in self.models.keys():
            if param in history_df.columns and len(history_df) > 50:
                data = history_df[[param]].dropna().values
                self.models[param].fit(data)
                self.is_fitted[param] = True

    def predict(self, reading):
        """
        reading: dict with temperature, pressure, humidity
        Returns: dict of anomaly scores per parameter (-1 is anomaly, 1 is normal)
                 and a raw decision_function score (lower is more anomalous)
        """
        results = {}
        for param in self.models.keys():
            if self.is_fitted[param]:
                val = np.array([[reading[param]]])
                pred = self.models[param].predict(val)[0]
                score = self.models[param].decision_function(val)[0]
                results[param] = {
                    'is_anomaly': pred == -1,
                    'score': float(score)
                }
            else:
                results[param] = {
                    'is_anomaly': False,
                    'score': 0.0
                }
                
        # Aggregate score: minimum score across parameters (most anomalous)
        agg_score = min(res['score'] for res in results.values())
        return {
            'detector_name': 'statistical',
            'is_anomaly': any(res['is_anomaly'] for res in results.values()),
            'score': agg_score,
            'details': results
        }
