import json

class EdgePreFilter:
    def __init__(self, window_size=5):
        # State per station
        self.history = {}
        self.window_size = window_size
        
        # Thresholds
        self.limits = {
            'temperature': {'min': -40.0, 'max': 60.0, 'max_roc': 5.0}, # max_roc = max rate of change per tick
            'pressure': {'min': 800.0, 'max': 1200.0, 'max_roc': 10.0},
            'humidity': {'min': 0.0, 'max': 100.0, 'max_roc': 20.0}
        }

    def process(self, reading_json):
        reading = json.loads(reading_json)
        station_id = reading['station_id']
        
        if station_id not in self.history:
            self.history[station_id] = []
            
        history = self.history[station_id]
        suspect = False
        
        # 1. Range Checks
        for param in ['temperature', 'pressure', 'humidity']:
            val = reading[param]
            if val < self.limits[param]['min'] or val > self.limits[param]['max']:
                suspect = True
                
        # 2. Rate of Change Checks
        if len(history) > 0:
            last_reading = history[-1]
            for param in ['temperature', 'pressure', 'humidity']:
                delta = abs(reading[param] - last_reading[param])
                if delta > self.limits[param]['max_roc']:
                    suspect = True
                    
        # 3. Frozen Value Check
        history.append(reading)
        if len(history) > self.window_size:
            history.pop(0)
            
        if len(history) == self.window_size:
            for param in ['temperature', 'pressure', 'humidity']:
                vals = [r[param] for r in history]
                variance = sum((x - sum(vals)/len(vals))**2 for x in vals) / len(vals)
                if variance < 0.0001:  # Practically frozen
                    suspect = True
                    
        # Apply flag (do not drop data silently)
        reading['edge_flag'] = 'suspect' if suspect else 'clean'
        
        return json.dumps(reading)

# Example usage when acting as an edge interceptor:
# filter = EdgePreFilter()
# clean_json = filter.process(incoming_json)
