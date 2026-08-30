class RootCauseClassifier:
    def __init__(self):
        pass

    def classify(self, ensemble_results, edge_flag, reading):
        """
        ensemble_results: Dict from detectors
        edge_flag: 'suspect' or 'clean'
        reading: raw reading dict
        Returns: string label of root cause
        """
        # Extract booleans
        stat_anomaly = ensemble_results.get('statistical', {}).get('is_anomaly', False)
        temp_anomaly = ensemble_results.get('temporal', {}).get('is_anomaly', False)
        multi_anomaly = ensemble_results.get('multivariate', {}).get('is_anomaly', False)
        spat_anomaly = ensemble_results.get('spatial', {}).get('is_anomaly', False)
        
        # Determine specific parameter that spiked if statistical is true
        stat_details = ensemble_results.get('statistical', {}).get('details', {})
        spiked_params = [k for k, v in stat_details.items() if v.get('is_anomaly', False)]

        # dropout implies reading was null or not received, but if it reaches here, it exists.
        # So we skip dropout (that's handled upstream in ingestion if missing)
        
        # Rule 1: Spatial Outlier
        # If it's a spatial anomaly but statistically normal, or it's a huge spatial deviation
        if spat_anomaly and not multi_anomaly:
            return "spatial_outlier"

        # Rule 2: Cross Parameter Inconsistency
        # If multivariate fires strongly but individual stats might be okay or one is slightly off
        if multi_anomaly and not stat_anomaly:
            return "cross_parameter_inconsistency"

        # Rule 3: Spike
        # If statistical anomaly fires and edge flag didn't catch it as a frozen value
        if stat_anomaly:
            return "spike"

        # Rule 4: Frozen / Drift
        # If temporal anomaly fires, it usually indicates drift or frozen (lack of diurnal variance)
        if temp_anomaly:
            if edge_flag == 'suspect':
                return "frozen_value"
            else:
                return "drift"
                
        # Default fallback
        if edge_flag == 'suspect':
            return "edge_flagged"
            
        return "unknown_anomaly"
