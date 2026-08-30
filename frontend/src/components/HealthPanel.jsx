import React from 'react';
import { Activity, AlertTriangle, ShieldCheck, Wrench } from 'lucide-react';

const HEALTHY_MAX = 0.10;
const WARNING_MAX = 0.25;

export default function HealthPanel({ stations = [], alerts = [], onSelect }) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const safeStations = Array.isArray(stations) ? stations : [];
  const activeAlerts = safeAlerts.filter(a => a && (a.status === 'active' || !a.status));
  
  // Filter valid station objects and sort strictly by rolling fault rate descending
  const validStations = safeStations.filter(s => s && s.station_id && s.name);
  const sortedStations = [...validStations].sort((a, b) => {
    const aRate = Number(a.health?.rolling_anomaly_rate || 0);
    const bRate = Number(b.health?.rolling_anomaly_rate || 0);
    return bRate - aRate;
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
              const stationAlerts = activeAlerts.filter(a => a.station_id === s.station_id);
              const hasActive = stationAlerts.length > 0;
              
              const h = s.health || {};
              const rate = Number(h.rolling_anomaly_rate !== undefined ? h.rolling_anomaly_rate : 0);
              
              // Priority 0: Status badge is a 100% PURE function of rolling fault rate
              let label = 'Healthy';
              let color = 'var(--color-status-healthy)';
              let bg = 'rgba(61, 220, 132, 0.12)';
              let border = 'rgba(61, 220, 132, 0.3)';
              
              if (rate > WARNING_MAX) {
                label = 'Critical';
                color = 'var(--color-status-critical)';
                bg = 'rgba(255, 92, 92, 0.15)';
                border = 'rgba(255, 92, 92, 0.4)';
              } else if (rate >= HEALTHY_MAX) {
                label = 'Warning';
                color = 'var(--color-status-warning)';
                bg = 'rgba(245, 166, 35, 0.15)';
                border = 'rgba(245, 166, 35, 0.4)';
              }
              
              const isHighlighted = rate > WARNING_MAX;

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
                  <td className="font-mono tabular-nums" style={{ padding: '8px 4px', color: color, fontWeight: 600 }}>
                    {(rate * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '4px', 
                      background: bg, border: `1px solid ${border}`, color: color,
                      fontSize: '0.78em', fontWeight: 600
                    }}>
                      {label === 'Critical' ? <AlertTriangle size={11} strokeWidth={2} /> : null}
                      <span>{label}</span>
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
