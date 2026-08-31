import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Radio, 
  AlertTriangle, 
  Flame, 
  Target, 
  Clock, 
  Moon, 
  Sun, 
  Play, 
  Pause, 
  FastForward,
  X
} from 'lucide-react';
import { DEFAULT_INDIAN_STATIONS } from '../api/client';

export default function StationDetail({
  stationId = 'AWS_MUM',
  onSelectStation,
  stations: propStations = DEFAULT_INDIAN_STATIONS,
  alerts = [],
  stats = {},
  isPaused = false,
  onToggleStream,
  theme = 'dark',
  onToggleTheme
}) {
  const stations = Array.isArray(propStations) && propStations.length > 0 ? propStations : DEFAULT_INDIAN_STATIONS;
  const currentStation = stations.find(s => s && s.station_id === stationId) || stations[0] || DEFAULT_INDIAN_STATIONS[0];
  
  // Selected Sensor Channel (Air Temp, Relative Humidity, Pressure, Wind Speed, Solar Radiation)
  const [selectedChannel, setSelectedChannel] = useState('temp');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('1 New Anomaly detected across AWS stations!');
  const alertsRef = useRef(alerts);
  const prevAlertsLength = useRef(alerts.length);

  useEffect(() => {
    alertsRef.current = alerts;
    if (alerts.length > prevAlertsLength.current) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
    prevAlertsLength.current = alerts.length;
  }, [alerts]);

  // Generate 24-step diurnal time-series with realistic ±2.5σ thresholds and anomaly markers
  const [timeSeriesData, setTimeSeriesData] = useState(() => generateDiurnalData(currentStation, selectedChannel, alerts));

  // Regenerate or update when station or channel changes
  useEffect(() => {
    setTimeSeriesData(generateDiurnalData(currentStation, selectedChannel, alertsRef.current));
  }, [stationId, selectedChannel, currentStation]);

  // Real-time ticking step simulation when stream is active
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTimeSeriesData(prev => {
        if (!prev || prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const nextTime = new Date(new Date(last.timestamp).getTime() + 15 * 60 * 1000);
        
        // Compute base diurnal progression
        const stepIdx = (last.stepIdx + 1) % 48;
        const baseVal = getChannelBaseline(currentStation, selectedChannel, stepIdx);
        const noise = (Math.random() - 0.5) * getChannelNoise(selectedChannel);
        
        // Check if there is an active alert for this station on this channel
        const stationAlerts = (alertsRef.current || []).filter(a => a && a.station_id === currentStation.station_id && (a.status === 'active' || !a.status));
        const hasAlert = stationAlerts.length > 0 && Math.random() < 0.25;
        
        let observed = baseVal + noise;
        let isAnom = false;
        let anomalyLabel = null;

        if (hasAlert) {
          isAnom = true;
          anomalyLabel = stationAlerts[0]?.root_cause ? stationAlerts[0].root_cause.replace(/_/g, ' ').toUpperCase() : 'TELEMETRY ANOMALY';
          const multiplier = selectedChannel === 'pressure' ? 22 : selectedChannel === 'humidity' ? 25 : 8.5;
          observed = baseVal + multiplier;
        }

        const sigma = getChannelSigma(selectedChannel);
        const upperThreshold = parseFloat((baseVal + 2.5 * sigma).toFixed(2));
        const lowerThreshold = parseFloat((baseVal - 2.5 * sigma).toFixed(2));

        const newPoint = {
          stepIdx,
          timestamp: nextTime.toISOString(),
          timeLabel: nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          observed: parseFloat(observed.toFixed(2)),
          upperThreshold,
          lowerThreshold,
          isAnomaly: isAnom || observed > upperThreshold || observed < lowerThreshold,
          anomalyLabel
        };

        return [...prev.slice(1), newPoint];
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isPaused, currentStation, selectedChannel]);

  const channels = [
    { id: 'temp', label: 'Air Temp (°C)', unit: '°C' },
    { id: 'humidity', label: 'Relative Humidity (%)', unit: '%' },
    { id: 'pressure', label: 'Pressure (hPa)', unit: 'hPa' },
    { id: 'wind', label: 'Wind Speed (m/s)', unit: 'm/s' },
    { id: 'solar', label: 'Solar Radiation (W/m²)', unit: 'W/m²' }
  ];

  const activeChannelObj = channels.find(c => c.id === selectedChannel) || channels[0];

  // Advance simulation step button handler (+15m)
  const handleAdvanceStep = () => {
    setTimeSeriesData(prev => {
      if (!prev || prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const nextTime = new Date(new Date(last.timestamp).getTime() + 15 * 60 * 1000);
      const stepIdx = (last.stepIdx + 1) % 48;
      const baseVal = getChannelBaseline(currentStation, selectedChannel, stepIdx);
      const noise = (Math.random() - 0.5) * getChannelNoise(selectedChannel);
      const sigma = getChannelSigma(selectedChannel);
      
      const newPoint = {
        stepIdx,
        timestamp: nextTime.toISOString(),
        timeLabel: nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        observed: parseFloat((baseVal + noise).toFixed(2)),
        upperThreshold: parseFloat((baseVal + 2.5 * sigma).toFixed(2)),
        lowerThreshold: parseFloat((baseVal - 2.5 * sigma).toFixed(2)),
        isAnomaly: false,
        anomalyLabel: null
      };
      return [...prev.slice(1), newPoint];
    });
  };

  // Compute Y-axis domain
  const yValues = useMemo(() => {
    const all = [];
    timeSeriesData.forEach(d => {
      if (d.observed !== null && !isNaN(d.observed)) all.push(d.observed);
      if (d.upperThreshold !== null && !isNaN(d.upperThreshold)) all.push(d.upperThreshold);
      if (d.lowerThreshold !== null && !isNaN(d.lowerThreshold)) all.push(d.lowerThreshold);
    });
    if (all.length === 0) return [0, 100];
    const min = Math.floor(Math.min(...all) - (selectedChannel === 'solar' ? 50 : 2));
    const max = Math.ceil(Math.max(...all) + (selectedChannel === 'solar' ? 50 : 2));
    return [min, max];
  }, [timeSeriesData, selectedChannel]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload || {};
      return (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '12px 14px',
          boxShadow: '0 8px 24px var(--color-shadow)',
          fontSize: '0.82em',
          color: 'var(--color-text-primary)'
        }}>
          <div className="font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} />
            <span>{data.timeLabel} UTC</span>
          </div>

          {data.isAnomaly && (
            <div style={{
              marginBottom: '6px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 51, 102, 0.15)',
              color: 'var(--color-status-critical)',
              fontWeight: 600,
              fontSize: '0.78em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(255, 51, 102, 0.3)'
            }}>
              <AlertTriangle size={12} />
              <span>{data.anomalyLabel || 'OUTLIER ANOMALY DETECTED'}</span>
            </div>
          )}

          <div style={{ margin: '3px 0', color: '#ffaa00', fontWeight: 600 }}>
            Observed: <span className="font-mono tabular-nums">{data.observed} {activeChannelObj.unit}</span>
          </div>
          <div style={{ margin: '3px 0', color: '#64748b', fontSize: '0.78em' }}>
            Upper (+2.5σ): <span className="font-mono tabular-nums">{data.upperThreshold} {activeChannelObj.unit}</span>
          </div>
          <div style={{ margin: '3px 0', color: '#64748b', fontSize: '0.78em' }}>
            Lower (-2.5σ): <span className="font-mono tabular-nums">{data.lowerThreshold} {activeChannelObj.unit}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const activeAlertsCount = (alerts || []).filter(a => a && (a.status === 'active' || !a.status)).length;
  const criticalCount = (alerts || []).filter(a => a && a.severity === 'high' && (a.status === 'active' || !a.status)).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', padding: '4px' }}>
      
      {/* Top Controls Header matching Screenshot 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: '0.85em', color: 'var(--color-text-secondary)' }}>
          Network: <strong style={{ color: 'var(--color-text-primary)' }}>IMD Pan-India Automatic Weather Stations ({stations.length} Regions)</strong>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Theme Toggle Pills */}
          <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => onToggleTheme && onToggleTheme('dark')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: theme === 'dark' ? 'rgba(0, 240, 255, 0.18)' : 'transparent',
                color: theme === 'dark' ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                fontSize: '0.78em',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Moon size={12} />
              <span>Dark</span>
            </button>
            <button
              onClick={() => onToggleTheme && onToggleTheme('light')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: theme === 'light' ? 'var(--color-surface-hover)' : 'transparent',
                color: theme === 'light' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.78em',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sun size={12} />
              <span>Light</span>
            </button>
          </div>

          {/* Advance Sim Step (+15m) Button */}
          <button
            onClick={handleAdvanceStep}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
              fontSize: '0.82em',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <FastForward size={13} />
            <span>Advance Sim Step (+15m)</span>
          </button>

          {/* Pause / Live Stream Button */}
          <button
            onClick={onToggleStream}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: isPaused ? 'var(--color-status-healthy)' : 'var(--color-status-critical)',
              color: '#ffffff',
              fontSize: '0.82em',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isPaused ? '0 2px 8px rgba(0, 230, 118, 0.3)' : '0 2px 8px rgba(255, 51, 102, 0.3)'
            }}
          >
            {isPaused ? <Play size={13} fill="#ffffff" /> : <Pause size={13} fill="#ffffff" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Cards matching Screenshot 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        
        {/* AWS NETWORK Card */}
        <div className="glass-panel" style={{ padding: '16px 18px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.72em', color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              AWS NETWORK
            </div>
            <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
              {stations.length} <span style={{ fontSize: '0.6em', color: 'var(--color-status-healthy)', fontWeight: 600 }}>Active Stations</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-brand)' }}>
            <Radio size={18} strokeWidth={2} />
          </div>
        </div>

        {/* ACTIVE ANOMALIES Card */}
        <div className="glass-panel" style={{ padding: '16px 18px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.72em', color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              ACTIVE ANOMALIES
            </div>
            <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--color-status-warning)', marginTop: '4px' }}>
              {activeAlertsCount} <span style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Unresolved</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255, 179, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-status-warning)' }}>
            <AlertTriangle size={18} strokeWidth={2} />
          </div>
        </div>

        {/* CRITICAL FAULTS Card */}
        <div className="glass-panel" style={{ padding: '16px 18px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.72em', color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              CRITICAL FAULTS
            </div>
            <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--color-status-critical)', marginTop: '4px' }}>
              {criticalCount} <span style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Priority Triage</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255, 51, 102, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-status-critical)' }}>
            <Flame size={18} strokeWidth={2} />
          </div>
        </div>

        {/* AI PRECISION RATE Card */}
        <div className="glass-panel" style={{ padding: '16px 18px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.72em', color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              AI PRECISION RATE
            </div>
            <div style={{ fontSize: '1.4em', fontWeight: 700, color: 'var(--color-status-healthy)', marginTop: '4px' }}>
              98.8% <span style={{ fontSize: '0.6em', color: 'var(--color-text-secondary)', fontWeight: 500 }}>F1: 0.948</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(0, 230, 118, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-status-healthy)' }}>
            <Target size={18} strokeWidth={2} />
          </div>
        </div>

      </div>

      {/* Main Graph Panel */}
      <div className="glass-panel" style={{ padding: '20px', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Target Station Node Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78em', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
            Target Station Node
          </label>
          <select
            value={currentStation.station_id}
            onChange={(e) => onSelectStation && onSelectStation(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '8px 12px',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '0.88em',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {stations.map(st => {
              const stAlerts = (alerts || []).filter(a => a && a.station_id === st.station_id && (a.status === 'active' || !a.status));
              const badge = stAlerts.length >= 5 ? ' (CRITICAL)' : stAlerts.length > 0 ? ' (DEGRADED)' : ' (NOMINAL)';
              return (
                <option key={st.station_id} value={st.station_id}>
                  {st.station_id} - {st.fullName || st.name}{badge}
                </option>
              );
            })}
          </select>
        </div>

        {/* Sensor Channel Pills matching Screenshot 1 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {channels.map(chan => {
            const isActive = selectedChannel === chan.id;
            return (
              <button
                key={chan.id}
                onClick={() => setSelectedChannel(chan.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? '#2563eb' : 'var(--color-surface-hover)',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                  fontSize: '0.82em',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {chan.label}
              </button>
            );
          })}
        </div>

        {/* Legend Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.78em', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffaa00', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Observed Telemetry: {activeChannelObj.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '2px', borderTop: '2px dashed #64748b', display: 'inline-block' }}></span>
            <span>Upper Threshold (+2.5σ)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '2px', borderTop: '2px dashed #64748b', display: 'inline-block' }}></span>
            <span>Lower Threshold (-2.5σ)</span>
          </div>
        </div>

        {/* Main High-Definition Time-Series Chart */}
        <div style={{ width: '100%', height: '360px', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis 
                dataKey="timeLabel" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
              />
              <YAxis 
                domain={yValues} 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v)}`}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Upper Confidence Threshold Line (+2.5σ) */}
              <Line 
                type="monotone" 
                dataKey="upperThreshold" 
                name="Upper Threshold (+2.5σ)" 
                stroke="#475569" 
                strokeDasharray="4 4" 
                strokeWidth={1.5} 
                dot={false}
                isAnimationActive={false}
              />

              {/* Lower Confidence Threshold Line (-2.5σ) */}
              <Line 
                type="monotone" 
                dataKey="lowerThreshold" 
                name="Lower Threshold (-2.5σ)" 
                stroke="#475569" 
                strokeDasharray="4 4" 
                strokeWidth={1.5} 
                dot={false}
                isAnimationActive={false}
              />

              {/* Main Observed Telemetry Curve */}
              <Line 
                type="monotone" 
                dataKey="observed" 
                name={`Observed ${activeChannelObj.label}`} 
                stroke="#ffaa00" 
                strokeWidth={2.5}
                dot={(props) => {
                  const isAnom = props.payload?.isAnomaly;
                  if (props.cx !== undefined && props.cy !== undefined) {
                    if (isAnom) {
                      return (
                        <circle 
                          key={props.key}
                          cx={props.cx} 
                          cy={props.cy} 
                          r={6} 
                          fill="#ff3366" 
                          stroke="#ffffff" 
                          strokeWidth={2} 
                        />
                      );
                    }
                    return (
                      <circle 
                        key={props.key}
                        cx={props.cx} 
                        cy={props.cy} 
                        r={3.5} 
                        fill="#ffaa00" 
                        stroke="var(--color-surface)" 
                        strokeWidth={1} 
                      />
                    );
                  }
                  return null;
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Bottom Right Toast Notification matching Screenshot 1 */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '24px',
          background: 'rgba(153, 27, 27, 0.92)',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.84em',
          fontWeight: 600,
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          animation: 'slideIn 0.3s ease'
        }}>
          <span>🚨 {toastMessage}</span>
          <button 
            onClick={() => setShowToast(false)} 
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}

// -------------------------------------------------------------
// Helper Functions for Multi-Channel Diurnal Generation & Physics
// -------------------------------------------------------------
function generateDiurnalData(station, channel, alerts = []) {
  const list = [];
  const now = Date.now();
  const stepMs = 15 * 60 * 1000; // 15-minute intervals across 24 steps
  const stationId = station.station_id || 'AWS_MUM';
  const seed = stationId.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0);
  
  // Check if this station has active alerts
  const stationAlerts = alerts.filter(a => a && a.station_id === stationId && (a.status === 'active' || !a.status));
  const hasAlert = stationAlerts.length > 0;
  const anomalyStep = hasAlert ? 22 : -1;

  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * stepMs);
    const stepIdx = (24 - i) % 48;
    const baseVal = getChannelBaseline(station, channel, stepIdx);
    const noise = (Math.sin(i * 0.4 + seed) * 0.4) + ((Math.sin(i * 1.7 + seed) * 0.2));
    
    let observed = baseVal + noise;
    let isAnom = false;
    let anomalyLabel = null;

    if (i === 0 && hasAlert) {
      isAnom = true;
      anomalyLabel = stationAlerts[0]?.root_cause ? stationAlerts[0].root_cause.replace(/_/g, ' ').toUpperCase() : 'TELEMETRY ANOMALY';
      const offset = channel === 'pressure' ? 24 : channel === 'humidity' ? 28 : channel === 'wind' ? 12 : 7.8;
      observed = baseVal + offset;
    }

    const sigma = getChannelSigma(channel);
    const upperThreshold = parseFloat((baseVal + 2.5 * sigma).toFixed(2));
    const lowerThreshold = parseFloat((baseVal - 2.5 * sigma).toFixed(2));

    list.push({
      stepIdx,
      timestamp: t.toISOString(),
      timeLabel: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      observed: parseFloat(observed.toFixed(2)),
      upperThreshold,
      lowerThreshold,
      isAnomaly: isAnom || observed > upperThreshold || observed < lowerThreshold,
      anomalyLabel
    });
  }

  return list;
}

function getChannelBaseline(station, channel, stepIdx) {
  const baseT = station.base_temp !== undefined ? station.base_temp : 32.0;
  const baseP = station.base_pressure !== undefined ? station.base_pressure : 1010.0;
  const baseH = station.base_humidity !== undefined ? station.base_humidity : 60.0;

  // Diurnal sinusoidal wave progression across day (48 steps = 24 hours)
  const diurnalAngle = ((stepIdx - 12) / 48) * 2 * Math.PI;

  switch (channel) {
    case 'temp':
      // Low at night (step 12 = 06:00), Peak at afternoon (step 30 = 15:00)
      return baseT - 6.5 * Math.cos(diurnalAngle);
    case 'humidity':
      // Inverse of temperature (high humidity at night, low in afternoon)
      return Math.min(95, Math.max(25, baseH + 15.0 * Math.cos(diurnalAngle)));
    case 'pressure':
      // Semidiurnal atmospheric tide
      return baseP + 2.5 * Math.sin(diurnalAngle * 2);
    case 'wind':
      // Higher wind during afternoon heating
      return Math.max(1.0, 4.5 + 3.0 * Math.sin(diurnalAngle));
    case 'solar':
      // Daylight only between 06:00 and 18:00
      const solarRad = Math.sin(diurnalAngle);
      return solarRad > 0 ? solarRad * 850 : 0;
    default:
      return baseT;
  }
}

function getChannelNoise(channel) {
  switch (channel) {
    case 'temp': return 0.5;
    case 'humidity': return 1.2;
    case 'pressure': return 0.3;
    case 'wind': return 0.8;
    case 'solar': return 15.0;
    default: return 0.5;
  }
}

function getChannelSigma(channel) {
  switch (channel) {
    case 'temp': return 0.9;
    case 'humidity': return 2.2;
    case 'pressure': return 0.6;
    case 'wind': return 1.2;
    case 'solar': return 25.0;
    default: return 1.0;
  }
}
