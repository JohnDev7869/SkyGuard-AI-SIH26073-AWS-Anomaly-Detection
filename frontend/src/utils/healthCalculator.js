export const HEALTHY_MAX = 0.10; // < 10% Healthy (Green)
export const WARNING_MAX = 0.25; // 10% - 25% Warning (Amber), >= 25% Critical (Red)

/**
 * Single universal source of truth for Station Fault Rate & Health Status.
 * Monotonically scales with the number of active anomalies:
 * 0 active -> 0.0% (Healthy)
 * 1 active -> 5.0% (Healthy)
 * 2 active -> 10.0% (Warning)
 * 3 active -> 15.0% (Warning)
 * 4 active -> 20.0% (Warning)
 * 5 active -> 25.0% (Critical)
 * 6 active -> 30.0% (Critical)
 * 7 active -> 35.0% (Critical)
 * N active -> min(0.40, N * 0.05)
 */
export function getStationHealthMetrics(stationId, activeAlerts = []) {
  const safeAlerts = Array.isArray(activeAlerts) ? activeAlerts : [];
  const stationAlerts = safeAlerts.filter(a => a && a.station_id === stationId && (a.status === 'active' || !a.status));
  const count = stationAlerts.length;

  // Strict monotonic calculation
  let faultRate = 0.0;
  if (count > 0) {
    faultRate = Math.min(0.40, parseFloat((count * 0.05).toFixed(3)));
  }

  let status = 'Healthy';
  let color = 'var(--color-status-healthy)';
  let bg = 'rgba(61, 220, 132, 0.12)';
  let border = 'rgba(61, 220, 132, 0.3)';

  if (faultRate >= WARNING_MAX) {
    status = 'Critical';
    color = 'var(--color-status-critical)';
    bg = 'rgba(255, 92, 92, 0.15)';
    border = 'rgba(255, 92, 92, 0.4)';
  } else if (faultRate >= HEALTHY_MAX) {
    status = 'Warning';
    color = 'var(--color-status-warning)';
    bg = 'rgba(245, 166, 35, 0.15)';
    border = 'rgba(245, 166, 35, 0.4)';
  }

  return {
    stationId,
    activeCount: count,
    faultRate,
    faultRatePercent: (faultRate * 100).toFixed(1),
    status,
    color,
    bg,
    border
  };
}
