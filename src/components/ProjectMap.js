import React, { useEffect, useRef, useState, useCallback } from 'react';
import generateStateReport from '../utils/generateStateReport';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

/* ── Design tokens ────────────────────────────────────────────────────────── */
const REA_GREEN   = '#00843D';
const REA_DARK    = '#005C2B';
const ACCENT_GOLD = '#F5A623';
const SHADOW      = '0 8px 32px rgba(0,0,0,0.22)';

/* ── Theme definitions ────────────────────────────────────────────────────── */
const THEMES = {
  dark: {
    mapStyle:    'mapbox://styles/mapbox/dark-v11',
    glassBg:     'rgba(10,30,18,0.88)',
    glassBlur:   'blur(14px)',
    panelBorder: '1px solid rgba(0,180,80,0.18)',
    textPrimary: '#e8f5ee',
    textSecond:  '#7dcea0',
    textMuted:   '#3d7055',
    chipBorder:  '#1e4a32',
    chipText:    '#6aad86',
    divider:     'rgba(255,255,255,0.07)',
    pointStroke: 'rgba(255,255,255,0.20)',
  },
  light: {
    mapStyle:    'mapbox://styles/mapbox/light-v11',
    glassBg:     'rgba(255,255,255,0.92)',
    glassBlur:   'blur(12px)',
    panelBorder: '1px solid rgba(0,0,0,0.07)',
    textPrimary: '#111',
    textSecond:  REA_DARK,
    textMuted:   '#888',
    chipBorder:  '#e0e0e0',
    chipText:    '#666',
    divider:     '#f0f0f0',
    pointStroke: 'rgba(255,255,255,0.70)',
  },
};

/* ── Constants ────────────────────────────────────────────────────────────── */
const VIEWS = [
  { id: 'coverage',    label: 'COVERAGE',    icon: '◉' },
  { id: 'performance', label: 'PERFORMANCE', icon: '◈' },
  { id: 'technology',  label: 'TECHNOLOGY',  icon: '◆' },
];

/* ── Intelligence Mode: State energy data ─────────────────────────────────── */
/* Sources: Global Solar Atlas (GHI), World Bank/NESP Nigeria 2023 (access),  */
/* NPC 2023 projections (population)                                           */
const STATE_INTEL = {
  "Abia":{"ghi":4.52,"access_pct":71,"population":3.73,"rural_pct":68,"opportunity_score":12.4,"unelectrified_pop":1.08},
  "Adamawa":{"ghi":5.81,"access_pct":36,"population":4.25,"rural_pct":76,"opportunity_score":47.2,"unelectrified_pop":2.72},
  "Akwa Ibom":{"ghi":4.31,"access_pct":75,"population":5.98,"rural_pct":55,"opportunity_score":14.8,"unelectrified_pop":1.50},
  "Anambra":{"ghi":4.48,"access_pct":80,"population":7.08,"rural_pct":53,"opportunity_score":11.2,"unelectrified_pop":1.42},
  "Bauchi":{"ghi":6.02,"access_pct":28,"population":7.17,"rural_pct":82,"opportunity_score":72.1,"unelectrified_pop":5.16},
  "Bayelsa":{"ghi":4.22,"access_pct":58,"population":2.28,"rural_pct":70,"opportunity_score":10.3,"unelectrified_pop":0.96},
  "Benue":{"ghi":5.12,"access_pct":42,"population":6.53,"rural_pct":74,"opportunity_score":51.8,"unelectrified_pop":3.79},
  "Borno":{"ghi":6.38,"access_pct":22,"population":6.10,"rural_pct":79,"opportunity_score":74.8,"unelectrified_pop":4.76},
  "Cross River":{"ghi":4.41,"access_pct":52,"population":4.05,"rural_pct":72,"opportunity_score":25.6,"unelectrified_pop":1.94},
  "Delta":{"ghi":4.35,"access_pct":73,"population":5.66,"rural_pct":57,"opportunity_score":13.1,"unelectrified_pop":1.53},
  "Ebonyi":{"ghi":4.61,"access_pct":44,"population":3.11,"rural_pct":78,"opportunity_score":22.4,"unelectrified_pop":1.74},
  "Edo":{"ghi":4.44,"access_pct":76,"population":4.74,"rural_pct":54,"opportunity_score":10.9,"unelectrified_pop":1.14},
  "Ekiti":{"ghi":4.78,"access_pct":69,"population":3.35,"rural_pct":62,"opportunity_score":13.7,"unelectrified_pop":1.04},
  "Enugu":{"ghi":4.55,"access_pct":74,"population":4.56,"rural_pct":60,"opportunity_score":11.8,"unelectrified_pop":1.19},
  "Federal Capital Territory":{"ghi":5.53,"access_pct":85,"population":3.68,"rural_pct":38,"opportunity_score":8.2,"unelectrified_pop":0.55},
  "Gombe":{"ghi":5.94,"access_pct":31,"population":3.61,"rural_pct":75,"opportunity_score":44.6,"unelectrified_pop":2.49},
  "Imo":{"ghi":4.49,"access_pct":72,"population":5.43,"rural_pct":64,"opportunity_score":14.2,"unelectrified_pop":1.52},
  "Jigawa":{"ghi":6.21,"access_pct":19,"population":6.47,"rural_pct":88,"opportunity_score":78.0,"unelectrified_pop":5.24},
  "Kaduna":{"ghi":5.88,"access_pct":51,"population":9.33,"rural_pct":67,"opportunity_score":57.3,"unelectrified_pop":4.57},
  "Kano":{"ghi":6.14,"access_pct":48,"population":15.93,"rural_pct":58,"opportunity_score":88.8,"unelectrified_pop":8.28},
  "Katsina":{"ghi":6.28,"access_pct":23,"population":9.17,"rural_pct":84,"opportunity_score":89.7,"unelectrified_pop":7.06},
  "Kebbi":{"ghi":6.11,"access_pct":21,"population":5.59,"rural_pct":83,"opportunity_score":68.4,"unelectrified_pop":4.42},
  "Kogi":{"ghi":5.21,"access_pct":45,"population":4.47,"rural_pct":71,"opportunity_score":36.2,"unelectrified_pop":2.46},
  "Kwara":{"ghi":5.34,"access_pct":57,"population":3.44,"rural_pct":65,"opportunity_score":24.1,"unelectrified_pop":1.48},
  "Lagos":{"ghi":4.28,"access_pct":92,"population":15.93,"rural_pct":12,"opportunity_score":5.1,"unelectrified_pop":1.27},
  "Nasarawa":{"ghi":5.41,"access_pct":38,"population":2.78,"rural_pct":73,"opportunity_score":30.4,"unelectrified_pop":1.72},
  "Niger":{"ghi":5.67,"access_pct":29,"population":6.75,"rural_pct":80,"opportunity_score":64.9,"unelectrified_pop":4.79},
  "Ogun":{"ghi":4.51,"access_pct":77,"population":6.20,"rural_pct":48,"opportunity_score":10.4,"unelectrified_pop":1.43},
  "Ondo":{"ghi":4.62,"access_pct":66,"population":4.69,"rural_pct":58,"opportunity_score":17.6,"unelectrified_pop":1.59},
  "Osun":{"ghi":4.71,"access_pct":71,"population":4.94,"rural_pct":52,"opportunity_score":11.6,"unelectrified_pop":1.43},
  "Oyo":{"ghi":4.82,"access_pct":74,"population":8.54,"rural_pct":45,"opportunity_score":14.9,"unelectrified_pop":2.22},
  "Plateau":{"ghi":5.62,"access_pct":40,"population":4.72,"rural_pct":69,"opportunity_score":43.8,"unelectrified_pop":2.83},
  "Rivers":{"ghi":4.26,"access_pct":78,"population":7.89,"rural_pct":46,"opportunity_score":12.3,"unelectrified_pop":1.74},
  "Sokoto":{"ghi":6.33,"access_pct":17,"population":5.53,"rural_pct":86,"opportunity_score":74.9,"unelectrified_pop":4.59},
  "Taraba":{"ghi":5.44,"access_pct":27,"population":3.32,"rural_pct":81,"opportunity_score":45.7,"unelectrified_pop":2.42},
  "Yobe":{"ghi":6.29,"access_pct":20,"population":3.79,"rural_pct":85,"opportunity_score":61.3,"unelectrified_pop":3.03},
  "Zamfara":{"ghi":6.18,"access_pct":18,"population":4.51,"rural_pct":87,"opportunity_score":67.2,"unelectrified_pop":3.70},
};

/* Helper: match shapeName to STATE_INTEL key */
const getIntel = (shapeName) => {
  if (!shapeName) return null;
  if (STATE_INTEL[shapeName]) return STATE_INTEL[shapeName];
  // FCT alias
  if (shapeName === 'Federal Capital Territory') return STATE_INTEL['Federal Capital Territory'];
  return null;
};

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
  'COMPLETED':       '#00C48C',
  'ONGOING':         '#FFB800',
  'YET TO MOBILIZE': '#FF4757',
  '':                '#2F3542',
};

const pct = (n, t) => t ? Math.round((n / t) * 100) : 0;

const FONT_URL = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap";
const FontLink = () => <link href={FONT_URL} rel="stylesheet" />;

/* ── Icons ────────────────────────────────────────────────────────────────── */
const MoonIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
  </svg>
);
const SunIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1"  x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1"  y1="12" x2="3"  y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
  </svg>
);
/* ?? SVG Pie ???????????????????????????????????????????????????????????????? */
const PieChart = ({ data, size = 100 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const r = size / 2 - 6, cx = size / 2, cy = size / 2;
  let a = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
    a += sweep;
    const x2 = cx + r * Math.cos(a), y2 = cy + r * Math.sin(a);
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0},1 ${x2},${y2} Z`, color: d.color };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />)}
    </svg>
  );
};
/* ── StatCard ─────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, color, theme }) => (
  <div style={{
    flex: 1, borderRadius: 10, padding: '12px 10px', textAlign: 'center',
    background: `linear-gradient(135deg, ${color}22, ${color}08)`,
    border: `1px solid ${color}35`,
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '10px 10px 0 0' }} />
    <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3, fontFamily: "'Barlow', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
  </div>
);

/* ── Chip ─────────────────────────────────────────────────────────────────── */
const Chip = ({ label, active, color, theme, onClick }) => (
  <button onClick={onClick} style={{
    padding: '5px 11px', borderRadius: 6, fontSize: 10, fontWeight: 700,
    cursor: 'pointer',
    border: `1.5px solid ${active ? color : theme.chipBorder}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : theme.chipText,
    transition: 'all 0.15s', whiteSpace: 'nowrap',
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
    textTransform: 'uppercase',
  }}>
    {label}
  </button>
);

/* ── State geographic centroids for population circles ───────────────────── */
const STATE_CENTROIDS = {
  "Abia":[7.35,5.45],"Adamawa":[12.40,9.30],"Akwa Ibom":[7.85,4.90],
  "Anambra":[6.92,6.20],"Bauchi":[10.30,10.30],"Bayelsa":[6.08,4.77],
  "Benue":[8.75,7.47],"Borno":[13.15,11.80],"Cross River":[8.32,5.85],
  "Delta":[5.90,5.52],"Ebonyi":[8.07,6.27],"Edo":[5.60,6.54],
  "Ekiti":[5.22,7.72],"Enugu":[7.49,6.46],"Federal Capital Territory":[7.49,9.06],
  "Gombe":[11.17,10.28],"Imo":[7.07,5.48],"Jigawa":[9.55,12.18],
  "Kaduna":[7.72,10.52],"Kano":[8.52,12.00],"Katsina":[7.61,12.98],
  "Kebbi":[4.20,11.50],"Kogi":[6.74,7.80],"Kwara":[4.55,8.50],
  "Lagos":[3.38,6.58],"Nasarawa":[8.49,8.50],"Niger":[5.58,9.93],
  "Ogun":[3.35,7.00],"Ondo":[5.19,7.10],"Osun":[4.48,7.56],
  "Oyo":[3.93,8.16],"Plateau":[8.89,9.22],"Rivers":[7.01,4.85],
  "Sokoto":[5.25,13.07],"Taraba":[11.44,7.87],"Yobe":[11.83,12.29],
  "Zamfara":[6.24,12.12],
};

