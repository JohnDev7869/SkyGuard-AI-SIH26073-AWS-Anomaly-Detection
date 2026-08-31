import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: API_URL
});

export const DEFAULT_INDIAN_STATIONS = [
  { station_id: "AWS_MUM", name: "Mumbai", fullName: "Mumbai Coastal Radar", lat: 19.0760, lon: 72.8777, base_temp: 32.0, base_pressure: 1010.0, base_humidity: 78.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_DEL", name: "Delhi", fullName: "Delhi Ridge Observatory", lat: 28.6139, lon: 77.2090, base_temp: 36.5, base_pressure: 1002.0, base_humidity: 45.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_BLR", name: "Bangalore", fullName: "Bengaluru Tech Plateau", lat: 12.9716, lon: 77.5946, base_temp: 27.5, base_pressure: 915.0, base_humidity: 62.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_HYD", name: "Hyderabad", fullName: "Hyderabad Deccan Station", lat: 17.3850, lon: 78.4867, base_temp: 33.0, base_pressure: 955.0, base_humidity: 55.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_MAA", name: "Chennai", fullName: "Chennai Port Sensor", lat: 13.0827, lon: 80.2707, base_temp: 34.5, base_pressure: 1009.0, base_humidity: 82.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_CCU", name: "Kolkata", fullName: "Kolkata Delta Monitor", lat: 22.5726, lon: 88.3639, base_temp: 33.5, base_pressure: 1008.0, base_humidity: 80.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_PNQ", name: "Pune", fullName: "Pune Western Ghats AWS", lat: 18.5204, lon: 73.8567, base_temp: 29.0, base_pressure: 948.0, base_humidity: 65.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_AMD", name: "Ahmedabad", fullName: "Ahmedabad Urban Post", lat: 23.0225, lon: 72.5714, base_temp: 38.0, base_pressure: 1005.0, base_humidity: 48.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_STV", name: "Surat", fullName: "Surat Coastal Sensor", lat: 21.1702, lon: 72.8311, base_temp: 33.0, base_pressure: 1011.0, base_humidity: 76.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_JAI", name: "Jaipur", fullName: "Jaipur Desert Outpost", lat: 26.9124, lon: 75.7873, base_temp: 37.5, base_pressure: 968.0, base_humidity: 38.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_LKO", name: "Lucknow", fullName: "Lucknow Plain AWS", lat: 26.8467, lon: 80.9462, base_temp: 34.0, base_pressure: 998.0, base_humidity: 60.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_KNP", name: "Kanpur", fullName: "Kanpur Ganga Station", lat: 26.4499, lon: 80.3319, base_temp: 34.5, base_pressure: 996.0, base_humidity: 58.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_NAG", name: "Nagpur", fullName: "Nagpur Central Node", lat: 21.1458, lon: 79.0882, base_temp: 35.0, base_pressure: 978.0, base_humidity: 52.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_IDR", name: "Indore", fullName: "Indore Malwa Platform", lat: 22.7196, lon: 75.8577, base_temp: 31.5, base_pressure: 950.0, base_humidity: 56.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_BPL", name: "Bhopal", fullName: "Bhopal Lake AWS", lat: 23.2599, lon: 77.4126, base_temp: 32.0, base_pressure: 955.0, base_humidity: 59.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_COK", name: "Kochi", fullName: "Kochi Marine Gateway", lat: 9.9312, lon: 76.2673, base_temp: 30.5, base_pressure: 1012.0, base_humidity: 84.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_TRV", name: "Trivandrum", fullName: "Trivandrum South AWS", lat: 8.5241, lon: 76.9366, base_temp: 31.0, base_pressure: 1011.0, base_humidity: 81.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_VTZ", name: "Visakhapatnam", fullName: "Visakhapatnam Bay Node", lat: 17.6868, lon: 83.2185, base_temp: 32.5, base_pressure: 1009.0, base_humidity: 79.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_PAT", name: "Patna", fullName: "Patna Bihar Plains", lat: 25.5941, lon: 85.1376, base_temp: 34.0, base_pressure: 1001.0, base_humidity: 68.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_IXC", name: "Chandigarh", fullName: "Chandigarh Foothills", lat: 30.7333, lon: 76.7794, base_temp: 32.0, base_pressure: 975.0, base_humidity: 50.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_BBI", name: "Bhubaneswar", fullName: "Bhubaneswar Coastal AWS", lat: 20.2961, lon: 85.8245, base_temp: 33.5, base_pressure: 1007.0, base_humidity: 77.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_GAU", name: "Guwahati", fullName: "Guwahati Brahmaputra", lat: 26.1445, lon: 91.7362, base_temp: 30.0, base_pressure: 1003.0, base_humidity: 85.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_RNC", name: "Ranchi", fullName: "Ranchi Chota Nagpur", lat: 23.3441, lon: 85.3096, base_temp: 29.5, base_pressure: 938.0, base_humidity: 66.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_MYQ", name: "Mysore", fullName: "Mysuru Heritage Node", lat: 12.2958, lon: 76.6394, base_temp: 28.5, base_pressure: 928.0, base_humidity: 64.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } },
  { station_id: "AWS_CJB", name: "Coimbatore", fullName: "Coimbatore South AWS", lat: 11.0168, lon: 76.9558, base_temp: 30.0, base_pressure: 960.0, base_humidity: 61.0, health: { rolling_anomaly_rate: 0.0, maintenance_due_estimate: 'Healthy' } }
];

const isArray = (v) => Array.isArray(v);
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isHtml = (data) => typeof data === 'string' && (data.includes('<!doctype') || data.includes('<html') || data.includes('<!DOCTYPE'));

// Generate realistic 2-second spaced telemetry stream with distinct station-specific signatures and anomaly markers
export const generateMockReadings = (stationId) => {
  const station = DEFAULT_INDIAN_STATIONS.find(s => s.station_id === stationId) || DEFAULT_INDIAN_STATIONS[0];
  const list = [];
  const now = Date.now();
  const stepMs = 2500; // 2.5s per tick
  const baseT = station.base_temp !== undefined ? station.base_temp : 32.0;
  const baseP = station.base_pressure !== undefined ? station.base_pressure : 1010.0;
  const baseH = station.base_humidity !== undefined ? station.base_humidity : 60.0;

  // Derive unique station seed for distinct waveform frequencies, phase, and characteristics
  const idStr = station.station_id || 'AWS_MUM';
  const seed = idStr.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 3), 0);
  const freqT = 0.22 + ((seed % 7) * 0.035);
  const freqP = 0.18 + (((seed >> 1) % 6) * 0.03);
  const freqH = 0.26 + (((seed >> 2) % 5) * 0.04);
  const phaseT = ((seed % 360) * Math.PI) / 180;
  const phaseP = (((seed * 7) % 360) * Math.PI) / 180;
  const phaseH = (((seed * 13) % 360) * Math.PI) / 180;

  // Station-specific anomaly pulse locations
  const anomIdx1 = 20 + (seed % 6); // between 20 and 25
  const anomIdx2 = 12 + ((seed >> 2) % 5); // between 12 and 16
  const hasSecondAnom = (seed % 3) !== 0;

  for (let i = 28; i >= 0; i--) {
    const t = new Date(now - i * stepMs);
    const noiseT = Math.sin(i * freqT + phaseT) * 0.9 + Math.cos(i * 0.1 + phaseT) * 0.4 + (Math.sin(i * 3.1 + seed) * 0.15);
    const noiseP = Math.cos(i * freqP + phaseP) * 0.7 + Math.sin(i * 0.15 + phaseP) * 0.3 + (Math.cos(i * 2.7 + seed) * 0.1);
    const noiseH = -Math.sin(i * freqH + phaseH) * 1.5 + Math.cos(i * 0.12 + phaseH) * 0.6 + (Math.sin(i * 2.3 + seed) * 0.2);

    let rawT = parseFloat((baseT + noiseT).toFixed(2));
    let rawP = parseFloat((baseP + noiseP).toFixed(1));
    let rawH = Math.min(100, Math.max(10, parseFloat((baseH + noiseH).toFixed(1))));
    
    let isAnom = false;
    let label = null;
    let severity = 'medium';

    // Injected Anomaly 1 (Specific to station characteristics)
    if (i === anomIdx1) {
      isAnom = true;
      if (seed % 4 === 0) {
        rawT = parseFloat((baseT + 15.5 + ((seed % 5) * 0.8)).toFixed(2));
        label = 'TRANSIENT SENSOR SPIKE';
        severity = 'high';
      } else if (seed % 4 === 1) {
        rawT = parseFloat((baseT - 16.0 - ((seed % 4) * 0.7)).toFixed(2));
        label = 'STEP DIVERGENCE';
        severity = 'high';
      } else if (seed % 4 === 2) {
        rawP = parseFloat((baseP + 32.0 + ((seed % 6) * 1.2)).toFixed(1));
        label = 'PRESSURE TRANSIENT SURGE';
        severity = 'high';
      } else {
        rawH = Math.min(99.0, parseFloat((baseH + 34.0).toFixed(1)));
        rawT = parseFloat((baseT + 12.0).toFixed(2));
        label = 'PSYCHROMETRIC VIOLATION';
        severity = 'high';
      }
    }
    // Injected Anomaly 2 (Secondary pulse for variety)
    else if (hasSecondAnom && i === anomIdx2) {
      isAnom = true;
      if (seed % 2 === 0) {
        rawT = parseFloat((baseT + 7.5 + ((seed % 3) * 0.6)).toFixed(2));
        label = 'SENSOR CALIBRATION DRIFT';
        severity = 'medium';
      } else {
        rawP = parseFloat((baseP - 24.0 - ((seed % 4) * 1.0)).toFixed(1));
        label = 'BAROMETRIC ANOMALY';
        severity = 'medium';
      }
    }

    list.push({
      station_id: stationId,
      ts: t.toISOString(),
      timestamp: t.toISOString(),
      temperature: rawT,
      pressure: rawP,
      humidity: rawH,
      edge_flag: isAnom ? 'suspect' : 'clean',
      is_anomaly: isAnom,
      anomaly_label: label,
      severity: severity,
      corrected_temp: parseFloat((baseT + Math.sin(i * freqT + phaseT) * 0.4).toFixed(2)),
      corrected_pres: parseFloat((baseP + Math.cos(i * freqP + phaseP) * 0.3).toFixed(1)),
      corrected_hum: parseFloat((baseH - Math.sin(i * freqH + phaseH) * 0.6).toFixed(1))
    });
  }
  return list;
};

