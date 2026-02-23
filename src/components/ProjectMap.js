import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const YEARS    = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const STATUSES = ['COMPLETED', 'ONGOING', 'YET TO MOBILIZE'];
const TYPES    = [
  'GRID', 'SOLAR STREET LIGHT', 'SOLAR MINI GRID', 'SOLAR HOME SYSTEM',
  'SOLAR BOREHOLE', 'SOLAR WATER PUMP', 'SOLAR PUMPING MACHINE',
  'SOLAR IRRIGATION PUMP', 'INJECTION SUBSTATION', 'TRAINING',
  'ELECTRIC VEHICLE', 'COUNTERPART FUNDING', 'VEHICLE PURCHASE', 'HQRTS',
  'GRID/SOLAR STREET LIGHT', 'GRID/SOLAR HOME SYSTEM', 'GRID/SOLAR MINI GRID',
  'SOLAR MINI GRID/SOLAR STREET LIGHT', 'SOLAR STREET LIGHT/SOLAR HOME SYSTEM',
];

const STATUS_COLORS = {
  'COMPLETED':       '#2ecc71',
  'ONGOING':         '#f39c12',
  'YET TO MOBILIZE': '#E63946',
};

// ── Pill chip component ───────────────────────────────────────────────────────
const Chip = ({ label, active, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      cursor: 'pointer', border: '1.5px solid',
      borderColor: active ? color : '#ddd',
      background: active ? color : '#fff',
      color: active ? '#fff' : '#555',
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const ProjectMap = () => {
  const mapContainer = useRef(null);
  const map          = useRef(null);

  const [panelOpen,      setPanelOpen]      = useState(false);
  const [selectedYears,  setSelectedYears]  = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [activeState,    setActiveState]    = useState(null);
  const [pointCount,     setPointCount]     = useState(null);

  // ── Build & apply Mapbox filter ───────────────────────────────────────────
  const applyFilter = useCallback((years, statuses, types, stateName) => {
    if (!map.current || !map.current.getLayer('project-points')) return;

    const conditions = [];

    if (stateName) {
      conditions.push(['==', ['get', 'state'], stateName]);
    }
    if (years.length) {
      conditions.push(['in', ['get', 'year'], ['literal', years]]);
    }
    if (statuses.length) {
      conditions.push(['in', ['get', 'status'], ['literal', statuses]]);
    }
    if (types.length) {
      conditions.push(['in', ['get', 'type'], ['literal', types]]);
    }

    const filter = conditions.length === 0
      ? null
      : conditions.length === 1
        ? conditions[0]
        : ['all', ...conditions];

    map.current.setFilter('project-points', filter);

    // Update visible count
    setTimeout(() => {
      const visible = map.current.queryRenderedFeatures({ layers: ['project-points'] });
      setPointCount(visible.length);
    }, 300);
  }, []);

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleYear = (y) => {
    const next = selectedYears.includes(y)
      ? selectedYears.filter(v => v !== y)
      : [...selectedYears, y];
    setSelectedYears(next);
    applyFilter(next, selectedStatus, selectedTypes, activeState);
  };

  const toggleStatus = (s) => {
    const next = selectedStatus.includes(s)
      ? selectedStatus.filter(v => v !== s)
      : [...selectedStatus, s];
    setSelectedStatus(next);
    applyFilter(selectedYears, next, selectedTypes, activeState);
  };

  const toggleType = (t) => {
    const next = selectedTypes.includes(t)
      ? selectedTypes.filter(v => v !== t)
      : [...selectedTypes, t];
    setSelectedTypes(next);
    applyFilter(selectedYears, selectedStatus, next, activeState);
  };

  const clearAll = () => {
    setSelectedYears([]);
    setSelectedStatus([]);
    setSelectedTypes([]);
    setActiveState(null);
    applyFilter([], [], [], null);
    if (map.current) {
      map.current.flyTo({ center: [8.6753, 9.0820], zoom: 5.5 });
    }
  };

  const activeFilterCount = selectedYears.length + selectedStatus.length + selectedTypes.length;

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [8.6753, 9.0820],
      zoom: 5.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {

      // States
      map.current.addSource('states', {
        type: 'geojson',
        data: require('../data/nigeria-states.geojson'),
      });
      map.current.addLayer({
        id: 'state-fill',
        type: 'fill',
        source: 'states',
        paint: { 'fill-color': '#088', 'fill-opacity': 0.08 },
      });
      map.current.addLayer({
        id: 'state-fill-hover',
        type: 'fill',
        source: 'states',
        paint: { 'fill-color': '#088', 'fill-opacity': 0.25 },
        filter: ['==', 'shapeName', ''],
      });
      map.current.addLayer({
        id: 'state-border',
        type: 'line',
        source: 'states',
        paint: { 'line-color': '#333', 'line-width': 1 },
      });

      // Projects
      map.current.addSource('projects', {
        type: 'geojson',
        data: require('../data/projects-final.geojson'),
      });
      map.current.addLayer({
        id: 'project-points',
        type: 'circle',
        source: 'projects',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 7],
          'circle-color': [
            'match', ['get', 'status'],
            'COMPLETED',       '#2ecc71',
            'ONGOING',         '#f39c12',
            'YET TO MOBILIZE', '#E63946',
            '#95a5a6',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      });

      // Initial count
      setTimeout(() => {
        const all = map.current.queryRenderedFeatures({ layers: ['project-points'] });
        setPointCount(all.length);
      }, 500);

      // ── State hover ──
      map.current.on('mousemove', 'state-fill', (e) => {
        map.current.setFilter('state-fill-hover', [
          '==', 'shapeName', e.features[0].properties.shapeName,
        ]);
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'state-fill', () => {
        map.current.setFilter('state-fill-hover', ['==', 'shapeName', '']);
        map.current.getCanvas().style.cursor = '';
      });

      // ── State click ──
      map.current.on('click', 'state-fill', (e) => {
        const feature  = e.features[0];
        const stateName = feature.properties.shapeName.toUpperCase();
        setActiveState(stateName);
        map.current.fitBounds(turf.bbox(feature), { padding: 40 });
        // Use current filter state values via closure workaround
        setSelectedYears(y => {
          setSelectedStatus(s => {
            setSelectedTypes(t => {
              applyFilter(y, s, t, stateName);
              return t;
            });
            return s;
          });
          return y;
        });
      });

      // ── Click empty → clear state filter ──
      map.current.on('click', (e) => {
        const hits = map.current.queryRenderedFeatures(e.point, {
          layers: ['state-fill', 'project-points'],
        });
        if (!hits.length) {
          setActiveState(null);
          setSelectedYears(y => {
            setSelectedStatus(s => {
              setSelectedTypes(t => {
                applyFilter(y, s, t, null);
                return t;
              });
              return s;
            });
            return y;
          });
        }
      });

      // ── Point popup ──
      map.current.on('click', 'project-points', (e) => {
        const p = e.features[0].properties;
        const color = STATUS_COLORS[p.status] || '#95a5a6';
        new mapboxgl.Popup({ maxWidth: '320px', offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6;padding:4px 2px">
              <div style="font-size:14px;font-weight:700;margin-bottom:6px;color:#111">
                ${p.title}
              </div>
              <hr style="margin:6px 0;border:none;border-top:1px solid #eee"/>
              <span style="background:${color};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">
                ${p.status || 'UNKNOWN'}
              </span>
              <div style="margin-top:10px;display:grid;grid-template-columns:16px 1fr;gap:4px 8px;align-items:start;color:#444">
                <span>📍</span><span>${p.location || '—'}, ${p.state}</span>
                <span>🔧</span><span>${p.type || '—'}</span>
                <span>🏗</span><span>${p.contractor || 'N/A'}</span>
                <span>📅</span><span>${p.year}</span>
                <span>🔢</span><span>Lot: ${p.lot || '—'}</span>
              </div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'project-points', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'project-points', () => {
        map.current.getCanvas().style.cursor = '';
      });
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>
      <div ref={mapContainer} style={{ height: '100%' }} />

      {/* ── Filter toggle button ── */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        style={{
          position: 'absolute', top: 16, left: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid #ddd',
          borderRadius: 8, padding: '9px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          color: '#222',
          zIndex: 10,
        }}
      >
        <span>⚙ Filters</span>
        {activeFilterCount > 0 && (
          <span style={{
            background: '#E63946', color: '#fff',
            borderRadius: 10, padding: '1px 7px', fontSize: 11,
          }}>
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* ── Point count badge ── */}
      {pointCount !== null && (
        <div style={{
          position: 'absolute', top: 16, left: 130,
          background: '#fff', border: '1px solid #ddd',
          borderRadius: 8, padding: '9px 14px',
          fontSize: 13, color: '#444',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 10,
        }}>
          <strong style={{ color: '#111' }}>{pointCount.toLocaleString()}</strong> projects visible
          {activeState && (
            <span style={{ color: '#888', marginLeft: 6 }}>
              · {activeState.replace('ABUJA FEDERAL CAPITAL TERRITORY', 'FCT')}
            </span>
          )}
        </div>
      )}

      {/* ── Filter panel ── */}
      {panelOpen && (
        <div style={{
          position: 'absolute', top: 60, left: 16,
          width: 300, maxHeight: 'calc(100vh - 100px)',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          overflowY: 'auto', zIndex: 10,
          padding: '16px 18px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Filter Projects</span>
            <button
              onClick={clearAll}
              style={{
                background: 'none', border: '1px solid #ddd',
                borderRadius: 6, padding: '3px 10px',
                fontSize: 11, cursor: 'pointer', color: '#666',
              }}
            >
              Clear all
            </button>
          </div>

          {/* Active state indicator */}
          {activeState && (
            <div style={{
              background: '#f0faf4', border: '1px solid #2ecc71',
              borderRadius: 8, padding: '6px 10px',
              fontSize: 12, color: '#1a7a42', marginBottom: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📍 {activeState.replace('ABUJA FEDERAL CAPITAL TERRITORY', 'FCT')}</span>
              <button
                onClick={() => {
                  setActiveState(null);
                  applyFilter(selectedYears, selectedStatus, selectedTypes, null);
                  map.current.flyTo({ center: [8.6753, 9.0820], zoom: 5.5 });
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Year filter */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
              Year
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {YEARS.map(y => (
                <Chip
                  key={y} label={y} active={selectedYears.includes(y)}
                  color="#4a90d9" onClick={() => toggleYear(y)}
                />
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
              Status
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map(s => (
                <Chip
                  key={s} label={s} active={selectedStatus.includes(s)}
                  color={STATUS_COLORS[s]} onClick={() => toggleStatus(s)}
                />
              ))}
            </div>
          </div>

          {/* Project type filter */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
              Project Type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TYPES.map(t => (
                <Chip
                  key={t} label={t} active={selectedTypes.includes(t)}
                  color="#7c4dff" onClick={() => toggleType(t)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 30, left: 16,
        background: '#fff', padding: '10px 14px',
        borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        fontSize: 12, lineHeight: 2, zIndex: 10,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 2, color: '#111' }}>Project Status</div>
        {Object.entries(STATUS_COLORS).map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color, fontSize: 18, lineHeight: 1 }}>●</span>
            <span style={{ color: '#444', textTransform: 'capitalize' }}>
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectMap;