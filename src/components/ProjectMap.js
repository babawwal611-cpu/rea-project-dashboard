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
      map.current.setLayoutProperty('project-points', 'visibility', isCov ? 'none' : 'visible');
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
        setView(v => {
          const inCoverage = v === 'coverage';
          map.current.setPaintProperty('project-points', 'circle-opacity',
            (next || inCoverage) ? 0 : ['interpolate',['linear'],['zoom'],4,0.45,6,0.68,9,0.88]);
          map.current.setPaintProperty('project-points', 'circle-stroke-opacity',
            (next || inCoverage) ? 0 : 1);
          map.current.setLayoutProperty('project-points', 'visibility',
            (next || inCoverage) ? 'none' : 'visible');
          return v;
        });
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
      preserveDrawingBuffer: true,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.current.on('load', () => {
      addLayers(THEMES.dark.pointStroke);
      map.current.setLayoutProperty('state-choropleth', 'visibility', 'visible');
    map.current.setPaintProperty('project-points', 'circle-opacity', 0);
    map.current.setPaintProperty('project-points', 'circle-stroke-opacity', 0);
    map.current.setLayoutProperty('project-points', 'visibility', 'none');
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

        {/* ── Legend ── */}
        <div style={{
          ...glass({ borderRadius:12, padding:'12px 16px', minWidth:160 }),
          position:'absolute', bottom:30, right:16, zIndex:20,
        }}>
          <div style={{ fontSize:10, fontWeight:800, color:theme.textSecond, letterSpacing:1.5, textTransform:'uppercase', marginBottom:10, fontFamily:"'Barlow Condensed', sans-serif" }}>
            {view === 'coverage' ? 'Project Density' : view === 'performance' ? 'Project Status' : 'Technology Type'}
          </div>
          {renderLegend()}
        </div>

      </div>
    </>
  );
};

export default ProjectMap;