// When backend is active JSON endpoint, return data; otherwise return null to preserve client session
export const getStations = () => apiClient.get('/api/stations')
  .then(r => (!isHtml(r.data) && isArray(r.data) && r.data.length > 0 ? r.data : null))
  .catch(() => null);

export const getReadings = (stationId) => apiClient.get(`/api/stations/${stationId}/readings`)
  .then(r => (!isHtml(r.data) && isArray(r.data) && r.data.length > 0 ? r.data : generateMockReadings(stationId)))
  .catch(() => generateMockReadings(stationId));

export const getStationHealth = (stationId) => apiClient.get(`/api/stations/${stationId}/health`)
  .then(r => (!isHtml(r.data) && isObject(r.data) ? r.data : null))
  .catch(() => null);

export const getAlerts = (status = 'all', limit = 500) => apiClient.get(`/api/alerts?status=${status}&limit=${limit}`)
  .then(r => (!isHtml(r.data) && isArray(r.data) ? r.data : null))
  .catch(() => null);

export const getAlertStats = () => apiClient.get('/api/alerts/stats')
  .then(r => (!isHtml(r.data) && isObject(r.data) ? r.data : null))
  .catch(() => null);

export const resolveAlert = (alertId) => apiClient.post(`/api/alerts/${alertId}/resolve`)
  .then(r => r.data)
  .catch(() => ({ status: 'resolved' }));

