import React, { useState, useEffect } from 'react';
import { getReadings } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Sparkles, Clock, AlertTriangle, CheckCircle2, Pause, Play, WifiOff } from 'lucide-react';

export default function StationDetail({ stationId, alerts = [], isPaused = false, onStartStream }) {
  const [readings, setReadings] = useState([]);
  const [showCorrected, setShowCorrected] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchReadings = () => {
      if (!stationId) return;
      getReadings(stationId).then(data => {
        if (!isMounted) return;
        if (Array.isArray(data)) {
          const formatted = (data || []).map(r => {
            const rawT = r.temperature !== null && r.temperature !== undefined ? parseFloat(r.temperature) : null;
            const rawP = r.pressure !== null && r.pressure !== undefined ? parseFloat(r.pressure) : null;
            const rawH = r.humidity !== null && r.humidity !== undefined ? parseFloat(r.humidity) : null;
            const isDropout = rawT === null || rawT < -100 || r.missing === true || r.root_cause === 'dropout' || r.anomaly_label === 'dropout';
            const isAnom = !!r.is_anomaly || r.edge_flag === 'suspect' || isDropout;
            
            // Reconstructed values fallback if missing
            const corrT = r.corrected_temp !== null && r.corrected_temp !== undefined && parseFloat(r.corrected_temp) > -100 
              ? parseFloat(r.corrected_temp) 
              : (rawT !== null && rawT > -100 ? rawT : 28.5);
              
            const corrP = r.corrected_pres !== null && r.corrected_pres !== undefined ? parseFloat(r.corrected_pres) : (rawP !== null ? rawP : 1010.0);
            const corrH = r.corrected_hum !== null && r.corrected_hum !== undefined ? parseFloat(r.corrected_hum) : (rawH !== null ? rawH : 60.0);
              
            return {
              ...r,
              displayTime: r.ts || r.timestamp || new Date().toISOString(),
              is_anomaly: isAnom,
              is_dropout: isDropout,
              raw_temp: rawT,
              pressure: rawP,
              humidity: rawH,
              plotted_temp: (rawT !== null && rawT > -100) ? rawT : null,
              corrected_temp: corrT,
              corrected_pres: corrP,
              corrected_hum: corrH,
              anomaly_label: isDropout ? 'TELEMETRY SIGNAL DROPOUT' : (r.anomaly_label || 'SENSOR ANOMALY')
            };
          });
          setReadings(formatted);
        }
      }).catch(() => {});
    };

    fetchReadings();

    let interval = null;
    if (!isPaused) {
      interval = setInterval(fetchReadings, 1500);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [stationId, isPaused, alerts]);

  // Extract anomaly timestamp points for reference lines
  const anomalyPoints = readings.filter(r => r.is_anomaly);

  // Compute safe dynamic Y-axis bounds for temperature
  const validTemps = (readings || []).map(r => r.plotted_temp).filter(v => v !== null && v !== undefined);
  const minTemp = validTemps.length > 0 ? Math.floor(Math.min(...validTemps) - 3) : 15;
  const maxTemp = validTemps.length > 0 ? Math.ceil(Math.max(...validTemps) + 3) : 45;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload || {};
      const isDropout = data.is_dropout || data.raw_temp === null || data.raw_temp < -100;
      
      return (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: '10px 14px',
          borderRadius: '8px',
          boxShadow: '0 4px 16px var(--color-shadow)',
          fontSize: '0.82em',
          color: 'var(--color-text-primary)'
        }}>
          <div className="font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)', marginBottom: '6px', fontSize: '0.78em', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} strokeWidth={2} />
            <span>{new Date(label).toLocaleTimeString()}</span>
          </div>

          {data.is_anomaly && (
            <div style={{ 
              marginBottom: '6px', 
              padding: '2px 8px', 
              borderRadius: '4px', 
              background: 'rgba(255, 92, 92, 0.15)', 
              color: 'var(--color-status-critical)', 
              fontWeight: 600,
              border: '1px solid rgba(255, 92, 92, 0.3)',
              fontSize: '0.76em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {isDropout ? <WifiOff size={12} strokeWidth={2} /> : <AlertTriangle size={12} strokeWidth={2} />}
              <span>{data.anomaly_label} ({isDropout ? 'Critical Signal Loss' : (data.severity || 'Critical')})</span>
            </div>
          )}

          {isDropout ? (
            <div style={{ margin: '3px 0', color: 'var(--color-status-critical)', fontWeight: 600, fontSize: '0.8em' }}>
              Raw Telemetry: <span className="font-mono tabular-nums">NULL (SIGNAL LOSS)</span>
            </div>
          ) : (
            data.plotted_temp !== null && data.plotted_temp !== undefined && (
              <div style={{ margin: '3px 0', color: 'var(--color-brand)', fontWeight: 600, fontSize: '0.8em' }}>
                Raw Telemetry: <span className="font-mono tabular-nums">{Number(data.plotted_temp).toFixed(2)}°C</span>
              </div>
            )
          )}

          {showCorrected && data.corrected_temp !== null && data.corrected_temp !== undefined && (
            <div style={{ margin: '3px 0', color: 'var(--color-ai-accent)', fontWeight: 600, fontSize: '0.8em' }}>
              AI-Corrected Value: <span className="font-mono tabular-nums">{Number(data.corrected_temp).toFixed(2)}°C</span>
            </div>
          )}

          {data.pressure !== null && data.pressure !== undefined && (
            <div style={{ margin: '3px 0', color: 'var(--color-status-warning)', fontWeight: 500, fontSize: '0.78em' }}>
              Pressure: <span className="font-mono tabular-nums">{Number(data.pressure).toFixed(1)} hPa</span>
            </div>
          )}

          {data.humidity !== null && data.humidity !== undefined && (
            <div style={{ margin: '3px 0', color: 'var(--color-status-healthy)', fontWeight: 500, fontSize: '0.78em' }}>
              Humidity: <span className="font-mono tabular-nums">{Number(data.humidity).toFixed(1)}%</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '1.05em', fontWeight: 600 }}>
              Live Telemetry Diagnostics & Baseline Overlay
            </h3>
            <span style={{ fontSize: '0.8em', color: 'var(--color-text-secondary)' }}>
              Real-time time-series feed with AI-corrected values and anomaly event markers
            </span>
          </div>

          {/* Pause Status Pill in Header Bar */}
          {isPaused && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 166, 35, 0.12)',
              border: '1px solid rgba(245, 166, 35, 0.35)',
              color: 'var(--color-status-warning)',
              fontSize: '0.78em',
              fontWeight: 600
            }}>
              <Pause size={13} strokeWidth={2.5} />
              <span>LIVE TELEMETRY STOPPED</span>
              {onStartStream && (
                <button
                  onClick={onStartStream}
                  style={{
                    marginLeft: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--color-action-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.76em',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Play size={10} fill="currentColor" />
                  <span>Resume</span>
                </button>
              )}
            </div>
          )}
        </div>

        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          cursor: 'pointer', 
          fontSize: '0.82em', 
          color: 'var(--color-text-primary)',
          background: 'var(--color-surface)',
          padding: '6px 12px',
          borderRadius: '6px',
          border: '1px solid var(--color-border)'
        }}>
          <input 
            type="checkbox" 
            checked={showCorrected} 
            onChange={e => setShowCorrected(e.target.checked)}
            style={{ accentColor: 'var(--color-brand)' }}
          />
          <Sparkles size={14} style={{ color: 'var(--color-ai-accent)' }} />
          <span>Show AI Baseline Corrections</span>
        </label>
      </div>

      {/* Main Charts Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
        
        {/* Temperature Chart */}
        <div className="glass-panel" style={{ padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', position: 'relative' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-brand)', fontSize: '0.88em', fontWeight: 600 }}>Temperature (°C)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="font-mono tabular-nums" style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)' }}>
                Latest: <strong style={{ color: 'var(--color-text-primary)' }}>
                  {readings.length > 0 ? (readings[readings.length - 1].raw_temp !== null ? `${readings[readings.length - 1].raw_temp}°C` : 'SIGNAL LOSS (null)') : '--'}
                </strong>
              </span>
              <span style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)' }}>• Active Range: [{minTemp}°C, {maxTemp}°C]</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
              <XAxis 
                dataKey="displayTime" 
                stroke="var(--color-chart-axis-label)" 
                fontSize={10} 
                tickFormatter={t => new Date(t).toLocaleTimeString()} 
              />
              <YAxis 
                domain={[minTemp, maxTemp]} 
                stroke="var(--color-chart-axis-label)" 
                fontSize={10} 
                tickFormatter={(v) => `${Math.round(v)}°`} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: '0.76em', color: 'var(--color-text-secondary)' }} />
              
              {/* Highlight Anomaly Points on Chart */}
              {anomalyPoints.map((pt, idx) => (
                <ReferenceLine 
                  key={`temp-anom-${idx}`} 
                  x={pt.displayTime} 
                  stroke="var(--color-status-critical)" 
                  strokeDasharray="3 3" 
                />
              ))}

              <Line 
                type="monotone" 
                dataKey="plotted_temp" 
                name="Raw Temperature (°C)" 
                stroke="var(--color-brand)" 
                connectNulls={false}
                dot={(props) => {
                  const isAnom = props.payload?.is_anomaly;
                  if (isAnom && props.cx !== undefined && props.cy !== undefined) {
                    return <circle cx={props.cx} cy={props.cy} r={4.5} fill="var(--color-status-critical)" stroke="var(--color-surface)" strokeWidth={1.5} key={props.key} />;
                  }
                  return null;
                }} 
                strokeWidth={2} 
                isAnimationActive={false} 
              />
              
              {showCorrected && (
                <Line 
                  type="monotone" 
                  dataKey="corrected_temp" 
                  name="AI-Corrected Value (°C)" 
                  stroke="var(--color-ai-accent)" 
                  strokeDasharray="4 4" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pressure Chart */}
        <div className="glass-panel" style={{ padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-status-warning)', fontSize: '0.88em', fontWeight: 600 }}>Atmospheric Pressure (hPa)</h4>
            <span style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)' }}>Barometric trend</span>
          </div>
          <ResponsiveContainer width="100%" height={165}>
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
              <XAxis dataKey="displayTime" stroke="var(--color-chart-axis-label)" fontSize={10} tickFormatter={t => new Date(t).toLocaleTimeString()} />
              <YAxis domain={['dataMin - 4', 'dataMax + 4']} stroke="var(--color-chart-axis-label)" fontSize={10} tickFormatter={(v) => `${Math.round(v)}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: '0.76em', color: 'var(--color-text-secondary)' }} />
              
              {anomalyPoints.map((pt, idx) => (
                <ReferenceLine 
                  key={`pres-anom-${idx}`} 
                  x={pt.displayTime} 
                  stroke="var(--color-status-critical)" 
                  strokeDasharray="3 3" 
                />
              ))}

              <Line type="monotone" dataKey="pressure" name="Raw Pressure (hPa)" stroke="var(--color-status-warning)" connectNulls={false} dot={(props) => {
                const isAnom = props.payload?.is_anomaly;
                if (isAnom && props.cx !== undefined && props.cy !== undefined) {
                  return <circle cx={props.cx} cy={props.cy} r={4.5} fill="var(--color-status-critical)" stroke="var(--color-surface)" strokeWidth={1.5} key={props.key} />;
                }
                return null;
              }} strokeWidth={2} isAnimationActive={false} />

              {showCorrected && (
                <Line type="monotone" dataKey="corrected_pres" name="AI-Corrected Value (hPa)" stroke="var(--color-ai-accent)" strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity Chart */}
        <div className="glass-panel" style={{ padding: '14px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h4 style={{ margin: 0, color: 'var(--color-status-healthy)', fontSize: '0.88em', fontWeight: 600 }}>Relative Humidity (%)</h4>
            <span style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)' }}>Psychrometric curve</span>
          </div>
          <ResponsiveContainer width="100%" height={165}>
            <LineChart data={readings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
              <XAxis dataKey="displayTime" stroke="var(--color-chart-axis-label)" fontSize={10} tickFormatter={t => new Date(t).toLocaleTimeString()} />
              <YAxis domain={[0, 100]} stroke="var(--color-chart-axis-label)" fontSize={10} tickFormatter={(v) => `${Math.round(v)}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={22} wrapperStyle={{ fontSize: '0.76em', color: 'var(--color-text-secondary)' }} />
              
              {anomalyPoints.map((pt, idx) => (
                <ReferenceLine 
                  key={`hum-anom-${idx}`} 
                  x={pt.displayTime} 
                  stroke="var(--color-status-critical)" 
                  strokeDasharray="3 3" 
                />
              ))}

              <Line type="monotone" dataKey="humidity" name="Raw Humidity (%)" stroke="var(--color-status-healthy)" connectNulls={false} dot={(props) => {
                const isAnom = props.payload?.is_anomaly;
                if (isAnom && props.cx !== undefined && props.cy !== undefined) {
                  return <circle cx={props.cx} cy={props.cy} r={4.5} fill="var(--color-status-critical)" stroke="var(--color-surface)" strokeWidth={1.5} key={props.key} />;
                }
                return null;
              }} strokeWidth={2} isAnimationActive={false} />

              {showCorrected && (
                <Line type="monotone" dataKey="corrected_hum" name="AI-Corrected Value (%)" stroke="var(--color-ai-accent)" strokeDasharray="4 4" strokeWidth={2} dot={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
      
    </div>
  );
}
