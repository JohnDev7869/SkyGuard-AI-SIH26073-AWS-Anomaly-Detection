export const HEALTHY_MAX = 0.10; // < 10% Healthy (Green)
export const WARNING_MAX = 0.25; // 10% - 25% Warning (Amber), >= 25% Critical (Red)

/**
 * Single universal source of truth for Station Fault Rate & Health Status.
 * Calculates the exact percentage of anomalies detected in the particular telemetry data of that station:
 * faultRate = (anomalies_detected_for_station / total_readings_evaluated_for_station)
 * 
 * Example over standard 50-reading evaluation window:
 * 0 anomalies -> 0.0% (Healthy)
 * 1 anomaly   -> 2.0% (Healthy)
 * 3 anomalies -> 6.0% (Healthy)
 * 5 anomalies -> 10.0% (Warning)
 * 7 anomalies -> 14.0% (Warning)
 * 13 anomalies -> 26.0% (Critical)
 */
export function getStationHealthMetrics(stationId, activeAlerts = [], totalStationReadings = 50) {
  const safeAlerts = Array.isArray(activeAlerts) ? activeAlerts : [];
  const stationAlerts = safeAlerts.filter(a => a && a.station_id === stationId && (a.status === 'active' || !a.status));
  const count = stationAlerts.length;

  const windowSize = Math.max(1, totalStationReadings || 50);
  const rawRatio = count / windowSize;
  const faultRate = Math.min(1.0, parseFloat(rawRatio.toFixed(3)));
  const faultRatePercent = (faultRate * 100).toFixed(1);

  let status = 'Healthy';
  let color = 'var(--color-status-healthy)';
  let bg = 'rgba(0, 230, 118, 0.12)';
  let border = 'rgba(0, 230, 118, 0.3)';

  if (faultRate >= WARNING_MAX) {
    status = 'Critical';
    color = 'var(--color-status-critical)';
    bg = 'rgba(255, 51, 102, 0.15)';
    border = 'rgba(255, 51, 102, 0.4)';
  } else if (faultRate >= HEALTHY_MAX) {
    status = 'Warning';
    color = 'var(--color-status-warning)';
    bg = 'rgba(255, 179, 0, 0.15)';
    border = 'rgba(255, 179, 0, 0.4)';
  }

  return {
    stationId,
    activeCount: count,
    totalEvaluated: windowSize,
    faultRate,
    faultRatePercent,
    status,
    color,
    bg,
    border
  };
}
