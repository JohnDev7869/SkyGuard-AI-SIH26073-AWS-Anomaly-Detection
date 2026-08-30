import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Activity, X, MapPin, Radio, ShieldCheck, AlertTriangle, Pause, Play } from 'lucide-react';

const HEALTHY_MAX = 0.10;
const WARNING_MAX = 0.25;

function MapAutoCenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 7, { duration: 1.0 });
    }
  }, [coords, map]);
  return null;
}

function ClusteredMarkers({ stations, activeAlerts, onMarkerClick, getNodeColor }) {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const clickHandlerRef = useRef(onMarkerClick);
  clickHandlerRef.current = onMarkerClick;

  // Initialize cluster group once on map mount
  useEffect(() => {
    if (!map) return;

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: function (cluster) {
        const childMarkers = cluster.getAllChildMarkers();
        let status = 'healthy';
        for (const m of childMarkers) {
          if (m.options.stationStatus === 'critical') {
            status = 'critical';
            break;
          } else if (m.options.stationStatus === 'warning') {
            status = 'warning';
          }
        }
        
        const count = cluster.getChildCount();
        const bg = status === 'critical' 
          ? 'rgba(255, 92, 92, 0.95)' 
          : status === 'warning' 
          ? 'rgba(245, 166, 35, 0.95)' 
          : 'rgba(61, 220, 132, 0.95)';
        const border = status === 'critical'
          ? 'var(--color-status-critical)'
          : status === 'warning'
          ? 'var(--color-status-warning)'
          : 'var(--color-status-healthy)';

        return L.divIcon({
          html: `<div style="background:${bg}; border: 2px solid ${border}; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(32, 32, true)
        });
      }
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
      markersMapRef.current.clear();
    };
  }, [map]);

  // Persistently update existing markers without tearing down DOM elements
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup || !stations || stations.length === 0) return;

    const markersMap = markersMapRef.current;

    stations.forEach(s => {
      const color = getNodeColor(s.station_id);
      const stationAlerts = (activeAlerts || []).filter(a => a.station_id === s.station_id);
      const hasAnomaly = stationAlerts.length > 0;
      
      let statusStr = 'healthy';
      if (color.includes('critical')) statusStr = 'critical';
      else if (color.includes('warning')) statusStr = 'warning';

      const markerHtml = `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${hasAnomaly ? `<div style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background: ${color}; opacity: 0.45; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
          <div style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.6);"></div>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-station-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      if (markersMap.has(s.station_id)) {
        const marker = markersMap.get(s.station_id);
        marker.setIcon(markerIcon);
        marker.options.stationStatus = statusStr;
      } else {
        const marker = L.marker([s.lat, s.lon], {
          icon: markerIcon,
          stationStatus: statusStr,
          stationId: s.station_id
        });

        marker.on('click', () => {
          if (clickHandlerRef.current) {
            clickHandlerRef.current(s);
          }
        });

        clusterGroup.addLayer(marker);
        markersMap.set(s.station_id, marker);
      }
    });
  }, [stations, activeAlerts, getNodeColor]);

  return null;
}

export default function NetworkMap({ stations = [], alerts = [], onSelectStation, theme = 'dark', isPaused = false, onStartStream }) {
  const [selectedStationCoords, setSelectedStationCoords] = useState(null);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [cityAverages, setCityAverages] = useState(null);

  const activeAlerts = (alerts || []).filter(a => a.status === 'active' || !a.status);

  // Single Shared Source of Truth Node Color Logic strictly based on fault rate thresholds
  const getNodeColor = (stationId) => {
    const stationObj = (stations || []).find(st => st.station_id === stationId);
    const health = stationObj?.health || {};
    const rate = Number(health.rolling_anomaly_rate !== undefined ? health.rolling_anomaly_rate : 0);

    // Strictly matches the legend & health badge (<10% Healthy, 10-25% Warning, >25% Critical)
    if (rate > WARNING_MAX) {
      return 'var(--color-status-critical)';
    }
    if (rate >= HEALTHY_MAX) {
      return 'var(--color-status-warning)';
    }
    return 'var(--color-status-healthy)';
  };

  const handleMarkerClick = async (s) => {
    setSelectedStationCoords([s.lat, s.lon]);
    setSelectedStationId(s.station_id);

    try {
      const readings = await getReadings(s.station_id);
      if (readings && readings.length > 0) {
        const last10 = readings.slice(-10);
        const validT = last10.map(r => r.temperature).filter(v => v !== null && v !== undefined && v > -100);
        const avgT = validT.length > 0 ? (validT.reduce((a, b) => a + b, 0) / validT.length).toFixed(1) : (Number(s.base_temp || 30)).toFixed(1);
        const validP = last10.map(r => r.pressure).filter(v => v !== null && v !== undefined);
        const avgP = validP.length > 0 ? (validP.reduce((a, b) => a + b, 0) / validP.length).toFixed(0) : (Number(s.base_pressure || 1010)).toFixed(0);
        const validH = last10.map(r => r.humidity).filter(v => v !== null && v !== undefined);
        const avgH = validH.length > 0 ? (validH.reduce((a, b) => a + b, 0) / validH.length).toFixed(0) : (Number(s.base_humidity || 60)).toFixed(0);
        setCityAverages({ avgT, avgP, avgH });
      } else {
        setCityAverages({
          avgT: (Number(s.base_temp || 30)).toFixed(1),
          avgP: (Number(s.base_pressure || 1010)).toFixed(0),
          avgH: (Number(s.base_humidity || 60)).toFixed(0)
        });
      }
    } catch(e) {
      setCityAverages({
        avgT: (Number(s.base_temp || 30)).toFixed(1),
        avgP: (Number(s.base_pressure || 1010)).toFixed(0),
        avgH: (Number(s.base_humidity || 60)).toFixed(0)
      });
    }
  };

  // Derive dynamic, live selected station details strictly from shared props
  const selectedStation = selectedStationId ? (stations || []).find(st => st.station_id === selectedStationId) : null;
  
  let popupHealthData = null;
  if (selectedStation) {
    const health = selectedStation.health || {};
    const rate = Number(health.rolling_anomaly_rate !== undefined ? health.rolling_anomaly_rate : 0);
    const stationAlerts = activeAlerts.filter(a => a.station_id === selectedStation.station_id);
    const anomalyCount = stationAlerts.length;

    let healthStatus = 'Healthy';
    let healthColor = 'var(--color-status-healthy)';
    let healthBg = 'rgba(61, 220, 132, 0.12)';
    let healthBorder = 'rgba(61, 220, 132, 0.3)';

    if (rate > WARNING_MAX) {
      healthStatus = 'Critical';
      healthColor = 'var(--color-status-critical)';
      healthBg = 'rgba(255, 92, 92, 0.15)';
      healthBorder = 'rgba(255, 92, 92, 0.4)';
    } else if (rate >= HEALTHY_MAX) {
      healthStatus = 'Warning';
      healthColor = 'var(--color-status-warning)';
      healthBg = 'rgba(245, 166, 35, 0.15)';
      healthBorder = 'rgba(245, 166, 35, 0.4)';
    }

    popupHealthData = {
      station: selectedStation,
      faultRate: rate,
      healthStatus,
      healthColor,
      healthBg,
      healthBorder,
      anomalyCount
    };
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      
      <MapContainer 
        center={[22.0, 79.0]} 
        zoom={6} 
        style={{ height: '100%', width: '100%', background: 'var(--color-bg)' }}
        zoomControl={false}
      >
        {/* OpenStreetMap (OSM) Standard Tile Layer with Dynamic Dark/Light Modes */}
        <TileLayer
          key={`osm-${theme}`}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          maxZoom={19}
          className={theme === 'dark' ? 'osm-dark-tiles' : 'osm-light-tiles'}
        />

        <MapAutoCenter coords={selectedStationCoords} />

        <ClusteredMarkers 
          stations={stations} 
          activeAlerts={activeAlerts} 
          onMarkerClick={handleMarkerClick}
          getNodeColor={getNodeColor}
        />
      </MapContainer>

      {/* Paused Live Stream Blur Overlay (Exclusive to Satellite Map) */}
      {isPaused && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 15, 20, 0.68)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 600,
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 12px 32px var(--color-shadow)',
            maxWidth: '380px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(245, 166, 35, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-status-warning)'
            }}>
              <Pause size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05em', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                Live Telemetry Paused
              </h3>
              <p style={{ margin: 0, fontSize: '0.8em', color: 'var(--color-text-secondary)' }}>
                Satellite radar tracking is paused. Click below to resume real-time station feeds.
              </p>
            </div>
            {onStartStream && (
              <button
                onClick={onStartStream}
                style={{
                  marginTop: '4px',
                  padding: '8px 18px',
                  background: 'var(--color-brand)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.84em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Play size={14} fill="currentColor" />
                <span>Resume Telemetry</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Left Live Station Counter Badge */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '6px 12px',
        zIndex: 400,
        boxShadow: '0 2px 8px var(--color-shadow)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.82em',
        fontWeight: 500,
        color: 'var(--color-text-primary)'
      }}>
        <Radio size={14} style={{ color: 'var(--color-brand)' }} />
        <span>Live AWS Grid: <strong className="font-mono tabular-nums">{stations.length} Active Nodes</strong></span>
      </div>

      {/* Map Legend Overlay with Numerical Thresholds */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        padding: '10px 14px',
        zIndex: 400,
        boxShadow: '0 2px 8px var(--color-shadow)',
        fontSize: '0.78em',
        color: 'var(--color-text-primary)'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-secondary)', fontSize: '0.82em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Station Health Banding
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-status-healthy)', boxShadow: '0 0 4px var(--color-status-healthy)' }}></span>
            <span>Healthy (&lt; 10% fault rate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-status-warning)', boxShadow: '0 0 4px var(--color-status-warning)' }}></span>
            <span>Warning (10% - 25% fault rate)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-status-critical)', boxShadow: '0 0 4px var(--color-status-critical)' }}></span>
            <span>Critical (&gt; 25% fault rate)</span>
          </div>
        </div>
      </div>

      {/* Selected City Detail Card Overlay on Map */}
      {popupHealthData && (
        <div className="glass-panel" style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          width: '320px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '16px',
          zIndex: 500,
          boxShadow: '0 8px 24px var(--color-shadow)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} strokeWidth={2} color="var(--color-brand)" />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ fontSize: '0.95em', color: 'var(--color-text-primary)' }}>{popupHealthData.station.name}</strong>
                  <span className="font-mono tabular-nums" style={{ fontSize: '0.78em', color: 'var(--color-text-secondary)' }}>
                    ({popupHealthData.station.station_id})
                  </span>
                </div>
                {/* Health Badge in Map Popup Card (Single Shared Source of Truth) */}
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: popupHealthData.healthBg,
                    border: `1px solid ${popupHealthData.healthBorder}`,
                    color: popupHealthData.healthColor,
                    fontSize: '0.74em',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {popupHealthData.healthStatus === 'Critical' && <AlertTriangle size={10} strokeWidth={2} />}
                    <span>{popupHealthData.healthStatus} • {(popupHealthData.faultRate * 100).toFixed(1)}%</span>
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { setSelectedStationId(null); setCityAverages(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: 'var(--color-surface-hover)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)' }}>Temperature</span>
              <strong className="font-mono tabular-nums" style={{ fontSize: '0.95em', color: 'var(--color-text-primary)', display: 'block' }}>
                {cityAverages?.avgT || (Number(popupHealthData.station.base_temp || 30)).toFixed(1)}°C
              </strong>
            </div>
            <div style={{ background: 'var(--color-surface-hover)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)' }}>Pressure</span>
              <strong className="font-mono tabular-nums" style={{ fontSize: '0.95em', color: 'var(--color-text-primary)', display: 'block' }}>
                {cityAverages?.avgP || (Number(popupHealthData.station.base_pressure || 1010)).toFixed(0)} hPa
              </strong>
            </div>
            <div style={{ background: 'var(--color-surface-hover)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.7em', color: 'var(--color-text-secondary)' }}>Humidity</span>
              <strong className="font-mono tabular-nums" style={{ fontSize: '0.95em', color: 'var(--color-text-primary)', display: 'block' }}>
                {cityAverages?.avgH || (Number(popupHealthData.station.base_humidity || 60)).toFixed(0)}%
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78em', marginBottom: '12px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Active Anomalies:</span>
            <span className="font-mono tabular-nums" style={{
              fontWeight: 600,
              color: popupHealthData.anomalyCount > 0 ? 'var(--color-status-critical)' : 'var(--color-status-healthy)'
            }}>
              {popupHealthData.anomalyCount > 0 ? `${popupHealthData.anomalyCount} Active` : '0 Active (Calm)'}
            </span>
          </div>

          <button
            onClick={() => {
              if (onSelectStation) onSelectStation(popupHealthData.station.station_id);
            }}
            style={{
              width: '100%',
              padding: '7px 12px',
              background: 'var(--color-action-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>Inspect Detailed Telemetry Curves &rarr;</span>
          </button>
        </div>
      )}

    </div>
  );
}
