import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

// ── Constants ─────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'coverage',    label: '📊 Coverage' },
  { id: 'performance', label: '🎯 Performance' },
  { id: 'technology',  label: '⚡ Technology' },
];

const YEARS    = ['2019','2020','2021','2022','2023','2024','2025'];
const STATUSES = ['COMPLETED','ONGOING','YET TO MOBILIZE'];
const TYPES    = [
  'GRID','SOLAR STREET LIGHT','SOLAR MINI GRID','SOLAR HOME SYSTEM',
  'SOLAR BOREHOLE','SOLAR WATER PUMP','SOLAR PUMPING MACHINE',
  'SOLAR IRRIGATION PUMP','INJECTION SUBSTATION','TRAINING',
  'ELECTRIC VEHICLE','COUNTERPART FUNDING','VEHICLE PURCHASE','HQRTS',
  'GRID/SOLAR STREET LIGHT','GRID/SOLAR HOME SYSTEM','GRID/SOLAR MINI GRID',
  'SOLAR MINI GRID/SOLAR STREET LIGHT','SOLAR STREET LIGHT/SOLAR HOME SYSTEM',
];

const STATUS_COLORS = {
  'COMPLETED':       '#2ecc71',
  'ONGOING':         '#f39c12',
  'YET TO MOBILIZE': '#E63946',
  '':                '#333333',
};

const TECH_COLORS = {
  'SOLAR STREET LIGHT': '#f39c12',
  'GRID':               '#E63946',
  'SOLAR MINI GRID':    '#3498db',
  'SOLAR HOME SYSTEM':  '#9b59b6',
  'OTHER':              '#95a5a6',
};

const pct = (num, total) => total ? Math.round((num / total) * 100) : 0;

// ── Mini SVG Pie Chart ────────────────────────────────────────────────────────
const PieChart = ({ data, size = 120 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const r = size / 2 - 4;
  const cx = size / 2, cy = size / 2;
  let cumAngle = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, color: d.color };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5} />)}
    </svg>
  );
};

// ── Chip ──────────────────────────────────────────────────────────────────────
const Chip = ({ label, active, color, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', border: '1.5px solid',
    borderColor: active ? color : '#ddd',
    background: active ? color : '#fff',
    color: active ? '#fff' : '#555',
    transition: 'all 0.15s ease', whiteSpace: 'nowrap',
  }}>
    {label}
  </button>
);

