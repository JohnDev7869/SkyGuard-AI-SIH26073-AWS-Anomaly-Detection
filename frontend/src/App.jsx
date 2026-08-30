import React, { useState, useEffect, useCallback } from 'react';
import NetworkMap from './components/NetworkMap';
import StationDetail from './components/StationDetail';
import AlertFeed from './components/AlertFeed';
import HealthPanel from './components/HealthPanel';
import AnomalyLogs from './components/AnomalyLogs';
import FaultInjector from './components/FaultInjector';
import ErrorBoundary from './components/ErrorBoundary';
import { getStations, getAlerts, getAlertStats, getSimStatus, toggleSimulator, getSystemMetrics } from './api/client';
import { 
  Globe, 
  BarChart3, 
  Zap, 
  AlertTriangle, 
  ScanSearch, 
  Menu, 
  Moon, 
  Sun, 
  Play, 
  Pause, 
  Activity, 
  Radio
} from 'lucide-react';

export default function App() {
  const [stations, setStations] = useState(() => {
    try {
      const saved = localStorage.getItem('skyguard_cached_stations');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });

  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('skyguard_cached_alerts');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });

  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('skyguard_cached_stats');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {
      total: 0,
      critical: 0,
      warning: 0,
      resolved: 0,
      active: 0,
      false_alarm: 0,
      precision_rate: 96.8
    };
  });
  const [systemMetrics, setSystemMetrics] = useState({
    avg_latency_ms: 2.1,
    throughput_rps: 12.5,
    active_stations: 25
  });
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeTab, setActiveTab] = useState('map'); 
  
  // Persist theme to localStorage (Priority 4)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('skyguard-theme') || 'dark';
    } catch(e) {
      return 'dark';
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Simulator Controls
  const [simStatus, setSimStatus] = useState({ is_running: true, injection_enabled: true });

  // Live Freshness Counter (Fix 13)
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Synchronize state changes to localStorage
  useEffect(() => {
    if (stats) {
      try {
        localStorage.setItem('skyguard_cached_stats', JSON.stringify(stats));
      } catch(e) {}
    }
  }, [stats]);

  useEffect(() => {
    if (alerts) {
      try {
        localStorage.setItem('skyguard_cached_alerts', JSON.stringify(alerts));
      } catch(e) {}
    }
  }, [alerts]);

  useEffect(() => {
    if (stations && stations.length > 0) {
      try {
        localStorage.setItem('skyguard_cached_stations', JSON.stringify(stations));
      } catch(e) {}
    }
  }, [stations]);

  useEffect(() => {
    try {
      localStorage.setItem('skyguard-theme', theme);
    } catch(e) {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Freshness timer updates every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - lastMessageTimestamp) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastMessageTimestamp]);

  const refreshSimStatus = () => {
    getSimStatus().then(status => {
      if (status) setSimStatus(status);
    }).catch(() => {});
  };

  const refreshSystemMetrics = () => {
    getSystemMetrics().then(m => {
      if (m) setSystemMetrics(m);
    }).catch(() => {});
  };

  const refreshAll = useCallback(() => {
    getStations().then(setStations).catch(() => {});
    getAlerts('all', 500).then(setAlerts).catch(() => {});
    getAlertStats().then(setStats).catch(() => {});
    refreshSystemMetrics();
  }, []);

  useEffect(() => {
    refreshAll();
    refreshSimStatus();

    // Setup periodic sync every 2.5s only for stats, station health & system latency
    const pollInterval = setInterval(() => {
      getAlertStats().then(setStats).catch(() => {});
      getStations().then(setStations).catch(() => {});
      refreshSystemMetrics();
    }, 2500);

    let ws = null;
    try {
      let wsUrl = 'ws://127.0.0.1:8000';
      if (typeof window !== 'undefined' && window.location && window.location.host) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}`;
      }
      if (import.meta.env.VITE_API_URL) {
        wsUrl = import.meta.env.VITE_API_URL.replace('http', 'ws');
      }
      ws = new WebSocket(`${wsUrl}/ws/alerts`);
      
      ws.onmessage = (event) => {
        try {
          setLastMessageTimestamp(Date.now());
          setSecondsAgo(0);

          const msg = JSON.parse(event.data);
          if (msg.type === 'NEW_ALERT') {
            const newAlert = msg.data;
            setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)].slice(0, 500));
            setStats(prev => ({
              ...prev,
              total: prev.total + 1,
              critical: prev.critical + (newAlert.severity === 'high' ? 1 : 0),
              warning: prev.warning + (newAlert.severity !== 'high' ? 1 : 0),
              active: prev.active + 1
            }));
          } else if (msg.type === 'INCIDENT_UPDATED') {
            const updatedAlert = msg.data;
            setAlerts(prev => {
              const exists = prev.some(a => a.id === updatedAlert.id);
              if (exists) {
                return prev.map(a => a.id === updatedAlert.id ? {
                  ...a,
                  last_seen: updatedAlert.last_seen,
                  occurrence_count: updatedAlert.occurrence_count,
                  severity: updatedAlert.severity,
                  confidence: updatedAlert.confidence,
                  raw_value_json: a.raw_value_json || updatedAlert.raw_value_json,
                  corrected_value_json: a.corrected_value_json || updatedAlert.corrected_value_json,
                  shap_json: a.shap_json || updatedAlert.shap_json,
                  explanation_json: a.explanation_json || updatedAlert.explanation_json
                } : a);
              } else {
                return [updatedAlert, ...prev].slice(0, 500);
              }
            });
          } else if (msg.type === 'ALERT_RESOLVED' || msg.type === 'ALERT_REJECTED') {
            const alertId = msg.data.alert_id;
            let wasCritical = false;
            setAlerts(prev => {
              const target = prev.find(a => a.id === alertId);
              if (target && target.severity === 'high') wasCritical = true;
              return prev.map(a => a.id === alertId ? { ...a, status: msg.data.status } : a);
            });
            setStats(prev => ({
              ...prev,
              active: Math.max(0, prev.active - 1),
              critical: wasCritical ? Math.max(0, prev.critical - 1) : prev.critical,
              warning: !wasCritical ? Math.max(0, prev.warning - 1) : prev.warning,
              resolved: msg.data.status === 'resolved' ? prev.resolved + 1 : prev.resolved,
              false_alarm: msg.data.status === 'false_alarm' || msg.data.status === 'rejected' ? prev.false_alarm + 1 : prev.false_alarm
            }));
          } else if (msg.type === 'SIMULATOR_STATE_CHANGED') {
            if (msg.data) {
              setSimStatus(prev => ({ ...prev, ...msg.data }));
            }
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [refreshAll]);

  const handleToggleStream = async () => {
    const updated = await toggleSimulator('stream');
    if (updated) {
      setSimStatus(prev => ({ ...prev, ...updated }));
    }
  };

  const navItemStyle = (id) => ({
    padding: '12px 18px',
    cursor: 'pointer',
    fontWeight: activeTab === id ? '600' : '400',
    background: activeTab === id ? 'var(--color-surface-hover)' : 'transparent',
    borderLeft: activeTab === id ? '3px solid var(--color-brand)' : '3px solid transparent',
    color: activeTab === id ? 'var(--color-brand)' : 'var(--color-text-secondary)',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.88em',
    userSelect: 'none'
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--color-bg)' }}>
      
      {/* Collapsible Sidebar */}
      <div className="glass-panel" style={{ 
        width: sidebarOpen ? '270px' : '0px', 
        opacity: sidebarOpen ? 1 : 0,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
        display: 'flex', flexDirection: 'column',
        borderRadius: 0, borderTop: 0, borderBottom: 0, borderLeft: 0,
        zIndex: 10,
        overflow: 'hidden'
      }}>
        {/* Brand Header */}
        <div style={{ padding: '20px 18px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={20} strokeWidth={2} style={{ color: 'var(--color-brand)' }} />
            <h1 style={{ 
              margin: 0, fontSize: '1.25em', color: 'var(--color-text-primary)', 
              fontWeight: 700, letterSpacing: '1px'
            }}>
              SkyGuard <span style={{ color: 'var(--color-brand)' }}>AI</span>
            </h1>
          </div>
          <div style={{ fontSize: '0.74em', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 500, letterSpacing: '0.5px' }}>
            METEOROLOGICAL ANOMALY SHIELD
          </div>
        </div>
        
        {/* Navigation Menu */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '10px' }}>
          <div style={navItemStyle('map')} onClick={() => setActiveTab('map')}>
            <Globe size={18} strokeWidth={1.75} /> Satellite Map
          </div>
          <div style={navItemStyle('graphs')} onClick={() => setActiveTab('graphs')}>
            <BarChart3 size={18} strokeWidth={1.75} /> Data & Graphs
          </div>
          <div style={navItemStyle('injector')} onClick={() => setActiveTab('injector')}>
            <Zap size={18} strokeWidth={1.75} /> Fault Injection Lab
          </div>
          <div style={navItemStyle('alerts')} onClick={() => setActiveTab('alerts')}>
            <AlertTriangle size={18} strokeWidth={1.75} /> Action Center
          </div>
          <div style={navItemStyle('anomalies')} onClick={() => setActiveTab('anomalies')}>
            <ScanSearch size={18} strokeWidth={1.75} /> Anomaly Telemetry Logs
          </div>
        </div>

        {/* Sidebar Footer with Live System Health Stat Strip (Priority 1 & 3) */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Latency & Throughput Numbers */}
          <div style={{ background: 'var(--color-surface-hover)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.78em', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
              <span>Inference Latency:</span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {systemMetrics.avg_latency_ms} ms
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-secondary)' }}>
              <span>Throughput:</span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--color-status-healthy)', fontWeight: 600 }}>
                {systemMetrics.throughput_rps} rps
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78em', color: 'var(--color-text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} strokeWidth={1.75} />
              <span>Network Status</span>
            </div>
            <span className="font-mono" style={{ color: simStatus.is_running ? 'var(--color-status-healthy)' : 'var(--color-status-warning)', fontWeight: 600 }}>
              {simStatus.is_running ? '25 AWS Active' : 'Paused'}
            </span>
          </div>

          <button 
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            style={{
              width: '100%', background: 'var(--color-surface)', color: 'var(--color-text-primary)', 
              border: '1px solid var(--color-border)', padding: '8px 12px', 
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.82em', fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}
          >
            {theme === 'light' ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
            <span>{theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Top App Bar with Controls (Single-Tier UPPERCASE Page Title) */}
        <div className="glass-panel" style={{ 
          margin: '12px 14px 0 14px', 
          padding: '10px 16px', 
          borderRadius: '8px',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
                padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Toggle Sidebar"
            >
              <Menu size={16} strokeWidth={1.75} />
            </button>
            <span style={{ fontSize: '0.88em', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.75px' }}>
              {activeTab === 'map' && 'NATIONAL WEATHER NETWORK RADAR'}
              {activeTab === 'graphs' && 'REAL-TIME SENSOR TELEMETRY DIAGNOSTICS'}
              {activeTab === 'injector' && 'SYNTHETIC METEOROLOGICAL FAULT INJECTION LAB'}
              {activeTab === 'alerts' && 'INCIDENT ACTION & STANDARD OPERATING PROCEDURES'}
              {activeTab === 'anomalies' && 'ANOMALY DETECTION ENGINE & SHAP ATTRIBUTIONS'}
            </span>
          </div>

          {/* Top Right Live Telemetry Controls (Priority 3: Blue Action Button) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* Live Telemetry Status & Freshness Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82em',
              fontWeight: 500,
              color: simStatus.is_running ? 'var(--color-status-healthy)' : 'var(--color-text-secondary)',
              padding: '6px 12px',
              background: 'var(--color-surface-hover)',
              borderRadius: '6px',
              border: '1px solid var(--color-border)'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: simStatus.is_running ? 'var(--color-status-healthy)' : 'var(--color-text-secondary)' }}></span>
              <span className="font-mono tabular-nums">{simStatus.is_running ? `ONLINE • ${secondsAgo <= 1 ? 'Just now' : `${secondsAgo}s ago`}` : 'OFFLINE'}</span>
            </div>

            {/* Live Station Telemetry Stream Control (Priority 3: Action Primary Blue) */}
            <button
              onClick={handleToggleStream}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid var(--color-action-primary)',
                background: 'var(--color-action-primary)',
                color: 'var(--color-surface)',
                fontWeight: 600,
                fontSize: '0.85em',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1.0'}
              title={simStatus.is_running ? "Pause Live Telemetry Stream" : "Resume Live Telemetry Stream"}
            >
              {simStatus.is_running ? <Pause size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
              <span>Live Telemetry</span>
            </button>

          </div>
        </div>

        {/* Tab View Container */}
        <div style={{ flex: 1, padding: '12px 14px 14px 14px', display: 'flex', gap: '14px', overflow: 'hidden' }}>
          <ErrorBoundary>
            {activeTab === 'map' && (
              <>
                <div className="glass-panel" style={{ flex: 3, overflow: 'hidden' }}>
                  <NetworkMap 
                    stations={stations} 
                    alerts={alerts} 
                    onSelectStation={(stId) => { setSelectedStation(stId); setActiveTab('graphs'); }} 
                    theme={theme} 
                    isPaused={!simStatus.is_running}
                    onStartStream={handleToggleStream}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <HealthPanel 
                    stations={stations} 
                    alerts={alerts} 
                    onSelect={(stId) => { setSelectedStation(stId); setActiveTab('graphs'); }} 
                  />
                </div>
              </>
            )}

            {activeTab === 'graphs' && (
              <div className="glass-panel" style={{ flex: 1, display: 'flex', padding: '20px', gap: '20px', overflow: 'hidden' }}>
                <div style={{ width: '260px', borderRight: '1px solid var(--color-border)', paddingRight: '15px', overflowY: 'auto' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--color-text-primary)', fontSize: '0.95em', fontWeight: 600 }}>
                    Indian AWS Stations
                  </h3>
                  {(stations || []).map(s => (
                    <div key={s.station_id} 
                         onClick={() => setSelectedStation(s.station_id)}
                         style={{
                           padding: '9px 12px', margin: '4px 0', cursor: 'pointer', borderRadius: '6px',
                           background: selectedStation === s.station_id ? 'var(--color-surface-hover)' : 'transparent',
                           border: selectedStation === s.station_id ? '1px solid var(--color-brand)' : '1px solid transparent',
                           color: 'var(--color-text-primary)',
                           display: 'flex',
                           justifyContent: 'space-between',
                           alignItems: 'center',
                           transition: 'all 0.15s ease'
                         }}>
                      <span style={{ fontSize: '0.9em', fontWeight: 500 }}>{s.name}</span>
                      <span className="font-mono tabular-nums" style={{ fontSize: '0.78em', color: 'var(--color-text-secondary)' }}>{s.station_id}</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {selectedStation ? (
                    <StationDetail 
                      stationId={selectedStation} 
                      alerts={(alerts || []).filter(a => a.station_id === selectedStation)} 
                      theme={theme} 
                      isPaused={!simStatus.is_running}
                      onStartStream={handleToggleStream}
                    />
                  ) : (
                    <div style={{ color: 'var(--color-text-secondary)', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: '0.9em' }}>
                      Select an AWS station from the left column to view real-time telemetry curves and AI corrections.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'injector' && (
               <FaultInjector stations={stations} onInjectionSuccess={refreshAll} />
            )}

            {activeTab === 'alerts' && (
               <AlertFeed alerts={alerts} stats={stats} stations={stations} onAlertResolved={refreshAll} />
            )}

            {activeTab === 'anomalies' && (
               <AnomalyLogs alerts={alerts} stations={stations} />
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
