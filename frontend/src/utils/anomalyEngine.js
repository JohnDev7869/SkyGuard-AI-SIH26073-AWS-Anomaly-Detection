// Browser-Native Anomaly Generation & Real-Time Telemetry Simulation Engine
import { DEFAULT_INDIAN_STATIONS } from '../api/client';

const ANOMALY_TYPES = [
  'spike',
  'drift',
  'frozen_value',
  'cross_parameter_inconsistency',
  'spatial_outlier',
  'dropout'
];

let lastInjectionTime = Date.now();
const stationCooldowns = {};

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function generateSyntheticAlert(stationId, forcedType = null, stationsList = DEFAULT_INDIAN_STATIONS) {
  const station = stationsList.find(s => s && s.station_id === stationId) || stationsList[0] || DEFAULT_INDIAN_STATIONS[0];
  const type = forcedType || ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)];
  const now = new Date();
  const ts = now.toISOString();
  
  const baseT = station.base_temp || 30.0;
  const baseP = station.base_pressure || 1010.0;
  const baseH = station.base_humidity || 60.0;

  let raw = {
    station_id: station.station_id,
    timestamp: ts,
    temperature: parseFloat((baseT + (Math.random() - 0.5) * 1.5).toFixed(1)),
    pressure: parseFloat((baseP + (Math.random() - 0.5) * 1.0).toFixed(1)),
    humidity: parseFloat((baseH + (Math.random() - 0.5) * 2.0).toFixed(1))
  };

  const corr = {
    temperature: parseFloat(baseT.toFixed(2)),
    pressure: parseFloat(baseP.toFixed(2)),
    humidity: parseFloat(baseH.toFixed(2))
  };

  let severity = 'high';
  let confidence = parseFloat((0.96 + Math.random() * 0.038).toFixed(3));
  let shapValues = {};
  let summary = '';
  let topFeatures = [];
  let spatialEvidence = { nearest_neighbors: [] };

  // Calculate nearest 3 neighbor stations for spatial evidence
  const otherStations = stationsList.filter(s => s && s.station_id !== station.station_id);
  const sortedNeighbors = otherStations.map(n => ({
    station_id: n.station_id,
    name: n.name,
    temperature: parseFloat((n.base_temp + (Math.random() - 0.5) * 1.2).toFixed(1)),
    pressure: parseFloat((n.base_pressure + (Math.random() - 0.5) * 0.8).toFixed(1)),
    humidity: parseFloat((n.base_humidity + (Math.random() - 0.5) * 1.5).toFixed(1)),
    distance_km: haversineDistanceKm(station.lat, station.lon, n.lat, n.lon)
  })).sort((a, b) => a.distance_km - b.distance_km).slice(0, 3);

  spatialEvidence.nearest_neighbors = sortedNeighbors;
  spatialEvidence.neighbors = sortedNeighbors;
  const avgNeighborT = sortedNeighbors.length > 0 
    ? parseFloat((sortedNeighbors.reduce((acc, curr) => acc + curr.temperature, 0) / sortedNeighbors.length).toFixed(1))
    : baseT;
  spatialEvidence.cluster_mean_temp = avgNeighborT;

  switch(type) {
    case 'spike': {
      severity = 'high';
      const deltaT = parseFloat((16.0 + Math.random() * 6.0).toFixed(1));
      raw.temperature = parseFloat((baseT + deltaT).toFixed(1));
      shapValues = { "Statistical Z-Score": 48.5, "Instantaneous ROC": 32.1, "Spatial Residual": 19.4 };
      topFeatures = [
        { feature: "Statistical Z-Score", impact: 48.5 },
        { feature: "Instantaneous ROC", impact: 32.1 },
        { feature: "Spatial Residual", impact: 19.4 }
      ];
      summary = `Transient sensor spike: abrupt telemetry step of +${deltaT}°C diverging from calibrated diurnal baseline envelope.`;
      break;
    }

    case 'drift': {
      severity = 'medium';
      const deltaT = parseFloat((3.5 + Math.random() * 2.5).toFixed(1));
      raw.temperature = parseFloat((baseT + deltaT).toFixed(1));
      shapValues = { "Temporal Inconsistency": 52.4, "Rate of Change Trend": 29.8, "Statistical Z-Score": 17.8 };
      topFeatures = [
        { feature: "Temporal Inconsistency", impact: 52.4 },
        { feature: "Rate of Change Trend", impact: 29.8 },
        { feature: "Statistical Z-Score", impact: 17.8 }
      ];
      summary = `Progressive calibration decay: persistent monotonic deviation reaching +${deltaT}°C across sequential observation cycles.`;
      break;
    }

    case 'frozen_value': {
      severity = 'medium';
      raw.temperature = parseFloat(baseT.toFixed(1));
      raw.pressure = parseFloat(baseP.toFixed(1));
      raw.humidity = parseFloat(baseH.toFixed(1));
      shapValues = { "Hardware Edge ROC": 64.2, "Zero Variance Metric": 24.6, "Temporal Flatline": 11.2 };
      topFeatures = [
        { feature: "Hardware Edge ROC", impact: 64.2 },
        { feature: "Zero Variance Metric", impact: 24.6 },
        { feature: "Temporal Flatline", impact: 11.2 }
      ];
      summary = `Hardware ADC lockup: static readings (${raw.temperature}°C, ${raw.pressure} hPa, ${raw.humidity}%) with zero natural micro-variance (σ² = 0.0000).`;
      break;
    }

    case 'cross_parameter_inconsistency': {
      severity = 'high';
      raw.temperature = parseFloat((51.5 + Math.random() * 2.5).toFixed(1));
      raw.humidity = parseFloat((95.0 + Math.random() * 4.0).toFixed(1));
      raw.pressure = parseFloat((baseP + 22.0).toFixed(1));
      shapValues = { "Psychrometric Saturation": 58.6, "Multivariate Correlation": 26.2, "Statistical Boundary": 15.2 };
      topFeatures = [
        { feature: "Psychrometric Saturation", impact: 58.6 },
        { feature: "Multivariate Correlation", impact: 26.2 },
        { feature: "Statistical Boundary", impact: 15.2 }
      ];
      summary = `Thermodynamic saturation conflict: station records ${raw.temperature}°C extreme heat concurrent with ${raw.humidity}% RH at ${raw.pressure} hPa, exceeding Clausius-Clapeyron atmospheric dewpoint boundaries.`;
      break;
    }

    case 'spatial_outlier': {
      severity = 'high';
      const deltaT = parseFloat((13.5 + Math.random() * 4.0).toFixed(1));
      raw.temperature = parseFloat((avgNeighborT + deltaT).toFixed(1));
      spatialEvidence.target_temp = raw.temperature;
      spatialEvidence.delta_temp = deltaT;
      shapValues = { "Spatial Divergence": 56.8, "Cluster Median Residual": 28.4, "Statistical Z-Score": 14.8 };
      topFeatures = [
        { feature: "Spatial Divergence", impact: 56.8 },
        { feature: "Cluster Median Residual", impact: 28.4 },
        { feature: "Statistical Z-Score", impact: 14.8 }
      ];
      summary = `Regional spatial deviation: local reading (${raw.temperature}°C) diverged significantly (Δ = +${deltaT}°C) from 3 nearest AWS nodes (cluster avg ${avgNeighborT}°C).`;
      break;
    }

    case 'dropout': {
      severity = 'high';
      raw.temperature = null;
      raw.pressure = null;
      raw.humidity = null;
      shapValues = { "Telemetry Null Stream": 70.0, "Hardware Edge ROC": 20.0, "Comms Link Failure": 10.0 };
      topFeatures = [
        { feature: "Telemetry Null Stream", impact: 70.0 },
        { feature: "Hardware Edge ROC", impact: 20.0 },
        { feature: "Comms Link Failure", impact: 10.0 }
      ];
      summary = `Telemetry connection loss: station uplink completely silent (null telemetry stream across all sensor channels). Physical communication link failure or power loss.`;
      break;
    }

    default:
      summary = `Multi-detector ensemble flagged an anomalous telemetry pulse on ${station.name}.`;
      break;
  }

  const alertId = `alt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  return {
    id: alertId,
    station_id: station.station_id,
    ts: ts,
    first_seen: ts,
    last_seen: ts,
    occurrence_count: 1,
    severity: severity,
    confidence: confidence,
    root_cause: type,
    raw_value_json: JSON.stringify(raw),
    corrected_value_json: JSON.stringify(corr),
    shap_json: JSON.stringify(shapValues),
    explanation_json: JSON.stringify({
      summary: summary,
      top_features: topFeatures,
      spatial_evidence: spatialEvidence
    }),
    status: "active"
  };
}

// Tick generator: triggers 20-28 anomalies per minute naturally distributed across the 25 stations
export function shouldTriggerScheduledAnomaly(stationsList = DEFAULT_INDIAN_STATIONS) {
  const now = Date.now();
  const timeSinceLast = (now - lastInjectionTime) / 1000;
  
  // Dynamic 2.1 - 2.8s interval = 21.4 - 28.5 anomalies per minute
  if (timeSinceLast >= 2.2) {
    const validStations = stationsList.filter(s => s && s.station_id);
    const freshCandidates = validStations.filter(s => (now - (stationCooldowns[s.station_id] || 0)) >= 8000);
    
    const candidatePool = freshCandidates.length > 0 ? freshCandidates : validStations;
    if (candidatePool.length === 0) return null;
    
    // Pick 1 candidate (or 20% chance of 2-station micro-burst)
    const isBurst = Math.random() < 0.20 && candidatePool.length >= 2;
    const selected = [];
    
    const firstIdx = Math.floor(Math.random() * candidatePool.length);
    const firstStation = candidatePool[firstIdx];
    selected.push(firstStation);
    stationCooldowns[firstStation.station_id] = now;
    
    if (isBurst) {
      const remaining = candidatePool.filter(s => s.station_id !== firstStation.station_id);
      if (remaining.length > 0) {
        const secondStation = remaining[Math.floor(Math.random() * remaining.length)];
        selected.push(secondStation);
        stationCooldowns[secondStation.station_id] = now;
      }
    }
    
    lastInjectionTime = now;
    return selected.map(st => generateSyntheticAlert(st.station_id, null, stationsList));
  }
  
  return null;
}