// ── StatBox ───────────────────────────────────────────────────────────────────
const StatBox = ({ label, value, color }) => (
  <div style={{
    flex: 1, background: '#f8f9fa', borderRadius: 8,
    padding: '10px 12px', textAlign: 'center',
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const ProjectMap = () => {
  const mapContainer = useRef(null);
  const map          = useRef(null);

  const [view,           setView]           = useState('performance');
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [selectedYears,  setSelectedYears]  = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [activeState,    setActiveState]    = useState(null);
  const [stateData,      setStateData]      = useState(null);
  const [pointCount,     setPointCount]     = useState(null);
  const [mapReady,       setMapReady]       = useState(false);

  // ── Apply point filter ───────────────────────────────────────────────────
  const applyFilter = useCallback((years, statuses, types, stateName) => {
    if (!map.current || !map.current.getLayer('project-points')) return;
    const conditions = [];
    if (stateName)       conditions.push(['==', ['get', 'state'], stateName]);
    if (years.length)    conditions.push(['in', ['get', 'year'],   ['literal', years]]);
    if (statuses.length) conditions.push(['in', ['get', 'status'], ['literal', statuses]]);
    if (types.length)    conditions.push(['in', ['get', 'type'],   ['literal', types]]);
    const filter = conditions.length === 0 ? null
      : conditions.length === 1 ? conditions[0]
      : ['all', ...conditions];
    map.current.setFilter('project-points', filter);
    setTimeout(() => {
      const visible = map.current.queryRenderedFeatures({ layers: ['project-points'] });
      setPointCount(visible.length);
    }, 300);
  }, []);

  // ── Switch view ──────────────────────────────────────────────────────────
  const switchView = useCallback((newView) => {
    if (!map.current || !mapReady) return;
    setView(newView);
    setActiveState(null);
    setStateData(null);

    const isCov  = newView === 'coverage';
    const isPerf = newView === 'performance';
    const isTech = newView === 'technology';

    map.current.setLayoutProperty('project-points',   'visibility', isCov ? 'none' : 'visible');
    map.current.setLayoutProperty('state-choropleth', 'visibility', isCov ? 'visible' : 'none');
    map.current.setPaintProperty('state-fill', 'fill-opacity', isCov ? 0 : 0.08);

    if (isPerf) {
      map.current.setPaintProperty('project-points', 'circle-color', [
        'match', ['get', 'status'],
        'COMPLETED',       '#2ecc71',
        'ONGOING',         '#f39c12',
        'YET TO MOBILIZE', '#E63946',
        '#333333',
      ]);
    }
    if (isTech) {
      map.current.setPaintProperty('project-points', 'circle-color', [
        'case',
        ['all', ['in', 'SOLAR STREET LIGHT', ['get', 'type']], ['!', ['in', 'MINI GRID', ['get', 'type']]]], '#f39c12',
        ['in', 'MINI GRID',  ['get', 'type']], '#3498db',
        ['in', 'SOLAR HOME', ['get', 'type']], '#9b59b6',
        ['in', 'GRID',       ['get', 'type']], '#E63946',
        '#95a5a6',
      ]);
    }
  }, [mapReady]);

  // ── Filter toggle helpers ────────────────────────────────────────────────
  const toggleYear = (y) => {
    const next = selectedYears.includes(y) ? selectedYears.filter(v => v !== y) : [...selectedYears, y];
    setSelectedYears(next);
    applyFilter(next, selectedStatus, selectedTypes, activeState);
  };
  const toggleStatus = (s) => {
    const next = selectedStatus.includes(s) ? selectedStatus.filter(v => v !== s) : [...selectedStatus, s];
    setSelectedStatus(next);
    applyFilter(selectedYears, next, selectedTypes, activeState);
  };
  const toggleType = (t) => {
    const next = selectedTypes.includes(t) ? selectedTypes.filter(v => v !== t) : [...selectedTypes, t];
    setSelectedTypes(next);
    applyFilter(selectedYears, selectedStatus, next, activeState);
  };
  const clearAll = () => {
    setSelectedYears([]); setSelectedStatus([]); setSelectedTypes([]);
    setActiveState(null); setStateData(null);
    applyFilter([], [], [], null);
    map.current?.flyTo({ center: [8.6753, 9.0820], zoom: 5.5 });
  };

  const activeFilterCount = selectedYears.length + selectedStatus.length + selectedTypes.length;

  // ── Map init ─────────────────────────────────────────────────────────────
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

      // States (enriched with stats)
      map.current.addSource('states', {
        type: 'geojson',
        data: require('../data/nigeria-states-enriched.geojson'),
      });

      // Choropleth layer (Coverage view)
      map.current.addLayer({
        id: 'state-choropleth',
        type: 'fill',
        source: 'states',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'total'],
            0,   '#f0f0f0',
            40,  '#c8e6c9',
            80,  '#81c784',
            120, '#388e3c',
            160, '#1b5e20',
          ],
          'fill-opacity': 0.85,
        },
      });

      // Base fill (Performance / Technology views)
      map.current.addLayer({
        id: 'state-fill',
        type: 'fill',
        source: 'states',
        paint: { 'fill-color': '#088', 'fill-opacity': 0.08 },
      });

      // Hover highlight
      map.current.addLayer({
        id: 'state-fill-hover',
        type: 'fill',
        source: 'states',
        paint: { 'fill-color': '#088', 'fill-opacity': 0.3 },
        filter: ['==', 'shapeName', ''],
      });

      map.current.addLayer({
        id: 'state-border',
        type: 'line',
        source: 'states',
        paint: { 'line-color': '#555', 'line-width': 0.8 },
      });

      // Projects points
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
            '#333333',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      });

      setTimeout(() => {
        const all = map.current.queryRenderedFeatures({ layers: ['project-points'] });
        setPointCount(all.length);
        setMapReady(true);
      }, 500);

      // Hover handlers
      ['state-fill', 'state-choropleth'].forEach(layer => {
        map.current.on('mousemove', layer, (e) => {
          map.current.setFilter('state-fill-hover', ['==', 'shapeName', e.features[0].properties.shapeName]);
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', layer, () => {
          map.current.setFilter('state-fill-hover', ['==', 'shapeName', '']);
          map.current.getCanvas().style.cursor = '';
        });
      });

      // State click
      const handleStateClick = (e) => {
        const feature   = e.features[0];
        const props     = feature.properties;
        const stateName = props.shapeName.toUpperCase();
        setActiveState(stateName);
        setStateData(props);
        map.current.fitBounds(turf.bbox(feature), { padding: 40 });
        setSelectedYears(y => {
          setSelectedStatus(s => {
            setSelectedTypes(t => { applyFilter(y, s, t, stateName); return t; });
            return s;
          });
          return y;
        });
      };

      map.current.on('click', 'state-fill',       handleStateClick);
      map.current.on('click', 'state-choropleth', handleStateClick);

      // Click empty area
      map.current.on('click', (e) => {
        const hits = map.current.queryRenderedFeatures(e.point, {
          layers: ['state-fill', 'state-choropleth', 'project-points'],
        });
        if (!hits.length) {
          setActiveState(null); setStateData(null);
          setSelectedYears(y => {
            setSelectedStatus(s => {
              setSelectedTypes(t => { applyFilter(y, s, t, null); return t; });
              return s;
            });
            return y;
          });
        }
      });

      // Point popup
      map.current.on('click', 'project-points', (e) => {
        const p = e.features[0].properties;
        const color = STATUS_COLORS[p.status] || '#95a5a6';
        new mapboxgl.Popup({ maxWidth: '320px', offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.6;padding:4px 2px">
              <div style="font-size:14px;font-weight:700;margin-bottom:6px;color:#111">${p.title}</div>
              <hr style="margin:6px 0;border:none;border-top:1px solid #eee"/>
              <span style="background:${color};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">
                ${p.status || 'UNKNOWN'}
              </span>
              <div style="margin-top:10px;display:grid;grid-template-columns:16px 1fr;gap:4px 8px;color:#444">
                <span>📍</span><span>${p.location || '—'}, ${p.state}</span>
                <span>🔧</span><span>${p.type || '—'}</span>
                <span>🏗</span><span>${p.contractor || 'N/A'}</span>
                <span>📅</span><span>${p.year}</span>
              </div>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'project-points', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'project-points', () => { map.current.getCanvas().style.cursor = ''; });
    });
  }, [applyFilter]);

  // ── Side Panel Content ───────────────────────────────────────────────────
  const renderSidePanel = () => {
    if (!activeState || !stateData) return null;
    const d = stateData;
    const displayName = activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT – Abuja' : activeState;

    if (view === 'coverage') return (
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#111' }}>{displayName}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <StatBox label="Total Projects" value={d.total}               color="#388e3c" />
          <StatBox label="% Completed"    value={`${d.pct_completed}%`} color="#2ecc71" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatBox label="Completed"       value={d.completed}       color="#2ecc71" />
          <StatBox label="Ongoing"         value={d.ongoing}         color="#f39c12" />
          <StatBox label="Yet to Mobilize" value={d.yet_to_mobilize} color="#E63946" />
        </div>
      </div>
    );

    if (view === 'technology') {
      const techData = [
        { label: 'Solar Street Light', value: Number(d.solar_street_light), color: TECH_COLORS['SOLAR STREET LIGHT'] },
        { label: 'Grid Extension',     value: Number(d.grid),               color: TECH_COLORS['GRID'] },
        { label: 'Solar Mini Grid',    value: Number(d.solar_mini_grid),    color: TECH_COLORS['SOLAR MINI GRID'] },
        { label: 'Solar Home System',  value: Number(d.solar_home_system),  color: TECH_COLORS['SOLAR HOME SYSTEM'] },
        { label: 'Other',              value: Number(d.other_type),         color: TECH_COLORS['OTHER'] },
      ];
      return (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#111' }}>{displayName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <PieChart data={techData} size={110} />
            <div style={{ flex: 1 }}>
              {techData.map(td => (
                <div key={td.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: td.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#444' }}>{td.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#111', marginLeft: 8 }}>
                    {pct(td.value, d.total)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 8 }}>
            {d.total} total projects in this state
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Legend per view ──────────────────────────────────────────────────────
  const renderLegend = () => {
    if (view === 'coverage') return (
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#111', fontSize: 12 }}>Projects per State</div>
        {[['#1b5e20','120+ (High)'],['#388e3c','80–120'],['#81c784','40–80'],['#c8e6c9','Under 40'],['#f0f0f0','None']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: c, display: 'inline-block', border: '1px solid #ccc', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#444' }}>{l}</span>
          </div>
        ))}
      </div>
    );
    if (view === 'performance') return (
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#111', fontSize: 12 }}>Project Status</div>
        {[['#2ecc71','Completed'],['#f39c12','Ongoing'],['#E63946','Yet to Mobilize'],['#333333','Other']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ color: c, fontSize: 18, lineHeight: 1 }}>●</span>
            <span style={{ fontSize: 11, color: '#444' }}>{l}</span>
          </div>
        ))}
      </div>
    );
    if (view === 'technology') return (
      <div>
        <div style={{ fontWeight: 700, marginBottom: 8, color: '#111', fontSize: 12 }}>Technology Type</div>
        {Object.entries(TECH_COLORS).map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ color, fontSize: 18, lineHeight: 1 }}>●</span>
            <span style={{ fontSize: 11, color: '#444' }}>{label}</span>
          </div>
        ))}
      </div>
    );
  };

  const showSidePanel = activeState && stateData && view !== 'performance';

  return (
    <div style={{ position: 'relative', height: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>
      <div ref={mapContainer} style={{ height: '100%' }} />

      {/* ── View Toggle Bar ── */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', background: '#fff', borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e0e0e0', overflow: 'hidden', zIndex: 10,
      }}>
        {VIEWS.map((v, i) => (
          <button key={v.id} onClick={() => switchView(v.id)} style={{
            padding: '10px 20px', border: 'none',
            borderRight: i < VIEWS.length - 1 ? '1px solid #e0e0e0' : 'none',
            background: view === v.id ? '#1a1a2e' : '#fff',
            color: view === v.id ? '#fff' : '#555',
            fontWeight: view === v.id ? 700 : 500,
            fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Filter Button + Count Badge ── */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8, zIndex: 10 }}>
        <button onClick={() => setPanelOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid #ddd', borderRadius: 8,
          padding: '9px 14px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#222',
        }}>
          ⚙ Filters
          {activeFilterCount > 0 && (
            <span style={{ background: '#E63946', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {pointCount !== null && view !== 'coverage' && (
          <div style={{
            background: '#fff', border: '1px solid #ddd', borderRadius: 8,
            padding: '9px 14px', fontSize: 13, color: '#444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <strong style={{ color: '#111' }}>{pointCount.toLocaleString()}</strong> projects
            {activeState && (
              <span style={{ color: '#888', marginLeft: 6 }}>
                · {activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT' : activeState}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Filter Panel ── */}
      {panelOpen && (
        <div style={{
          position: 'absolute', top: 60, left: 16, width: 300,
          maxHeight: 'calc(100vh - 100px)', background: '#fff', borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflowY: 'auto',
          zIndex: 10, padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Filter Projects</span>
            <button onClick={clearAll} style={{
              background: 'none', border: '1px solid #ddd', borderRadius: 6,
              padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: '#666',
            }}>Clear all</button>
          </div>

          {activeState && (
            <div style={{
              background: '#f0faf4', border: '1px solid #2ecc71', borderRadius: 8,
              padding: '6px 10px', fontSize: 12, color: '#1a7a42', marginBottom: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📍 {activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT – Abuja' : activeState}</span>
              <button onClick={() => {
                setActiveState(null); setStateData(null);
                applyFilter(selectedYears, selectedStatus, selectedTypes, null);
                map.current.flyTo({ center: [8.6753, 9.0820], zoom: 5.5 });
              }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}>✕</button>
            </div>
          )}

          {[
            { label: 'YEAR',         items: YEARS,    selected: selectedYears,  toggle: toggleYear,   color: '#4a90d9' },
            { label: 'STATUS',       items: STATUSES, selected: selectedStatus, toggle: toggleStatus, color: null },
            { label: 'PROJECT TYPE', items: TYPES,    selected: selectedTypes,  toggle: toggleType,   color: '#7c4dff' },
          ].map(({ label, items, selected, toggle, color }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(item => (
                  <Chip key={item} label={item} active={selected.includes(item)}
                    color={color || STATUS_COLORS[item] || '#888'}
                    onClick={() => toggle(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Side Panel (Coverage + Technology) ── */}
      {showSidePanel && (
        <div style={{
          position: 'absolute', top: 70, right: 16, width: 280,
          background: '#fff', borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', zIndex: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
              {view === 'coverage' ? 'Coverage Summary' : 'Technology Breakdown'}
            </span>
            <button onClick={() => { setActiveState(null); setStateData(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 16 }}>✕</button>
          </div>
          {renderSidePanel()}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        position: 'absolute', bottom: 30, left: 16, background: '#fff',
        padding: '12px 16px', borderRadius: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)', zIndex: 10,
      }}>
        {renderLegend()}
      </div>
    </div>
  );
};

export default ProjectMap;