export const rejectAlert = (alertId) => apiClient.post(`/api/alerts/${alertId}/reject`)
  .then(r => r.data)
  .catch(() => ({ status: 'false_alarm' }));

export const resetAllData = () => apiClient.post('/api/alerts/reset')
  .then(r => r.data)
  .catch(() => ({ status: 'ok' }));

export const injectManualFault = (payload) => apiClient.post('/api/simulator/inject-manual', payload)
  .then(r => r.data)
  .catch(() => ({ status: 'injected', ...payload }));

export const getSimStatus = () => apiClient.get('/api/simulator/status')
  .then(r => (!isHtml(r.data) && isObject(r.data) ? r.data : null))
  .catch(() => null);

export const toggleSimulator = (action = 'stream') => {
  const endpoint = action === 'injection' ? '/api/simulator/toggle-injection' : '/api/simulator/toggle-stream';
  return apiClient.post(endpoint).then(r => r.data).catch(() => ({ is_running: true }));
};

export const getDetectionMetrics = () => apiClient.get('/api/metrics/detection')
  .then(r => (!isHtml(r.data) && isObject(r.data) ? r.data : null))
  .catch(() => null);

export const getSystemMetrics = () => apiClient.get('/api/metrics/system')
  .then(r => (!isHtml(r.data) && isObject(r.data) ? r.data : null))
  .catch(() => null);