/* ── Main ─────────────────────────────────────────────────────────────────── */
const ProjectMap = () => {
  const mapContainer = useRef(null);
  const map          = useRef(null);

  const [isDark,         setIsDark]         = useState(true);
  const [view,           setView]           = useState('coverage');
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [selectedYears,  setSelectedYears]  = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [activeState,    setActiveState]    = useState(null);
  const [stateData,      setStateData]      = useState(null);
  const [pointCount,     setPointCount]     = useState(null);
  const [mapReady,       setMapReady]       = useState(false);
  const [sidePanelIn,    setSidePanelIn]    = useState(false);

  const theme = isDark ? THEMES.dark : THEMES.light;

  const [isHeatmap,    setIsHeatmap]    = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting,  setIsExporting]  = useState(false);

  // Intelligence mode
  const [mapMode,        setMapMode]        = useState('operations'); // 'operations' | 'intelligence'
  const [intelLayer,     setIntelLayer]     = useState('solar');      // 'solar' | 'access' | 'population' | 'opportunity'
  const [showGridLines,  setShowGridLines]  = useState(true);
  const [showPopCircles, setShowPopCircles] = useState(false);
  const [intelState,     setIntelState]     = useState(null);


  /* ── Recalculate choropleth live from filtered source features ── */
  const recalcChoropleth = useCallback((years, statuses, types, stateName) => {
    if (!map.current || !map.current.getSource('projects')) return;

    // querySourceFeatures pulls ALL tiles in source regardless of zoom/viewport
    const allFeatures = map.current.querySourceFeatures('projects');

    // Count per state after applying the same filters in JS
    const counts = {};
    allFeatures.forEach(f => {
      const p = f.properties;
      if (stateName    && p.state  !== stateName)       return;
      if (years.length    && !years.includes(p.year))   return;
      if (statuses.length && !statuses.includes(p.status)) return;
      if (types.length    && !types.includes(p.type))   return;
      counts[p.state] = (counts[p.state] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(counts), 1);

    // Build a match expression: ['match', stateExpr, state1, count1, ..., 0]
    const matchExpr = ['match', ['upcase', ['get', 'shapeName']]];
    Object.entries(counts).forEach(([state, count]) => {
      matchExpr.push(state, count);
    });
    matchExpr.push(0); // default for states with no matches

    if (map.current.getLayer('state-choropleth')) {
      map.current.setPaintProperty('state-choropleth', 'fill-color', [
        'interpolate', ['linear'], matchExpr,
        0,            '#c8e6c9',
        maxCount*0.2, '#66bb6a',
        maxCount*0.4, '#2e7d32',
        maxCount*0.7, '#1b5e20',
        maxCount,     '#0a3d17',
      ]);
    }
  }, []);

  /* ── Filter ── */
  const applyFilter = useCallback((years, statuses, types, stateName) => {
    if (!map.current || !map.current.getLayer('project-points')) return;
    const conds = [];
    if (stateName)       conds.push(['==', ['get', 'state'], stateName]);
    if (years.length)    conds.push(['in', ['get', 'year'],   ['literal', years]]);
    if (statuses.length) conds.push(['in', ['get', 'status'], ['literal', statuses]]);
    if (types.length)    conds.push(['in', ['get', 'type'],   ['literal', types]]);
    map.current.setFilter('project-points',
      conds.length === 0 ? null : conds.length === 1 ? conds[0] : ['all', ...conds]
    );
    setTimeout(() => {
      if (!map.current) return;
      setPointCount(map.current.queryRenderedFeatures({ layers: ['project-points'] }).length);
      // In coverage view, repaint choropleth to reflect filtered counts
      setView(v => {
        if (v === 'coverage') recalcChoropleth(years, statuses, types, stateName);
        return v;
      });
    }, 350);
  }, [recalcChoropleth]);

  /* ── Coverage fade: dim all states except selected ── */
  const applyCoverageFade = useCallback((stateName) => {
    if (!map.current) return;
    if (!map.current.getLayer('state-choropleth')) return;
    if (stateName) {
      map.current.setPaintProperty('state-choropleth', 'fill-opacity', [
        'case',
        ['==', ['upcase', ['get', 'shapeName']], stateName], 0.92,
        0.12,
      ]);
      map.current.setPaintProperty('state-border', 'line-opacity', [
        'case',
        ['==', ['upcase', ['get', 'shapeName']], stateName], 1.0,
        0.12,
      ]);
      map.current.setPaintProperty('state-border', 'line-width', [
        'case',
        ['==', ['upcase', ['get', 'shapeName']], stateName], 2.0,
        0.5,
      ]);
    } else {
      map.current.setPaintProperty('state-choropleth', 'fill-opacity', 0.82);
      map.current.setPaintProperty('state-border',    'line-opacity', 0.6);
      map.current.setPaintProperty('state-border',    'line-width',   0.9);
    }
  }, []);

  /* ── Add all layers (called on init and after style reload) ── */
  const addLayers = useCallback((pointStrokeColor) => {
    map.current.addSource('states', {
      type: 'geojson',
      data: require('../data/nigeria-states-enriched.geojson'),
    });
    map.current.addSource('projects', {
      type: 'geojson',
      data: require('../data/projects-final.geojson'),
    });
    map.current.addLayer({
      id: 'state-choropleth', type: 'fill', source: 'states',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'total'],
          0,'#c8e6c9', 40,'#66bb6a', 80,'#2e7d32', 120,'#1b5e20', 160,'#0a3d17'],
        'fill-opacity': 0.82,
      },
    });
    map.current.addLayer({
      id: 'state-fill', type: 'fill', source: 'states',
      paint: { 'fill-color': REA_GREEN, 'fill-opacity': 0.06 },
    });
    map.current.addLayer({
      id: 'state-hover', type: 'fill', source: 'states',
      paint: { 'fill-color': REA_GREEN, 'fill-opacity': 0.22 },
      filter: ['==', 'shapeName', ''],
    });
    map.current.addLayer({
      id: 'state-border', type: 'line', source: 'states',
      paint: { 'line-color': REA_GREEN, 'line-width': 0.9, 'line-opacity': 0.6 },
    });
    map.current.addLayer({
      id: 'state-border-active', type: 'line', source: 'states',
      paint: { 'line-color': ACCENT_GOLD, 'line-width': 2.5, 'line-opacity': 1 },
      filter: ['==', 'shapeName', ''],
    });
    // ── Intelligence: Grid lines ──
    map.current.addSource('grid-lines', {
      type: 'geojson',
      data: require('../data/nigeria-grid-lines.geojson'),
    });
    map.current.addLayer({
      id: 'grid-330kv', type: 'line', source: 'grid-lines',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      filter: ['==', ['get', 'voltage_kv'], 330],
      paint: {
        'line-color': '#FFB800',
        'line-width': ['interpolate',['linear'],['zoom'], 4,1.5, 8,3.0],
        'line-opacity': 0.9,
      },
    });
    map.current.addLayer({
      id: 'grid-132kv', type: 'line', source: 'grid-lines',
      layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
      filter: ['==', ['get', 'voltage_kv'], 132],
      paint: {
        'line-color': '#60A5FA',
        'line-width': ['interpolate',['linear'],['zoom'], 4,0.8, 8,1.8],
        'line-opacity': 0.75,
        'line-dasharray': [3, 2],
      },
    });

    // ── Intelligence: Population circles ──
    map.current.addSource('state-centroids', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: Object.entries(STATE_INTEL).map(([name, d]) => ({
          type: 'Feature',
          properties: { name, population: d.population, rural_pct: d.rural_pct, access_pct: d.access_pct },
          geometry: { type: 'Point', coordinates: STATE_CENTROIDS[name] || [8.0, 9.0] },
        })),
      },
    });
    map.current.addLayer({
      id: 'pop-circles', type: 'circle', source: 'state-centroids',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate',['linear'],['get','population'], 1,8, 5,18, 10,28, 16,38],
        'circle-color': '#A855F7',
        'circle-opacity': 0.55,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.8,
      },
    });

    // ── Intelligence: Irradiance choropleth ──
    map.current.addLayer({
      id: 'intel-choropleth', type: 'fill', source: 'states',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'match', ['get', 'shapeName'],
          ...Object.entries(STATE_INTEL).flatMap(([name, d]) => {
            const ghiColor = d.ghi < 4.5 ? '#FEF9C3'
              : d.ghi < 5.0 ? '#FDE68A'
              : d.ghi < 5.5 ? '#FBBF24'
              : d.ghi < 6.0 ? '#F59E0B'
              : d.ghi < 6.2 ? '#D97706'
              : '#B45309';
            return [name, ghiColor];
          }),
          '#E5E7EB',
        ],
        'fill-opacity': 0.82,
      },
    });
    map.current.addLayer({
      id: 'intel-border', type: 'line', source: 'states',
      layout: { visibility: 'none' },
      paint: { 'line-color': 'rgba(180,140,0,0.4)', 'line-width': 0.8 },
    });
    map.current.addLayer({
      id: 'intel-hover', type: 'fill', source: 'states',
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#fff', 'fill-opacity': 0.18 },
      filter: ['==','shapeName',''],
    });

    // ── Heatmap layer ──
    map.current.addLayer({
      id: 'project-heatmap', type: 'heatmap', source: 'projects',
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight':   ['interpolate',['linear'],['zoom'], 4,0.4, 8,1],
        'heatmap-intensity':['interpolate',['linear'],['zoom'], 4,0.6, 8,2],
        'heatmap-color': [
          'interpolate',['linear'],['heatmap-density'],
          0,   'rgba(0,84,61,0)',
          0.2, 'rgba(0,132,61,0.5)',
          0.4, 'rgba(76,175,80,0.7)',
          0.6, 'rgba(245,166,35,0.85)',
          0.8, 'rgba(255,71,87,0.9)',
          1,   'rgba(255,255,255,1)',
        ],
        'heatmap-radius':   ['interpolate',['linear'],['zoom'], 4,18, 8,30],
        'heatmap-opacity':  ['interpolate',['linear'],['zoom'], 6,0.9, 10,0.5],
      },
    });    
    // ── Points layer — always loaded (never visibility:none) so querySourceFeatures works ──
    map.current.addLayer({
      id: 'project-points', type: 'circle', source: 'projects',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          4, 1.8, 6, 3.0, 8, 4.5, 11, 7.0,
        ],
        'circle-color': ['match', ['get', 'status'],
          'COMPLETED','#00C48C', 'ONGOING','#FFB800', 'YET TO MOBILIZE','#FF4757', '#2F3542'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'],
          4, 0, 7, 0.6, 10, 1.4,
        ],
        'circle-stroke-color': pointStrokeColor,
        'circle-stroke-opacity': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
          4, 0.45, 6, 0.68, 9, 0.88,
        ],
        'circle-blur': ['interpolate', ['linear'], ['zoom'],
          4, 0.6, 7, 0.2, 10, 0,
        ],
      },
    });
  }, []);

  /* ── View switch ── */
  const switchView = useCallback((newView) => {
    if (!map.current || !mapReady) return;
    setView(newView);
    setActiveState(null); setStateData(null); setSidePanelIn(false);
    applyCoverageFade(null);
    if (map.current.getLayer('state-border-active')) {
      map.current.setFilter('state-border-active', ['==', 'shapeName', '']);
    }

    const isCov = newView === 'coverage';
    if (map.current.getLayer('project-points')) {
      // In coverage view keep layer loaded (for querySourceFeatures) but invisible
      map.current.setPaintProperty('project-points', 'circle-opacity',        isCov ? 0 : ['interpolate',['linear'],['zoom'],4,0.45,6,0.68,9,0.88]);
      map.current.setPaintProperty('project-points', 'circle-stroke-opacity', isCov ? 0 : 1);
    }
    if (map.current.getLayer('state-choropleth'))
      map.current.setLayoutProperty('state-choropleth', 'visibility', isCov ? 'visible' : 'none');
    if (map.current.getLayer('state-fill'))
      map.current.setPaintProperty('state-fill', 'fill-opacity', isCov ? 0 : 0.06);
    // On entering coverage, recalc choropleth with any active filters
    if (isCov) {
      setSelectedYears(y => { setSelectedStatus(s => { setSelectedTypes(t => {
        recalcChoropleth(y, s, t, null);
        return t; }); return s; }); return y;
      });
    }

    if (newView === 'performance' && map.current.getLayer('project-points')) {
      map.current.setPaintProperty('project-points', 'circle-color', [
        'match', ['get', 'status'],
        'COMPLETED','#00C48C', 'ONGOING','#FFB800', 'YET TO MOBILIZE','#FF4757', '#2F3542',
      ]);
    }
    if (newView === 'technology' && map.current.getLayer('project-points')) {
      map.current.setPaintProperty('project-points', 'circle-color', [
        'case',
        ['all', ['in', 'SOLAR STREET LIGHT', ['get', 'type']], ['!', ['in', 'MINI GRID', ['get', 'type']]]], '#FFB800',
        ['in', 'MINI GRID',  ['get', 'type']], '#1E90FF',
        ['in', 'SOLAR HOME', ['get', 'type']], '#A855F7',
        ['in', 'GRID',       ['get', 'type']], '#FF4757',
        '#778CA3',
      ]);
    }
  }, [mapReady, applyCoverageFade, recalcChoropleth]);

  /* ── Dark/light toggle ── */
  const toggleTheme = useCallback(() => {
    if (!map.current) return;
    const nextDark  = !isDark;
    const nextTheme = nextDark ? THEMES.dark : THEMES.light;
    setIsDark(nextDark);
    setMapReady(false);
    map.current.setStyle(nextTheme.mapStyle);
    map.current.once('style.load', () => {
      addLayers(nextTheme.pointStroke);
      // Restore current view
      setView(v => {
        const isCov = v === 'coverage';
        map.current.setPaintProperty('project-points', 'circle-opacity',        isCov ? 0 : ['interpolate',['linear'],['zoom'],4,0.45,6,0.68,9,0.88]);
        map.current.setPaintProperty('project-points', 'circle-stroke-opacity', isCov ? 0 : 1);
        map.current.setLayoutProperty('state-choropleth', 'visibility', isCov ? 'visible' : 'none');
        map.current.setPaintProperty('state-fill', 'fill-opacity', isCov ? 0 : 0.06);
        if (v === 'coverage') {
          setSelectedYears(y => { setSelectedStatus(s => { setSelectedTypes(t => {
            recalcChoropleth(y, s, t, null); return t; }); return s; }); return y;
          });
        }
        if (v === 'technology') {
          map.current.setPaintProperty('project-points', 'circle-color', [
            'case',
            ['all', ['in', 'SOLAR STREET LIGHT', ['get', 'type']], ['!', ['in', 'MINI GRID', ['get', 'type']]]], '#FFB800',
            ['in', 'MINI GRID',  ['get', 'type']], '#1E90FF',
            ['in', 'SOLAR HOME', ['get', 'type']], '#A855F7',
            ['in', 'GRID',       ['get', 'type']], '#FF4757',
            '#778CA3',
          ]);
        }
        return v;
      });
      setMapReady(true);
    });
  }, [isDark, addLayers, recalcChoropleth]);

  /* ── Heatmap toggle ── */
  const toggleHeatmap = useCallback(() => {
    if (!map.current || !mapReady) return;
    setIsHeatmap(prev => {
      const next = !prev;
      if (map.current.getLayer('project-heatmap'))
        map.current.setLayoutProperty('project-heatmap', 'visibility', next ? 'visible' : 'none');
      // In heatmap mode hide individual points
      if (map.current.getLayer('project-points')) {
        map.current.setPaintProperty('project-points', 'circle-opacity',
          next ? 0 : ['interpolate',['linear'],['zoom'],4,0.45,6,0.68,9,0.88]);
        map.current.setPaintProperty('project-points', 'circle-stroke-opacity', next ? 0 : 1);
      }
      return next;
    });
  }, [mapReady]);

  /* ── Fullscreen toggle ── */
  const toggleFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  /* ── Export map as PNG ── */
  const exportMap = useCallback(() => {
    if (!map.current || isExporting) return;
    setIsExporting(true);
    // Wait one frame so any pending renders finish
    map.current.once('idle', () => {
      try {
        const canvas = map.current.getCanvas();
        const link   = document.createElement('a');
        link.download = `REA-ProjectMap-${new Date().toISOString().slice(0,10)}.png`;
        link.href      = canvas.toDataURL('image/png');
        link.click();
      } catch(e) {
        alert('Export failed. Make sure preserveDrawingBuffer is enabled.');
      }
      setIsExporting(false);
    });
  }, [isExporting]);

  /* ── Generate state PDF report ── */
  const exportStatePDF = useCallback(() => {
    if (!stateData) return;
    const canvas = map.current ? map.current.getCanvas() : null;
    generateStateReport({
      stateData,
      mapCanvas: canvas,
      isDark,
    });
  }, [stateData, isDark]);

  /* ── Intelligence mode: switch layer ── */
  const switchIntelLayer = useCallback((layer) => {
    if (!map.current || !mapReady) return;
    setIntelLayer(layer);
    if (!map.current.getLayer('intel-choropleth')) return;

    // Build fill-color expression based on selected layer
    let fillExpr;
    if (layer === 'solar') {
      fillExpr = [
        'match', ['get','shapeName'],
        ...Object.entries(STATE_INTEL).flatMap(([name, d]) => {
          const c = d.ghi < 4.5 ? '#FEF9C3' : d.ghi < 5.0 ? '#FDE68A'
            : d.ghi < 5.5 ? '#FBBF24' : d.ghi < 6.0 ? '#F59E0B'
            : d.ghi < 6.2 ? '#D97706' : '#B45309';
          return [name, c];
        }),
        '#E5E7EB',
      ];
    } else if (layer === 'access') {
      fillExpr = [
        'match', ['get','shapeName'],
        ...Object.entries(STATE_INTEL).flatMap(([name, d]) => {
          const c = d.access_pct >= 80 ? '#166534' : d.access_pct >= 65 ? '#16A34A'
            : d.access_pct >= 50 ? '#4ADE80' : d.access_pct >= 35 ? '#FCA5A5'
            : d.access_pct >= 20 ? '#EF4444' : '#7F1D1D';
          return [name, c];
        }),
        '#E5E7EB',
      ];
    } else if (layer === 'population') {
      fillExpr = [
        'match', ['get','shapeName'],
        ...Object.entries(STATE_INTEL).flatMap(([name, d]) => {
          const c = d.population >= 12 ? '#1E3A5F' : d.population >= 8 ? '#1D4ED8'
            : d.population >= 5 ? '#3B82F6' : d.population >= 3 ? '#93C5FD'
            : '#DBEAFE';
          return [name, c];
        }),
        '#E5E7EB',
      ];
    } else if (layer === 'opportunity') {
      fillExpr = [
        'match', ['get','shapeName'],
        ...Object.entries(STATE_INTEL).flatMap(([name, d]) => {
          const c = d.opportunity_score >= 80 ? '#7F1D1D' : d.opportunity_score >= 60 ? '#DC2626'
            : d.opportunity_score >= 40 ? '#F97316' : d.opportunity_score >= 20 ? '#FCD34D'
            : '#D1FAE5';
          return [name, c];
        }),
        '#E5E7EB',
      ];
    }
    if (fillExpr) map.current.setPaintProperty('intel-choropleth', 'fill-color', fillExpr);
  }, [mapReady]);

  /* ── Intelligence mode: toggle grid lines ── */
  const toggleGridLines = useCallback((show) => {
    if (!map.current) return;
    setShowGridLines(show);
    ['grid-330kv','grid-132kv'].forEach(l => {
      if (map.current.getLayer(l))
        map.current.setLayoutProperty(l, 'visibility', show ? 'visible' : 'none');
    });
  }, []);

  /* ── Intelligence mode: toggle population circles ── */
  const togglePopCircles = useCallback((show) => {
    if (!map.current) return;
    setShowPopCircles(show);
    if (map.current.getLayer('pop-circles'))
      map.current.setLayoutProperty('pop-circles', 'visibility', show ? 'visible' : 'none');
  }, []);

  /* ── Switch between Operations and Intelligence modes ── */
  const switchMapMode = useCallback((mode) => {
    if (!map.current || !mapReady) return;
    setMapMode(mode);
    setIntelState(null);

    const intelLayers = ['intel-choropleth','intel-border','intel-hover','grid-330kv','grid-132kv','pop-circles'];
    const opsLayers   = ['state-choropleth','state-fill','state-hover','state-border','state-border-active','project-points','project-heatmap'];

    if (mode === 'intelligence') {
      // Hide ops layers
      opsLayers.forEach(l => {
        if (!map.current.getLayer(l)) return;
        if (['project-points','project-heatmap'].includes(l))
          map.current.setPaintProperty(l, 'circle-opacity', 0);
        else
          map.current.setLayoutProperty(l, 'visibility', 'none');
      });
      // Show intel layers
      ['intel-choropleth','intel-border','intel-hover'].forEach(l => {
        if (map.current.getLayer(l)) map.current.setLayoutProperty(l, 'visibility', 'visible');
      });
      if (showGridLines) ['grid-330kv','grid-132kv'].forEach(l => {
        if (map.current.getLayer(l)) map.current.setLayoutProperty(l, 'visibility', 'visible');
      });
      if (showPopCircles && map.current.getLayer('pop-circles'))
        map.current.setLayoutProperty('pop-circles', 'visibility', 'visible');
      // Trigger layer paint for current intel layer
      setTimeout(() => switchIntelLayer(intelLayer), 100);

      // Add intel hover + click handlers if not yet added
      if (!map.current._intelHandlersAdded) {
        map.current.on('mousemove', 'intel-choropleth', (e) => {
          map.current.setFilter('intel-hover', ['==','shapeName', e.features[0].properties.shapeName]);
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'intel-choropleth', () => {
          map.current.setFilter('intel-hover', ['==','shapeName','']);
          map.current.getCanvas().style.cursor = '';
        });
        map.current.on('click', 'intel-choropleth', (e) => {
          const name = e.features[0].properties.shapeName;
          setIntelState(name);
        });
        map.current._intelHandlersAdded = true;
      }
    } else {
      // Back to operations
      intelLayers.forEach(l => {
        if (map.current.getLayer(l)) map.current.setLayoutProperty(l, 'visibility', 'none');
      });
      // Restore ops layers
      ['state-fill','state-border','state-border-active'].forEach(l => {
        if (map.current.getLayer(l)) map.current.setLayoutProperty(l, 'visibility', 'visible');
      });
      // Restore current view
      setView(v => {
        const isCov = v === 'coverage';
        if (map.current.getLayer('state-choropleth'))
          map.current.setLayoutProperty('state-choropleth', 'visibility', isCov ? 'visible' : 'none');
        if (map.current.getLayer('project-points')) {
          map.current.setPaintProperty('project-points', 'circle-opacity',
            isCov ? 0 : ['interpolate',['linear'],['zoom'],4,0.45,6,0.68,9,0.88]);
          map.current.setPaintProperty('project-points', 'circle-stroke-opacity', isCov ? 0 : 1);
        }
        return v;
      });
    }
  }, [mapReady, showGridLines, showPopCircles, intelLayer, switchIntelLayer]);


  /* ── Escape key to deselect ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setActiveState(null); setStateData(null); setSidePanelIn(false);
        setPanelOpen(false);
        if (map.current) {
          map.current.setFilter('state-border-active', ['==','shapeName','']);
          applyCoverageFade(null);
        }
        setSelectedYears(y => {
          setSelectedStatus(s => {
            setSelectedTypes(t => { applyFilter(y,s,t,null); return t; });
            return s;
          });
          return y;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyFilter, applyCoverageFade]);

  const toggleYear   = (y) => { const n = selectedYears.includes(y)   ? selectedYears.filter(v=>v!==y)   : [...selectedYears,y];   setSelectedYears(n);   applyFilter(n, selectedStatus, selectedTypes, activeState); };
  const toggleStatus = (s) => { const n = selectedStatus.includes(s)  ? selectedStatus.filter(v=>v!==s)  : [...selectedStatus,s];  setSelectedStatus(n);  applyFilter(selectedYears, n, selectedTypes, activeState); };
  const toggleType   = (t) => { const n = selectedTypes.includes(t)   ? selectedTypes.filter(v=>v!==t)   : [...selectedTypes,t];   setSelectedTypes(n);   applyFilter(selectedYears, selectedStatus, n, activeState); };

  const clearAll = () => {
    setSelectedYears([]); setSelectedStatus([]); setSelectedTypes([]);
    setActiveState(null); setStateData(null); setSidePanelIn(false);
    applyFilter([], [], [], null);
    applyCoverageFade(null);
    if (map.current) {
      map.current.setFilter('state-border-active', ['==', 'shapeName', '']);
      map.current.flyTo({ center: [8.6753, 9.0820], zoom: 5.8 });
    }
  };

  const activeFilterCount = selectedYears.length + selectedStatus.length + selectedTypes.length;

  /* ── Map init ── */
  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: THEMES.dark.mapStyle,
      center: [8.6753, 9.0820], zoom: 5.8,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.current.on('load', () => {
      addLayers(THEMES.dark.pointStroke);
      map.current.setLayoutProperty('state-choropleth', 'visibility', 'visible');
  map.current.setPaintProperty('project-points', 'circle-opacity', 0);
map.current.setPaintProperty('project-points', 'circle-stroke-opacity', 0);
map.current.setPaintProperty('state-fill', 'fill-opacity', 0);
      setTimeout(() => {
        setPointCount(map.current.queryRenderedFeatures({ layers: ['project-points'] }).length);
        setMapReady(true);
      }, 600);

      // Hover on states
      ['state-fill','state-choropleth'].forEach(l => {
        map.current.on('mousemove', l, (e) => {
          map.current.setFilter('state-hover', ['==', 'shapeName', e.features[0].properties.shapeName]);
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', l, () => {
          map.current.setFilter('state-hover', ['==', 'shapeName', '']);
          map.current.getCanvas().style.cursor = '';
        });
      });

      // State click
      const onStateClick = (e) => {
        const props     = e.features[0].properties;
        const stateName = props.shapeName.toUpperCase();
        setActiveState(stateName);
        setStateData(props);
        map.current.setFilter('state-border-active', ['==', 'shapeName', props.shapeName]);
        map.current.fitBounds(turf.bbox(e.features[0]), { padding: 60 });
        setTimeout(() => setSidePanelIn(true), 100);

        // Apply coverage fade when in coverage view
        setView(v => {
          if (v === 'coverage') applyCoverageFade(stateName);
          return v;
        });

        setSelectedYears(y => {
          setSelectedStatus(s => {
            setSelectedTypes(t => { applyFilter(y, s, t, stateName); return t; });
            return s;
          });
          return y;
        });
      };
      map.current.on('click', 'state-fill',       onStateClick);
      map.current.on('click', 'state-choropleth', onStateClick);

      // Click empty area — deselect
      map.current.on('click', (e) => {
        const hits = map.current.queryRenderedFeatures(e.point, {
          layers: ['state-fill','state-choropleth','project-points'],
        });
        if (!hits.length) {
          setActiveState(null); setStateData(null); setSidePanelIn(false);
          map.current.setFilter('state-border-active', ['==', 'shapeName', '']);
          applyCoverageFade(null);
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
        const c = STATUS_COLORS[p.status] || '#778CA3';
        new mapboxgl.Popup({ maxWidth: '300px', offset: 12, className: 'rea-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family:'Barlow',sans-serif;padding:4px 0">
              <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;color:#111;line-height:1.3;margin-bottom:8px">${p.title}</div>
              <span style="background:${c};color:#fff;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">${p.status || 'UNKNOWN'}</span>
              <div style="margin-top:10px;font-size:12px;color:#555;line-height:1.8">
                <div>📍 <strong>${p.location || '--'}</strong>, ${p.state}</div>
                <div>⚡ ${p.type || '--'}</div>
                <div>🏗 ${p.contractor || 'N/A'}</div>
                <div>📅 ${p.year}</div>
              </div>
            </div>
          `)
          .addTo(map.current);
      });
      map.current.on('mouseenter', 'project-points', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'project-points', () => { map.current.getCanvas().style.cursor = ''; });
    });
  }, [applyFilter, applyCoverageFade, addLayers]);

  /* ── Side panel content ── */
  const displayName = activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT - Abuja' : activeState;

  const renderSideContent = () => {
    if (!stateData) return null;
    const d = stateData;
    if (view === 'coverage') return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <StatCard label="Total Projects"  value={d.total}                color={REA_GREEN} theme={theme} />
          <StatCard label="Completion Rate" value={`${d.pct_completed}%`} color="#00C48C"  theme={theme} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCard label="Completed"       value={d.completed}       color="#00C48C" theme={theme} />
          <StatCard label="Ongoing"         value={d.ongoing}         color="#FFB800" theme={theme} />
          <StatCard label="Yet to Mobilize" value={d.yet_to_mobilize} color="#FF4757" theme={theme} />
        </div>
        <div style={{ marginTop: 14, height: 6, borderRadius: 10, background: theme.divider, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${d.pct_completed}%`, background: `linear-gradient(90deg, ${REA_GREEN}, #00C48C)`, borderRadius: 10, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, fontFamily: "'Barlow', sans-serif" }}>{d.pct_completed}% of projects completed</div>
      </div>
    );
    if (view === 'technology') {
      const techData = [
        { label: 'Solar Street Light', value: Number(d.solar_street_light), color: '#FFB800' },
        { label: 'Grid Extension',     value: Number(d.grid),               color: '#FF4757' },
        { label: 'Solar Mini Grid',    value: Number(d.solar_mini_grid),    color: '#1E90FF' },
        { label: 'Solar Home System',  value: Number(d.solar_home_system),  color: '#A855F7' },
        { label: 'Other',              value: Number(d.other_type),         color: '#778CA3' },
      ];
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <PieChart data={techData} size={100} />
            <div style={{ flex: 1 }}>
              {techData.map(td => (
                <div key={td.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: td.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: theme.textPrimary, fontFamily: "'Barlow', sans-serif" }}>{td.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: theme.textMuted, fontFamily: "'Barlow', sans-serif" }}>{td.value}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: td.color, fontFamily: "'Barlow Condensed', sans-serif", minWidth: 32, textAlign: 'right' }}>{pct(td.value, d.total)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: theme.textMuted, borderTop: `1px solid ${theme.divider}`, paddingTop: 10, fontFamily: "'Barlow', sans-serif" }}>
            {d.total} total projects
          </div>
        </div>
      );
    }
    return null;
  };

  /* ── Intelligence Legend ── */
  const renderIntelLegend = () => {
    if (intelLayer === 'solar') return (
      <>
        {[['#B45309','6.2+ kWh/m²/d'],['#D97706','6.0–6.2'],['#F59E0B','5.5–6.0'],['#FBBF24','5.0–5.5'],['#FDE68A','4.5–5.0'],['#FEF9C3','< 4.5']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:c, display:'inline-block', flexShrink:0 }} />
            <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>{l}</span>
          </div>
        ))}
      </>
    );
    if (intelLayer === 'access') return (
      <>
        {[['#166534','80%+'],['#16A34A','65–80%'],['#4ADE80','50–65%'],['#FCA5A5','35–50%'],['#EF4444','20–35%'],['#7F1D1D','< 20%']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:c, display:'inline-block', flexShrink:0 }} />
            <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>{l}</span>
          </div>
        ))}
      </>
    );
    if (intelLayer === 'population') return (
      <>
        {[['#1E3A5F','12M+'],['#1D4ED8','8–12M'],['#3B82F6','5–8M'],['#93C5FD','3–5M'],['#DBEAFE','< 3M']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:c, display:'inline-block', flexShrink:0 }} />
            <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>{l}</span>
          </div>
        ))}
      </>
    );
    if (intelLayer === 'opportunity') return (
      <>
        {[['#7F1D1D','Score 80+'],['#DC2626','60–80'],['#F97316','40–60'],['#FCD34D','20–40'],['#D1FAE5','0–20']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:c, display:'inline-block', flexShrink:0 }} />
            <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>{l}</span>
          </div>
        ))}
      </>
    );
    return null;
  };


  /* ── Legend ── */
  const renderLegend = () => {
    const entries = view === 'coverage'
      ? [['#0a3d17','120+ projects'],['#1b5e20','80-120'],['#2e7d32','40-80'],['#66bb6a','Under 40'],['#c8e6c9','0-few']]
      : view === 'performance'
      ? [['#00C48C','Completed'],['#FFB800','Ongoing'],['#FF4757','Yet to Mobilize'],['#2F3542','Other']]
      : [['#FFB800','Solar Street Light'],['#FF4757','Grid Extension'],['#1E90FF','Solar Mini Grid'],['#A855F7','Solar Home System'],['#778CA3','Other']];
    const isSquare = view === 'coverage';
    return entries.map(([color, label]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        {isSquare
          ? <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />
          : <span style={{ color, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>●</span>
        }
        <span style={{ fontSize: 11, color: theme.textPrimary, fontFamily: "'Barlow', sans-serif" }}>{label}</span>
      </div>
    ));
  };

  /* ── Intelligence side panel content ── */
  const renderIntelPanel = () => {
    const d = intelState ? getIntel(intelState) : null;

    // Ranked list of top opportunity states
    const ranked = Object.entries(STATE_INTEL)
      .sort((a,b) => b[1].opportunity_score - a[1].opportunity_score)
      .slice(0, 7);

    if (!d) return (
      <div>
        <div style={{ fontSize:11, color:theme.textMuted, marginBottom:14, fontFamily:"'Barlow',sans-serif" }}>
          Click any state to see its energy profile
        </div>
        <div style={{ fontSize:10, fontWeight:800, color:theme.textMuted, letterSpacing:1.5, marginBottom:10, textTransform:'uppercase', fontFamily:"'Barlow Condensed',sans-serif" }}>
          Top Opportunity States
        </div>
        {ranked.map(([sName, sd], i) => (
          <div key={sName} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:800, color: i===0?ACCENT_GOLD:i<3?REA_GREEN:theme.textMuted, fontFamily:"'Barlow Condensed',sans-serif", minWidth:16 }}>{i+1}</span>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>{sName === 'Federal Capital Territory' ? 'FCT' : sName}</span>
                <span style={{ fontSize:10, fontWeight:700, color:ACCENT_GOLD, fontFamily:"'Barlow Condensed',sans-serif" }}>{sd.opportunity_score}</span>
              </div>
              <div style={{ height:3, borderRadius:2, background:theme.divider, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${sd.opportunity_score}%`, background:`linear-gradient(90deg,${REA_GREEN},${ACCENT_GOLD})`, borderRadius:2 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            { label:'Solar GHI',  value:`${d.ghi} kWh/m²/d`, color:'#F59E0B' },
            { label:'Grid Access',value:`${d.access_pct}%`,   color:d.access_pct>=60?'#16A34A':'#EF4444' },
            { label:'Population', value:`${d.population}M`,   color:'#A855F7' },
            { label:'Rural Pop',  value:`${d.rural_pct}%`,    color:'#60A5FA' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ borderRadius:10, padding:'10px 8px', textAlign:'center', background:`${color}18`, border:`1px solid ${color}30`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2.5, background:color, borderRadius:'10px 10px 0 0' }} />
              <div style={{ fontSize:18, fontWeight:800, color, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1.1 }}>{value}</div>
              <div style={{ fontSize:9, color:theme.textMuted, marginTop:3, textTransform:'uppercase', letterSpacing:0.5, fontFamily:"'Barlow',sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif" }}>Without Electricity</span>
            <span style={{ fontSize:11, fontWeight:800, color:'#EF4444', fontFamily:"'Barlow Condensed',sans-serif" }}>{d.unelectrified_pop}M people</span>
          </div>
          <div style={{ height:5, borderRadius:3, background:theme.divider, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${100-d.access_pct}%`, background:'linear-gradient(90deg,#EF4444,#F97316)', borderRadius:3 }} />
          </div>
        </div>
        <div style={{ borderRadius:10, padding:'10px 12px', background:`${ACCENT_GOLD}15`, border:`1px solid ${ACCENT_GOLD}40`, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:ACCENT_GOLD, textTransform:'uppercase', letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif" }}>Opportunity Score</div>
            <div style={{ fontSize:10, color:theme.textMuted, fontFamily:"'Barlow',sans-serif" }}>Solar + Need + Rural</div>
          </div>
          <div style={{ fontSize:32, fontWeight:800, color:ACCENT_GOLD, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 }}>{d.opportunity_score}</div>
        </div>
        <div style={{ fontSize:10, color:theme.textMuted, fontFamily:"'Barlow',sans-serif", lineHeight:1.6 }}>
          {d.rural_pct}% rural pop · {d.opportunity_score >= 70 ? '🔴 High priority' : d.opportunity_score >= 40 ? '🟡 Medium' : '🟢 Lower priority'}
        </div>
      </div>
    );
  };

  const showSide = activeState && stateData && view !== 'performance';

  /* ── Shared glass panel style ── */
  const glass = (extra = {}) => ({
    background:           theme.glassBg,
    backdropFilter:       theme.glassBlur,
    WebkitBackdropFilter: theme.glassBlur,
    border:               theme.panelBorder,
    boxShadow:            SHADOW,
    ...extra,
  });

  return (
    <>
      <FontLink />
      <style>{`
        .mapboxgl-popup-content { border-radius:12px !important; padding:16px 18px !important; box-shadow:0 8px 32px rgba(0,0,0,0.2) !important; }
        .mapboxgl-popup-tip     { border-top-color:white !important; }
        .mapboxgl-ctrl-group    { border-radius:10px !important; overflow:hidden; box-shadow:${SHADOW} !important; }
        @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={{ position: 'relative', height: '100vh', fontFamily: "'Barlow', sans-serif" }}>
        <div ref={mapContainer} style={{ height: '100%' }} />
{/* ── REA Wordmark ── */}
        <div style={{ position:'absolute', top:16, right:16, zIndex:20, pointerEvents:'none' }}>
<img
  src="/realogo.PNG"
  alt="REA Logo"
  style={{ width: 60, height: 60, objectFit: 'contain' }}
/>
        </div>
        {/* ── View Selector ── */}
        <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)', zIndex:20, display:'flex', gap:6 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => switchView(v.id)} style={{
              padding:'8px 18px', borderRadius:8, cursor:'pointer',
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:12, letterSpacing:1, textTransform:'uppercase',
              background: view === v.id ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})` : theme.glassBg,
              color: view === v.id ? '#fff' : theme.chipText,
              backdropFilter: theme.glassBlur, WebkitBackdropFilter: theme.glassBlur,
              boxShadow: view === v.id ? `0 4px 16px ${REA_GREEN}55` : '0 2px 8px rgba(0,0,0,0.15)',
              border: view === v.id ? 'none' : theme.panelBorder,
              transition:'all 0.2s ease', display:'flex', alignItems:'center', gap:6,
            }}>
              <span style={{ fontSize:10 }}>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>

        {/* ── Top-left controls ── */}
        <div style={{ position:'absolute', top:16, left:16, zIndex:20, display:'flex', flexDirection:'column', gap:8 }}>
          {/* Filter toggle */}
          <button onClick={() => setPanelOpen(o => !o)} style={{
            ...glass({ borderRadius:10, width:42, height:42 }),
            background: panelOpen ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})` : theme.glassBg,
            border: 'none', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:17, color: panelOpen ? '#fff' : theme.textPrimary, position:'relative',
          }}>
            ⚙
            {activeFilterCount > 0 && (
              <span style={{ position:'absolute', top:-5, right:-5, background:ACCENT_GOLD, color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800 }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Point count */}
          {pointCount !== null && view !== 'coverage' && (
            <div style={{ ...glass({ borderRadius:10, padding:'8px 12px', animation:'fadeUp 0.3s ease' }) }}>
              <div style={{ fontSize:20, fontWeight:800, color:REA_GREEN, fontFamily:"'Barlow Condensed', sans-serif", lineHeight:1 }}>{pointCount.toLocaleString()}</div>
              <div style={{ fontSize:9, color:theme.textMuted, textTransform:'uppercase', letterSpacing:0.5 }}>
                {activeState ? (activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT' : activeState) : 'All States'}
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom-left toolbar: heatmap / fullscreen / export / theme ── */}
        <div style={{ position:'absolute', bottom:30, left:16, zIndex:20, display:'flex', flexDirection:'column', gap:8 }}>

          {/* Heatmap toggle */}
          <button onClick={toggleHeatmap} title="Toggle Heatmap"
            style={{
              ...glass({ borderRadius:10, width:42, height:42 }),
              background: isHeatmap ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})` : theme.glassBg,
              border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              color: isHeatmap ? '#fff' : theme.textPrimary, fontSize:18,
            }}>
            {/* flame icon */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C9 6 6 8 6 13a6 6 0 0012 0c0-3-1.5-5.5-3-7-0.5 2-1.5 3-3 3.5C13 8 12 5 12 2z"/>
            </svg>
          </button>

          {/* Export PNG */}
          <button onClick={exportMap} title="Export map as PNG"
            style={{
              ...glass({ borderRadius:10, width:42, height:42 }),
              border:'none', cursor: isExporting ? 'wait' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              color: theme.textPrimary, opacity: isExporting ? 0.5 : 1,
            }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

         {/* Fullscreen */}
          <button onClick={toggleFullscreen} title="Toggle Fullscreen"
            style={{
              ...glass({ borderRadius:10, width:42, height:42 }),
              background: isFullscreen ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})` : theme.glassBg,
              border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              color: isFullscreen ? '#fff' : theme.textPrimary,
            }}>
            {isFullscreen
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 3v3a2 2 0 01-2 2H3"/><path d="M21 8h-3a2 2 0 01-2-2V3"/><path d="M3 16h3a2 2 0 012 2v3"/><path d="M16 21v-3a2 2 0 012-2h3"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8V3h5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="M21 16v5h-5"/></svg>
            }
          </button>

          {/* Dark / Light toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              ...glass({ borderRadius:10, width:42, height:42 }),
              border: `1px solid ${isDark ? 'rgba(0,180,80,0.28)' : 'rgba(0,0,0,0.09)'}`,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              color: isDark ? '#4ade80' : '#666',
              transition:'all 0.25s ease',
            }}
          >
            {isDark ? <MoonIcon /> : <SunIcon />}
          </button>

        </div>

        {/* ── Filter Panel ── */}
        {panelOpen && (
          <div style={{
            ...glass({ borderRadius:14, padding:'16px', animation:'fadeUp 0.2s ease' }),
            position:'absolute', top:68, left:16, width:290,
            maxHeight:'calc(100vh - 120px)', overflowY:'auto', zIndex:20,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ fontWeight:800, fontSize:13, color:theme.textSecond, fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:0.5, textTransform:'uppercase' }}>Filter Projects</span>
              <button onClick={clearAll} style={{ background:'none', border:`1px solid ${REA_GREEN}50`, borderRadius:6, padding:'3px 10px', fontSize:10, cursor:'pointer', color:REA_GREEN, fontWeight:700, fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:0.5 }}>CLEAR ALL</button>
            </div>
            {activeState && (
              <div style={{ background:`${REA_GREEN}15`, border:`1px solid ${REA_GREEN}40`, borderRadius:8, padding:'7px 10px', fontSize:11, color:theme.textPrimary, marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:"'Barlow', sans-serif" }}>
                <span>📍 {activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT - Abuja' : activeState}</span>
                <button onClick={() => {
                  setActiveState(null); setStateData(null); setSidePanelIn(false);
                  map.current.setFilter('state-border-active', ['==','shapeName','']);
                  applyCoverageFade(null);
                  applyFilter(selectedYears, selectedStatus, selectedTypes, null);
                  map.current.flyTo({ center:[8.6753,9.0820], zoom:5.8 });
                }} style={{ background:'none', border:'none', cursor:'pointer', color:theme.textMuted, fontSize:14 }}>✕</button>
              </div>
            )}
            {[
              { label:'YEAR',         items:YEARS,    sel:selectedYears,  fn:toggleYear,   color:'#4a90d9' },
              { label:'STATUS',       items:STATUSES, sel:selectedStatus, fn:toggleStatus, color:null },
              { label:'PROJECT TYPE', items:TYPES,    sel:selectedTypes,  fn:toggleType,   color:'#7c4dff' },
            ].map(({ label, items, sel, fn, color }) => (
              <div key={label} style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontWeight:800, color:theme.textMuted, letterSpacing:1.5, marginBottom:8, textTransform:'uppercase', fontFamily:"'Barlow Condensed', sans-serif" }}>{label}</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {items.map(item => (
                    <Chip key={item} label={item} active={sel.includes(item)}
                      color={color || STATUS_COLORS[item] || '#888'}
                      theme={theme} onClick={() => fn(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Side Panel ── */}
        {showSide && (
          <div style={{
            ...glass({ borderRadius:16, padding:'20px 18px', animation: sidePanelIn ? 'slideIn 0.3s ease' : 'none' }),
            position:'absolute', top:'50%', right:16, transform:'translateY(-50%)', width:270, zIndex:20,
          }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:REA_GREEN, letterSpacing:2, textTransform:'uppercase', fontFamily:"'Barlow Condensed', sans-serif", marginBottom:2 }}>
                    {view === 'coverage' ? 'Coverage Summary' : 'Technology Mix'}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:theme.textPrimary, fontFamily:"'Barlow Condensed', sans-serif", lineHeight:1.2 }}>{displayName}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={exportStatePDF} title="Download PDF Report"
                    style={{ background:'none', border:`1px solid ${REA_GREEN}50`, borderRadius:6, cursor:'pointer', color:REA_GREEN, fontSize:10, padding:'3px 9px', fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:0.5, display:'flex', alignItems:'center', gap:4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    PDF
                  </button>
                <button onClick={() => {
                  setActiveState(null); setStateData(null); setSidePanelIn(false);
                  applyCoverageFade(null);
                  map.current.setFilter('state-border-active',['==','shapeName','']);
                }} style={{ background:'none', border:`1px solid ${theme.chipBorder}`, borderRadius:6, cursor:'pointer', color:theme.textMuted, fontSize:12, padding:'3px 7px' }}>✕</button>
              </div>
            </div>
              <div style={{ marginTop:10, height:2, borderRadius:2, background:`linear-gradient(90deg, ${REA_GREEN}, transparent)` }} />
            </div>
            {renderSideContent()}
          </div>
        )}

        {/* ── Intelligence Layer Controls ── */}
        {mapMode === 'intelligence' && (
          <div style={{
            ...glass({ borderRadius:14, padding:'14px 16px', animation:'fadeUp 0.2s ease' }),
            position:'absolute', top:108, left:16, width:200, zIndex:20,
          }}>
            <div style={{ fontSize:10, fontWeight:800, color:'#60A5FA', letterSpacing:1.5, textTransform:'uppercase', marginBottom:12, fontFamily:"'Barlow Condensed',sans-serif" }}>Layer Controls</div>

            {/* Grid lines toggle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>Grid Lines</span>
              <button onClick={() => toggleGridLines(!showGridLines)} style={{
                width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', position:'relative', transition:'all 0.2s',
                background: showGridLines ? '#F59E0B' : theme.chipBorder,
              }}>
                <span style={{ position:'absolute', top:2, left: showGridLines?18:2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all 0.2s', display:'block' }} />
              </button>
            </div>
            <div style={{ display:'flex', gap:12, marginBottom:14, paddingLeft:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:18, height:3, background:'#FFB800', borderRadius:2 }} />
                <span style={{ fontSize:9, color:theme.textMuted, fontFamily:"'Barlow',sans-serif" }}>330kV</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:18, height:2, background:'#60A5FA', borderRadius:2, borderTop:'2px dashed #60A5FA' }} />
                <span style={{ fontSize:9, color:theme.textMuted, fontFamily:"'Barlow',sans-serif" }}>132kV</span>
              </div>
            </div>

            {/* Population circles toggle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:11, color:theme.textPrimary, fontFamily:"'Barlow',sans-serif" }}>Population Circles</span>
              <button onClick={() => togglePopCircles(!showPopCircles)} style={{
                width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', position:'relative', transition:'all 0.2s',
                background: showPopCircles ? '#A855F7' : theme.chipBorder,
              }}>
                <span style={{ position:'absolute', top:2, left: showPopCircles?18:2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'all 0.2s', display:'block' }} />
              </button>
            </div>
          </div>
        )}

        {/* ── Intelligence Side Panel ── */}
        {mapMode === 'intelligence' && (
          <div style={{
            ...glass({ borderRadius:16, padding:'20px 18px', animation:'slideIn 0.3s ease' }),
            position:'absolute', top:'50%', right:16, transform:'translateY(-50%)', width:280, zIndex:20,
          }}>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#60A5FA', letterSpacing:2, textTransform:'uppercase', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:2 }}>
                🛰 Energy Intelligence
              </div>
              <div style={{ fontSize:16, fontWeight:800, color:theme.textPrimary, fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1.2 }}>
                {intelState
                  ? (intelState === 'Federal Capital Territory' ? 'FCT – Abuja' : intelState)
                  : 'Nigeria Overview'
                }
              </div>
              {intelState && (
                <button onClick={() => setIntelState(null)} style={{ position:'absolute', top:20, right:18, background:'none', border:`1px solid ${theme.chipBorder}`, borderRadius:6, cursor:'pointer', color:theme.textMuted, fontSize:12, padding:'3px 7px' }}>✕</button>
              )}
              <div style={{ marginTop:8, height:2, borderRadius:2, background:'linear-gradient(90deg, #1D4ED8, transparent)' }} />
            </div>
            {renderIntelPanel()}
          </div>
        )}

        {/* ── Legend ── */}
        <div style={{
          ...glass({ borderRadius:12, padding:'12px 16px', minWidth:160 }),
          position:'absolute', bottom:30, right:16, zIndex:20,
        }}>
          <div style={{ fontSize:10, fontWeight:800, color:theme.textSecond, letterSpacing:1.5, textTransform:'uppercase', marginBottom:10, fontFamily:"'Barlow Condensed', sans-serif" }}>
            {mapMode === 'intelligence'
            ? intelLayer === 'solar' ? 'Solar Irradiance (GHI)'
            : intelLayer === 'access' ? 'Electricity Access Rate'
            : intelLayer === 'population' ? 'State Population'
            : 'Opportunity Score'
            : view === 'coverage' ? 'Project Density'
            : view === 'performance' ? 'Project Status' : 'Technology Type'}
          </div>
          {mapMode === 'intelligence' ? renderIntelLegend() : renderLegend()}
        </div>
          
      </div>
    </>
  );
};

export default ProjectMap;
