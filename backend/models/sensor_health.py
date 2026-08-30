import datetime

class SensorHealthTracker:
    def __init__(self, window_size=100):
        # State per station
        self.stats = {}
        self.window_size = window_size

    def update(self, station_id, is_anomaly, drift_score):
        if station_id not in self.stats:
            self.stats[station_id] = {
                'anomaly_history': [],
                'drift_history': [],
            }
            
        st = self.stats[station_id]
        
        st['anomaly_history'].append(1.0 if is_anomaly else 0.0)
        st['drift_history'].append(drift_score)
        
        if len(st['anomaly_history']) > self.window_size:
            st['anomaly_history'].pop(0)
            st['drift_history'].pop(0)
            
    def get_health(self, station_id):
        if station_id not in self.stats:
            return {
                'rolling_anomaly_rate': 0.0,
                'drift_trend': 0.0,
                'maintenance_due_estimate': 'Healthy'
            }
            
        st = self.stats[station_id]
        
        anomaly_rate = sum(st['anomaly_history']) / len(st['anomaly_history'])
        drift_trend = sum(st['drift_history']) / len(st['drift_history'])
        
        if anomaly_rate > 0.2 or drift_trend > 0.5:
            maint_due = "Urgent (Within 24h)"
        elif anomaly_rate > 0.1 or drift_trend > 0.2:
            maint_due = "Warning (Within 7 days)"
        else:
            maint_due = "Healthy"
            
        return {
            'rolling_anomaly_rate': anomaly_rate,
            'drift_trend': drift_trend,
            'maintenance_due_estimate': maint_due,
            'last_updated': datetime.datetime.utcnow().isoformat()
        }
