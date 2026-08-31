import React, { useState, useMemo } from 'react';
import { ScanSearch, Search, Eye, X, Sparkles, Radio, Activity, Filter } from 'lucide-react';

export default function AnomalyLogs({ alerts: propAlerts = [], stations: propStations = [] }) {
  const alerts = Array.isArray(propAlerts) ? propAlerts : [];
  const stations = Array.isArray(propStations) ? propStations : [];
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedProblem, setSelectedProblem] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(true);

  const getStationName = (id) => (stations || []).find(s => s && s.station_id === id)?.name || id;

  const stationCounts = useMemo(() => {
    const map = {};
    (stations || []).forEach(s => { if (s && s.station_id) map[s.station_id] = 0; });
    (alerts || []).forEach(a => {
      if (a && a.station_id) {
        if (map[a.station_id] !== undefined) map[a.station_id]++;
        else map[a.station_id] = 1;
      }
    });
    return map;
  }, [alerts, stations]);

  const problems = useMemo(() => {
    const set = new Set();
    (alerts || []).forEach(a => { if (a && a.root_cause) set.add(a.root_cause); });
    return Array.from(set);
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (!showAll && !selectedCity && selectedProblem === 'ALL' && !searchQuery) {
      return [];
    }
    return (alerts || []).filter(a => {
      if (selectedCity && a.station_id !== selectedCity) return false;
      if (selectedProblem !== 'ALL' && a.root_cause !== selectedProblem) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const stName = getStationName(a.station_id).toLowerCase();
        const problem = (a.root_cause || '').toLowerCase();
        if (!stName.includes(query) && !problem.includes(query) && !a.station_id.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, selectedCity, selectedProblem, searchQuery, showAll]);

  const isFiltered = showAll || selectedCity || selectedProblem !== 'ALL' || searchQuery.length > 0;

  return (
    <div className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15em', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScanSearch size={18} strokeWidth={2} style={{ color: 'var(--color-brand)' }} />
            <span>Real-Time Anomaly Detection Telemetry Logs</span>
          </h2>
          <p style={{ margin: '3px 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.82em' }}>
            Filter by specific Indian weather stations or anomaly classifications to inspect calibrated model confidence scores
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              setShowAll(!showAll);
              if (!showAll) { setSelectedCity(''); setSelectedProblem('ALL'); setSearchQuery(''); }
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: showAll ? 'var(--color-brand)' : 'var(--color-surface-hover)',
              color: showAll ? 'var(--color-surface)' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Eye size={13} strokeWidth={2} />
            <span>{showAll ? 'Showing All Records' : 'View All Logs'}</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-panel" style={{ 
        padding: '14px 16px', 
        background: 'var(--color-surface)', 
        display: 'grid', 
        gridTemplateColumns: '1.2fr 1fr 1fr auto', 
        gap: '12px', 
        alignItems: 'center' 
      }}>
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Search Station or Metric
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search city, ID, or root cause..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowAll(false); }}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                background: 'var(--color-surface-hover)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: '0.82em',
                outline: 'none'
              }}
            />
            <Search size={13} strokeWidth={2} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Filter by Station
          </label>
          <select
            value={selectedCity}
            onChange={(e) => { setSelectedCity(e.target.value); setShowAll(false); }}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '0.82em',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Stations</option>
            {(stations || []).map(s => (
              <option key={s.station_id} value={s.station_id}>
                {s.name} ({s.station_id}) ({stationCounts[s.station_id] || 0})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>
            Filter by Problem Type
          </label>
          <select
            value={selectedProblem}
            onChange={(e) => { setSelectedProblem(e.target.value); setShowAll(false); }}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '0.82em',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Problem Types</option>
            {problems.map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => {
              setSelectedCity('');
              setSelectedProblem('ALL');
              setSearchQuery('');
              setShowAll(false);
            }}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '0.8em',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <X size={13} strokeWidth={2} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Grid or Table Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isFiltered ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82em', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Showing <strong className="font-mono tabular-nums" style={{ color: 'var(--color-brand)' }}>{filteredAlerts.length}</strong> matching telemetry records
              </span>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                No anomalies matching current filter query.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em', background: 'var(--color-surface)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>Time</th>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>Station</th>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>Root Cause</th>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>Severity</th>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>AI Confidence</th>
                    <th style={{ padding: '8px 10px', fontWeight: 500 }}>Observed Telemetry</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map(a => {
                    let raw = {};
                    try { raw = JSON.parse(a.raw_value_json || '{}'); } catch(e) {}
                    const isCritical = a.severity === 'high';
                    const conf = a.confidence ? (a.confidence * 100).toFixed(1) : '98.0';

                    return (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                        <td className="font-mono tabular-nums" style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                          {new Date(a.ts).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <strong style={{ color: 'var(--color-text-primary)' }}>{getStationName(a.station_id)}</strong>
                          <span className="font-mono tabular-nums" style={{ fontSize: '0.78em', color: 'var(--color-text-secondary)', display: 'block' }}>{a.station_id}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-status-warning)', fontWeight: 600 }}>
                          {a.root_cause?.toUpperCase()}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.75em',
                            fontWeight: 600,
                            background: isCritical ? 'rgba(255, 92, 92, 0.12)' : 'rgba(245, 166, 35, 0.12)',
                            color: isCritical ? 'var(--color-status-critical)' : 'var(--color-status-warning)',
                            border: `1px solid ${isCritical ? 'rgba(255, 92, 92, 0.25)' : 'rgba(245, 166, 35, 0.25)'}`
                          }}>
                            {isCritical ? 'CRITICAL' : 'WARNING'}
                          </span>
                        </td>
                        <td className="font-mono tabular-nums" style={{ padding: '8px 10px', color: 'var(--color-ai-accent)', fontWeight: 600 }}>
                          {conf}%
                        </td>
                        <td className="font-mono tabular-nums" style={{ padding: '8px 10px', color: 'var(--color-text-primary)' }}>
                          {raw && raw.temperature !== null && raw.temperature !== undefined 
                            ? `${Number(raw.temperature).toFixed(1)}°C, ${raw.pressure !== null && raw.pressure !== undefined ? Number(raw.pressure).toFixed(0) : '-'}hPa, ${raw.humidity !== null && raw.humidity !== undefined ? Number(raw.humidity).toFixed(0) : '-'}%` 
                            : 'SIGNAL LOSS (null)'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '10px', fontSize: '0.82em', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Select a station card below or use the search filters above to inspect anomaly event archives:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {(stations || []).map(s => {
                const count = stationCounts[s.station_id] || 0;
                return (
                  <div
                    key={s.station_id}
                    onClick={() => setSelectedCity(s.station_id)}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.9em', display: 'block' }}>{s.name}</strong>
                        <span className="font-mono tabular-nums" style={{ fontSize: '0.76em', color: 'var(--color-text-secondary)' }}>{s.station_id}</span>
                      </div>
                      <span className="font-mono tabular-nums" style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.74em',
                        fontWeight: 600,
                        background: count > 0 ? 'rgba(255, 92, 92, 0.12)' : 'rgba(61, 220, 132, 0.12)',
                        color: count > 0 ? 'var(--color-status-critical)' : 'var(--color-status-healthy)',
                        border: `1px solid ${count > 0 ? 'rgba(255, 92, 92, 0.25)' : 'rgba(61, 220, 132, 0.25)'}`
                      }}>
                        {count} Logs
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
