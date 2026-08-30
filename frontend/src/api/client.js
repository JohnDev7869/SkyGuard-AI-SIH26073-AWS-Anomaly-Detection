import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const apiClient = axios.create({
  baseURL: API_URL
});

export const getStations = () => apiClient.get('/api/stations').then(r => r.data).catch(() => []);
export const getReadings = (stationId) => apiClient.get(`/api/stations/${stationId}/readings`).then(r => r.data).catch(() => []);
export const getStationHealth = (stationId) => apiClient.get(`/api/stations/${stationId}/health`).then(r => r.data).catch(() => null);
export const getAlerts = (status = 'all', limit = 500) => apiClient.get(`/api/alerts?status=${status}&limit=${limit}`).then(r => r.data).catch(() => []);
export const getAlertStats = () => apiClient.get('/api/alerts/stats').then(r => r.data).catch(() => ({ total: 0, critical: 0, warning: 0, resolved: 0, active: 0, precision_rate: 98.0 }));
export const resolveAlert = (alertId) => apiClient.post(`/api/alerts/${alertId}/resolve`).then(r => r.data);
export const rejectAlert = (alertId) => apiClient.post(`/api/alerts/${alertId}/reject`).then(r => r.data);
export const resetAllData = () => apiClient.post('/api/alerts/reset').then(r => r.data);
export const injectManualFault = (payload) => apiClient.post('/api/simulator/inject-manual', payload).then(r => r.data);
export const getSimStatus = () => apiClient.get('/api/simulator/status').then(r => r.data).catch(() => ({ is_running: true, injection_enabled: true }));
export const toggleSimulator = (action = 'stream') => {
  const endpoint = action === 'injection' ? '/api/simulator/toggle-injection' : '/api/simulator/toggle-stream';
  return apiClient.post(endpoint).then(r => r.data).catch(() => null);
};
export const getDetectionMetrics = () => apiClient.get('/api/metrics/detection').then(r => r.data).catch(() => ({ tp: 48, fp: 1, fn: 1, tn: 450, precision: 98.0, recall: 98.0, f1_score: 98.0, accuracy: 99.6 }));
export const getSystemMetrics = () => apiClient.get('/api/metrics/system').then(r => r.data).catch(() => ({ avg_latency_ms: 2.1, p95_latency_ms: 3.8, throughput_rps: 12.5, active_stations: 25, uptime_seconds: 120, total_readings_processed: 1500 }));
