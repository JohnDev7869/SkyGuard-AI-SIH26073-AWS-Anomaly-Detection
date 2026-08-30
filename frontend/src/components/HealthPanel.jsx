import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { getStationHealthMetrics } from '../utils/healthCalculator';

export default function HealthPanel({ stations = [], alerts = [], onSelect }) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const safeStations = Array.isArray(stations) ? stations : [];
  const activeAlerts = safeAlerts.filter(a => a && (a.status === 'active' || !a.status));
  
  // Filter valid station objects and sort strictly by rolling fault rate descending
  const validStations = safeStations.filter(s => s && s.station_id && s.name);

  const sortedStations = [...validStations].sort((a, b) => {
    const aMetrics = getStationHealthMetrics(a.station_id, activeAlerts);
    const bMetrics = getStationHealthMetrics(b.station_id, activeAlerts);
    return bMetrics.faultRate - aMetrics.faultRate;
  });

  const totalActive = activeAlerts.length;

  return (
    <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={15} strokeWidth={2} style={{ color: 'var(--color-brand)' }} />
          <h3 style={{ margin: 0, fontSize: '0.88em', color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Network Station Health
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {totalActive > 0 ? (
            <span className="font-mono tabular-nums" style={{
              fontSize: '0.74em',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255, 92, 92, 0.15)',
              color: 'var(--color-status-critical)',
              fontWeight: 600,
              border: '1px solid rgba(255, 92, 92, 0.3)'
            }}>
              {totalActive} Active
            </span>
          ) : (
            <span className="font-mono tabular-nums" style={{
              fontSize: '0.74em',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(61, 220, 132, 0.12)',
              color: 'var(--color-status-healthy)',
              fontWeight: 600
            }}>
              All Calm
            </span>
          )}
        </div>
      </div>
      
      {/* Station List Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <th style={{ padding: '6px 4px', fontWeight: 500 }}>City Station</th>
              <th style={{ padding: '6px 4px', fontWeight: 500 }}>Fault Rate</th>
              <th style={{ padding: '6px 4px', fontWeight: 500 }}>Health Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedStations.map(s => {
              const metrics = getStationHealthMetrics(s.station_id, activeAlerts);
              const isHighlighted = metrics.status === 'Critical';
              const hasActive = metrics.activeCount > 0;

              return (
                <tr key={s.station_id} 
                    style={{ 
                      cursor: 'pointer', 
                      borderBottom: '1px solid var(--color-border)',
                      background: isHighlighted ? 'rgba(255, 92, 92, 0.04)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                    onClick={() => onSelect(s.station_id)}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = isHighlighted ? 'rgba(255, 92, 92, 0.04)' : 'transparent'}
                >
                  <td style={{ padding: '8px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {hasActive && (
                        <span 
                          title="Unresolved alert active"
                          style={{ 
                            width: '6px', height: '6px', borderRadius: '50%', 
                            background: 'var(--color-brand)', 
                            boxShadow: '0 0 6px var(--color-brand)',
                            flexShrink: 0
                          }}
                        ></span>
                      )}
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{s.name}</span>
                    </div>
                    <div className="font-mono tabular-nums" style={{ fontSize: '0.78em', color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: hasActive ? '12px' : '0px' }}>
                      {s.station_id}
                    </div>
                  </td>
                  <td className="font-mono tabular-nums" style={{ padding: '8px 4px', color: metrics.color, fontWeight: 600 }}>
                    {metrics.faultRatePercent}%
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '4px', 
                      background: metrics.bg, border: `1px solid ${metrics.border}`, color: metrics.color,
                      fontSize: '0.78em', fontWeight: 600
                    }}>
                      {metrics.status === 'Critical' ? <AlertTriangle size={11} strokeWidth={2} /> : null}
                      <span>{metrics.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
