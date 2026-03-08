import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

/* ── Design tokens ───────────────────────────────────────────────────────── */
const REA_GREEN   = '#00843D';
const REA_DARK    = '#005C2B';
const ACCENT_GOLD = '#F5A623';
const DARK_BG     = '#0a1f0a';
const LIGHT_BG    = '#ffffff';
const GLASS_DARK  = 'rgba(10, 31, 10, 0.92)';
const GLASS_LIGHT = 'rgba(255, 255, 255, 0.92)';
const GLASS_BLUR  = 'blur(12px)';
const SHADOW      = '0 8px 32px rgba(0,0,0,0.4)';

/* ── Nigeria Bounds ───────────────────────────────────────────────────────── */
const NIGERIA_BOUNDS = [
  [2.6684, 4.2774],   // Southwest
  [14.6770, 13.8920]  // Northeast
];

/* ── Constants ───────────────────────────────────────────────────────────── */
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

/* ── Inject Google Font ──────────────────────────────────────────────────── */
const FontLink = () => (
  <link
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
);

/* ── SVG Pie Chart ───────────────────────────────────────────────────────── */
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

/* ── StatCard ───────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, color, sub, isLight }) => (
  <div style={{
    flex: 1, borderRadius: 10, padding: '12px 10px', textAlign: 'center',
    background: isLight 
      ? `linear-gradient(135deg, ${color}15, ${color}08)`
      : `linear-gradient(135deg, ${color}18, ${color}08)`,
    border: `1px solid ${color}${isLight ? '40' : '30'}`,
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '10px 10px 0 0' }} />
    <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 10, color: isLight ? '#555' : '#aaa', marginTop: 3, fontFamily: "'Barlow', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
  </div>
);

/* ── Chip ─────────────────────────────────────────────────────────────────── */
const Chip = ({ label, active, color, onClick, isLight }) => (
  <button onClick={onClick} style={{
    padding: '5px 11px', borderRadius: 6, fontSize: 10, fontWeight: 700,
    cursor: 'pointer', border: `1.5px solid ${active ? color : (isLight ? '#ddd' : '#333')}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : (isLight ? '#555' : '#aaa'),
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
  const listenersRef = useRef([]);

  const [view,           setView]           = useState('performance');
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [selectedYears,  setSelectedYears]  = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [activeState,    setActiveState]    = useState(null);
  const [stateData,      setStateData]      = useState(null);
  const [pointCount,     setPointCount]     = useState(null);
  const [totalProjects,  setTotalProjects]  = useState(0);
  const [mapReady,       setMapReady]       = useState(false);
  const [sidePanelIn,    setSidePanelIn]    = useState(false);
  const [isLightMode,    setIsLightMode]    = useState(false);

  // Use refs to track current state for event handlers
  const stateRef = useRef({
    selectedYears, selectedStatus, selectedTypes, activeState, isLightMode, view
  });

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = { selectedYears, selectedStatus, selectedTypes, activeState, isLightMode, view };
  }, [selectedYears, selectedStatus, selectedTypes, activeState, isLightMode, view]);

  // Calculate total projects from GeoJSON data
  const calculateTotalProjects = useCallback((geojsonData) => {
    if (!geojsonData || !geojsonData.features) return 0;
    return geojsonData.features.length;
  }, []);

  // Apply filters to the map layers
  const applyFilter = useCallback((years, statuses, types, stateName) => {
    if (!map.current || !map.current.getLayer('unclustered-point')) return;
    
    const conds = [];
    if (stateName)       conds.push(['==', ['get', 'state'], stateName]);
    if (years.length)    conds.push(['in', ['get', 'year'],   ['literal', years]]);
    if (statuses.length) conds.push(['in', ['get', 'status'], ['literal', statuses]]);
    if (types.length)    conds.push(['in', ['get', 'type'],   ['literal', types]]);
    
    const filter = conds.length === 0 ? null : conds.length === 1 ? conds[0] : ['all', ...conds];
    
    map.current.setFilter('unclustered-point', filter);
    
    // Update point count after filter animation
    setTimeout(() => {
      if (!map.current) return;
      const visiblePoints = map.current.queryRenderedFeatures({ layers: ['unclustered-point'] });
      const clusters = map.current.queryRenderedFeatures({ layers: ['clusters'] });
      
      let totalVisible = visiblePoints.length;
      clusters.forEach(cluster => {
        totalVisible += cluster.properties.point_count || 0;
      });
      
      setPointCount(totalVisible);
    }, 300);
  }, []);

  // Clear all event listeners
  const clearListeners = useCallback(() => {
    if (!map.current) return;
    listenersRef.current.forEach(({ event, layer, fn }) => {
      if (layer) {
        map.current.off(event, layer, fn);
      } else {
        map.current.off(event, fn);
      }
    });
    listenersRef.current = [];
  }, []);

  // Add event listener and track it for cleanup
  const addListener = useCallback((event, layer, fn) => {
    if (!map.current) return;
    if (typeof layer === 'function') {
      fn = layer;
      layer = null;
    }
    if (layer) {
      map.current.on(event, layer, fn);
    } else {
      map.current.on(event, fn);
    }
    listenersRef.current.push({ event, layer, fn });
  }, []);

  // Attach all event listeners
  const attachEventListeners = useCallback(() => {
    if (!map.current) return;
    
    clearListeners();

    const currentState = stateRef.current;

    // State hover effects
    ['state-fill', 'state-choropleth'].forEach(layer => {
      addListener('mousemove', layer, (e) => {
        map.current.setFilter('state-hover', ['==', 'shapeName', e.features[0].properties.shapeName]);
        map.current.getCanvas().style.cursor = 'pointer';
      });
      addListener('mouseleave', layer, () => {
        map.current.setFilter('state-hover', ['==', 'shapeName', '']);
        map.current.getCanvas().style.cursor = '';
      });
    });

    // State click handler
    const onStateClick = (e) => {
      const props = e.features[0].properties;
      const stateName = props.shapeName.toUpperCase();
      setActiveState(stateName);
      setStateData(props);
      map.current.setFilter('state-border-active', ['==', 'shapeName', props.shapeName]);
      map.current.fitBounds(turf.bbox(e.features[0]), { padding: 60 });
      setTimeout(() => setSidePanelIn(true), 100);
      applyFilter(
        stateRef.current.selectedYears,
        stateRef.current.selectedStatus,
        stateRef.current.selectedTypes,
        stateName
      );
    };
    
    addListener('click', 'state-fill', onStateClick);
    addListener('click', 'state-choropleth', onStateClick);

    // Empty space click - clear selection
    addListener('click', (e) => {
      const hits = map.current.queryRenderedFeatures(e.point, { 
        layers: ['state-fill', 'state-choropleth', 'clusters', 'unclustered-point'] 
      });
      if (!hits.length) {
        setActiveState(null);
        setStateData(null);
        setSidePanelIn(false);
        map.current.setFilter('state-border-active', ['==', 'shapeName', '']);
        applyFilter(
          stateRef.current.selectedYears,
          stateRef.current.selectedStatus,
          stateRef.current.selectedTypes,
          null
        );
      }
    });

    // Cluster click - zoom in
    addListener('click', 'clusters', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      map.current.getSource('projects').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.current.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
      });
    });

    // Unclustered point click - show popup
    addListener('click', 'unclustered-point', (e) => {
      const p = e.features[0].properties;
      const c = STATUS_COLORS[p.status] || '#778CA3';
      const isLight = stateRef.current.isLightMode;
      
      new mapboxgl.Popup({ maxWidth: '300px', offset: 12, className: 'rea-popup' })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:'Barlow',sans-serif;padding:4px 0">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;color:${isLight ? '#111' : '#fff'};line-height:1.3;margin-bottom:8px">${p.title}</div>
            <span style="background:${c};color:#fff;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">${p.status || 'UNKNOWN'}</span>
            <div style="margin-top:10px;font-size:12px;color:${isLight ? '#555' : '#aaa'};line-height:1.8">
              <div>📍 <strong>${p.location || '—'}</strong>, ${p.state}</div>
              <div>⚡ ${p.type || '—'}</div>
              <div>🏗 ${p.contractor || 'N/A'}</div>
              <div>📅 ${p.year}</div>
            </div>
          </div>
        `)
        .addTo(map.current);
    });

    // Cursor handlers
    addListener('mouseenter', 'clusters', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    addListener('mouseleave', 'clusters', () => { map.current.getCanvas().style.cursor = ''; });
    addListener('mouseenter', 'unclustered-point', () => { map.current.getCanvas().style.cursor = 'pointer'; });
    addListener('mouseleave', 'unclustered-point', () => { map.current.getCanvas().style.cursor = ''; });
  }, [addListener, clearListeners, applyFilter]);

  // Initialize map layers
  const initializeMapLayers = useCallback(() => {
    if (!map.current) return;

    const currentState = stateRef.current;

    // Add states source
    if (!map.current.getSource('states')) {
      map.current.addSource('states', {
        type: 'geojson',
        data: require('../data/nigeria-states-enriched.geojson'),
      });
    }
    
    // State choropleth layer
    if (!map.current.getLayer('state-choropleth')) {
      map.current.addLayer({
        id: 'state-choropleth', 
        type: 'fill', 
        source: 'states',
        layout: { visibility: currentState.view === 'coverage' ? 'visible' : 'none' },
        paint: {
          'fill-color': ['interpolate', ['linear'], ['get', 'total'], 
            0, currentState.isLightMode ? '#e8f5e9' : '#1a3d1a', 
            40, currentState.isLightMode ? '#a5d6a7' : '#2d5a2d', 
            80, currentState.isLightMode ? '#66bb6a' : '#00843D', 
            120, currentState.isLightMode ? '#43a047' : '#00C48C', 
            160, currentState.isLightMode ? '#2e7d32' : '#4ade80'
          ],
          'fill-opacity': 0.82,
        },
      });
    }
    
    // State fill layer
    if (!map.current.getLayer('state-fill')) {
      map.current.addLayer({
        id: 'state-fill', 
        type: 'fill', 
        source: 'states',
        paint: { 
          'fill-color': REA_GREEN, 
          'fill-opacity': currentState.isLightMode ? 0.1 : 0.15 
        },
      });
    }
    
    // State hover layer
    if (!map.current.getLayer('state-hover')) {
      map.current.addLayer({
        id: 'state-hover', 
        type: 'fill', 
        source: 'states',
        paint: { 'fill-color': ACCENT_GOLD, 'fill-opacity': 0.25 },
        filter: ['==', 'shapeName', ''],
      });
    }
    
    // State borders
    if (!map.current.getLayer('state-border')) {
      map.current.addLayer({
        id: 'state-border', 
        type: 'line', 
        source: 'states',
        paint: { 
          'line-color': currentState.isLightMode ? REA_GREEN : '#4ade80', 
          'line-width': 1, 
          'line-opacity': 0.4 
        },
      });
    }
    
    // Active state border
    if (!map.current.getLayer('state-border-active')) {
      map.current.addLayer({
        id: 'state-border-active', 
        type: 'line', 
        source: 'states',
        paint: { 'line-color': ACCENT_GOLD, 'line-width': 3, 'line-opacity': 1 },
        filter: ['==', 'shapeName', ''],
      });
    }

    // Projects source with clustering
    if (!map.current.getSource('projects')) {
      map.current.addSource('projects', {
        type: 'geojson',
        data: require('../data/projects-final.geojson'),
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
        clusterProperties: {
          'completed': ['+', ['case', ['==', ['get', 'status'], 'COMPLETED'], 1, 0]],
          'ongoing': ['+', ['case', ['==', ['get', 'status'], 'ONGOING'], 1, 0]],
          'yet_to_mobilize': ['+', ['case', ['==', ['get', 'status'], 'YET TO MOBILIZE'], 1, 0]]
        }
      });
    }

    // Heatmap layer
    if (!map.current.getLayer('heatmap')) {
      map.current.addLayer({
        id: 'heatmap',
        type: 'heatmap',
        source: 'projects',
        maxzoom: 10,
        layout: { visibility: currentState.view !== 'coverage' ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'point_count'], 0, 0.1, 10, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0, 132, 61, 0)',
            0.2, 'rgba(0, 132, 61, 0.3)',
            0.4, 'rgba(0, 196, 140, 0.5)',
            0.6, 'rgba(245, 166, 35, 0.7)',
            0.8, 'rgba(255, 184, 0, 0.85)',
            1, 'rgba(255, 255, 255, 0.95)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 40, 9, 20],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 1, 10, 0],
        }
      });
    }

    // Clusters layer
    if (!map.current.getLayer('clusters')) {
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'projects',
        filter: ['has', 'point_count'],
        layout: { visibility: currentState.view !== 'coverage' ? 'visible' : 'none' },
        paint: {
          'circle-color': [
            'case',
            ['>', ['get', 'completed'], ['get', 'ongoing']],
            ['>', ['get', 'completed'], ['get', 'yet_to_mobilize']],
            STATUS_COLORS['COMPLETED'],
            ['>', ['get', 'ongoing'], ['get', 'yet_to_mobilize']],
            STATUS_COLORS['ONGOING'],
            STATUS_COLORS['YET TO MOBILIZE']
          ],
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 50, 30, 100, 35, 200, 40],
          'circle-blur': 0.15,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.8)',
          'circle-opacity': 0.9
        }
      });
    }

    // Cluster count labels
    if (!map.current.getLayer('cluster-count')) {
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'projects',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-allow-overlap': true,
          'visibility': currentState.view !== 'coverage' ? 'visible' : 'none'
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1
        }
      });
    }

    // Unclustered points layer
    if (!map.current.getLayer('unclustered-point')) {
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'projects',
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: currentState.view !== 'coverage' ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 10],
          'circle-color': [
            'match', ['get', 'status'],
            'COMPLETED', STATUS_COLORS['COMPLETED'], 
            'ONGOING', STATUS_COLORS['ONGOING'], 
            'YET TO MOBILIZE', STATUS_COLORS['YET TO MOBILIZE'], 
            STATUS_COLORS['']
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.9)',
          'circle-opacity': 0.9,
          'circle-blur': 0.1
        }
      });
    }

    // Re-attach event listeners
    attachEventListeners();
    
    // Apply current filters
    applyFilter(
      currentState.selectedYears,
      currentState.selectedStatus,
      currentState.selectedTypes,
      currentState.activeState
    );
  }, [attachEventListeners, applyFilter, addListener]);

  // Toggle theme between light and dark
  const toggleTheme = useCallback(() => {
    if (!map.current) return;
    
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    
    // Switch map style
    const newStyle = newMode ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11';
    map.current.setStyle(newStyle);
    
    // After style loads, re-add custom sources and layers
    map.current.once('style.load', () => {
      // Set background color
      if (newMode) {
        map.current.setPaintProperty('background', 'background-color', LIGHT_BG);
      } else {
        map.current.setPaintProperty('background', 'background-color', DARK_BG);
      }
      
      // Re-initialize sources and layers
      initializeMapLayers();
    });
  }, [isLightMode, initializeMapLayers]);

  // Switch between views
  const switchView = useCallback((newView) => {
    if (!map.current || !mapReady) return;
    setView(newView);
    setActiveState(null);
    setStateData(null);
    setSidePanelIn(false);
    const isCov = newView === 'coverage';
    
    map.current.setLayoutProperty('clusters', 'visibility', isCov ? 'none' : 'visible');
    map.current.setLayoutProperty('cluster-count', 'visibility', isCov ? 'none' : 'visible');
    map.current.setLayoutProperty('unclustered-point', 'visibility', isCov ? 'none' : 'visible');
    map.current.setLayoutProperty('heatmap', 'visibility', isCov ? 'none' : 'visible');
    map.current.setLayoutProperty('state-choropleth', 'visibility', isCov ? 'visible' : 'none');
    map.current.setPaintProperty('state-fill', 'fill-opacity', isCov ? 0 : (isLightMode ? 0.1 : 0.15));
    
    // Update point colors for technology view
    if (newView === 'technology') {
      map.current.setPaintProperty('unclustered-point', 'circle-color', [
        'case',
        ['all', ['in', 'SOLAR STREET LIGHT', ['get', 'type']], ['!', ['in', 'MINI GRID', ['get', 'type']]]], '#FFB800',
        ['in', 'MINI GRID', ['get', 'type']], '#1E90FF',
        ['in', 'SOLAR HOME', ['get', 'type']], '#A855F7',
        ['in', 'GRID', ['get', 'type']], '#FF4757',
        '#778CA3',
      ]);
    } else if (newView === 'performance') {
      map.current.setPaintProperty('unclustered-point', 'circle-color', [
        'match', ['get', 'status'],
        'COMPLETED', STATUS_COLORS['COMPLETED'], 
        'ONGOING', STATUS_COLORS['ONGOING'], 
        'YET TO MOBILIZE', STATUS_COLORS['YET TO MOBILIZE'], 
        STATUS_COLORS['']
      ]);
    }
    
    // Reset filter and show total
    applyFilter(selectedYears, selectedStatus, selectedTypes, null);
  }, [mapReady, isLightMode, selectedYears, selectedStatus, selectedTypes, applyFilter]);

  // Filter toggle handlers
  const toggleYear = (y) => {
    const n = selectedYears.includes(y) ? selectedYears.filter(v => v !== y) : [...selectedYears, y];
    setSelectedYears(n);
    applyFilter(n, selectedStatus, selectedTypes, activeState);
  };

  const toggleStatus = (s) => {
    const n = selectedStatus.includes(s) ? selectedStatus.filter(v => v !== s) : [...selectedStatus, s];
    setSelectedStatus(n);
    applyFilter(selectedYears, n, selectedTypes, activeState);
  };

  const toggleType = (t) => {
    const n = selectedTypes.includes(t) ? selectedTypes.filter(v => v !== t) : [...selectedTypes, t];
    setSelectedTypes(n);
    applyFilter(selectedYears, selectedStatus, n, activeState);
  };

  // Clear all filters
  const clearAll = () => {
    setSelectedYears([]);
    setSelectedStatus([]);
    setSelectedTypes([]);
    setActiveState(null);
    setStateData(null);
    setSidePanelIn(false);
    applyFilter([], [], [], null);
    map.current?.flyTo({ center: [8.6753, 9.0820], zoom: 5.2 });
  };

  const activeFilterCount = selectedYears.length + selectedStatus.length + selectedTypes.length;

  // Initialize map on mount
  useEffect(() => {
    if (map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [8.6753, 9.0820], 
      zoom: 5.2,
      maxBounds: NIGERIA_BOUNDS,
      minZoom: 5,
      maxZoom: 14,
      projection: 'mercator'
    });
    
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.current.on('load', () => {
      map.current.setPaintProperty('background', 'background-color', DARK_BG);
      
      // Calculate total projects from source data
      try {
        const projectsData = require('../data/projects-final.geojson');
        const total = calculateTotalProjects(projectsData);
        setTotalProjects(total);
        setPointCount(total);
      } catch (e) {
        console.error('Failed to load projects data:', e);
      }
      
      initializeMapLayers();
      setMapReady(true);
    });

    // Cleanup on unmount
    return () => {
      clearListeners();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [calculateTotalProjects, initializeMapLayers, clearListeners]);

  // Update project count display
  useEffect(() => {
    if (!mapReady) return;
    
    const timer = setTimeout(() => {
      if (view !== 'coverage' && map.current) {
        const visiblePoints = map.current.queryRenderedFeatures({ layers: ['unclustered-point'] }) || [];
        const clusters = map.current.queryRenderedFeatures({ layers: ['clusters'] }) || [];
        
        let total = visiblePoints.length;
        clusters.forEach(cluster => {
          total += cluster.properties?.point_count || 0;
        });
        
        setPointCount(total || (activeState ? 0 : totalProjects));
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [view, activeState, totalProjects, mapReady, selectedYears, selectedStatus, selectedTypes]);

  const displayName = activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT – Abuja' : activeState;
  
  const showSide = activeState && stateData && view !== 'performance';

  // Render side panel content based on current view
  const renderSideContent = () => {
    if (!stateData) return null;
    const d = stateData;
    
    if (view === 'coverage') {
      return (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <StatCard label="Total Projects" value={d.total} color={REA_GREEN} isLight={isLightMode} />
            <StatCard label="Completion Rate" value={`${d.pct_completed}%`} color="#00C48C" isLight={isLightMode} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatCard label="Completed" value={d.completed} color="#00C48C" isLight={isLightMode} />
            <StatCard label="Ongoing" value={d.ongoing} color="#FFB800" isLight={isLightMode} />
            <StatCard label="Yet to Mobilize" value={d.yet_to_mobilize} color="#FF4757" isLight={isLightMode} />
          </div>
          <div style={{ marginTop: 14, height: 6, borderRadius: 10, background: isLightMode ? '#e0e0e0' : '#333', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${d.pct_completed}%`, background: `linear-gradient(90deg, ${REA_GREEN}, #00C48C)`, borderRadius: 10 }} />
          </div>
          <div style={{ fontSize: 10, color: isLightMode ? '#666' : '#888', marginTop: 4, fontFamily: "'Barlow', sans-serif" }}>{d.pct_completed}% of projects completed</div>
        </div>
      );
    }
    
    if (view === 'technology') {
      const techData = [
        { label: 'Solar Street Light', value: Number(d.solar_street_light) || 0, color: '#FFB800' },
        { label: 'Grid Extension', value: Number(d.grid) || 0, color: '#FF4757' },
        { label: 'Solar Mini Grid', value: Number(d.solar_mini_grid) || 0, color: '#1E90FF' },
        { label: 'Solar Home System', value: Number(d.solar_home_system) || 0, color: '#A855F7' },
        { label: 'Other', value: Number(d.other_type) || 0, color: '#778CA3' },
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
                    <span style={{ fontSize: 11, color: isLightMode ? '#444' : '#ccc', fontFamily: "'Barlow', sans-serif" }}>{td.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: isLightMode ? '#aaa' : '#777', fontFamily: "'Barlow', sans-serif" }}>{td.value}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: td.color, fontFamily: "'Barlow Condensed', sans-serif", minWidth: 32, textAlign: 'right' }}>{pct(td.value, d.total)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 10, color: isLightMode ? '#aaa' : '#777', borderTop: `1px solid ${isLightMode ? '#f0f0f0' : '#333'}`, paddingTop: 10, fontFamily: "'Barlow', sans-serif" }}>
            {d.total} total projects
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render legend based on current view
  const renderLegend = () => {
    let entries;
    if (view === 'coverage') {
      entries = isLightMode 
        ? [['#2e7d32','120+ projects'],['#43a047','80–120'],['#66bb6a','40–80'],['#a5d6a7','Under 40'],['#e8f5e9','0–few']]
        : [['#4ade80','120+ projects'],['#00C48C','80–120'],['#00843D','40–80'],['#2d5a2d','Under 40'],['#1a3d1a','0–few']];
    } else if (view === 'performance') {
      entries = [['#00C48C','Completed'],['#FFB800','Ongoing'],['#FF4757','Yet to Mobilize']];
    } else {
      entries = [['#FFB800','Solar Street Light'],['#FF4757','Grid Extension'],['#1E90FF','Solar Mini Grid'],['#A855F7','Solar Home System'],['#778CA3','Other']];
    }
    
    const isSquare = view === 'coverage';
    return entries.map(([color, label]) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        {isSquare
          ? <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0, border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'}` }} />
          : <span style={{ color, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>●</span>
        }
        <span style={{ fontSize: 11, color: isLightMode ? '#555' : '#ccc', fontFamily: "'Barlow', sans-serif" }}>{label}</span>
      </div>
    ));
  };

  const GLASS_BG = isLightMode ? GLASS_LIGHT : GLASS_DARK;
  const themeColor = isLightMode ? REA_GREEN : '#4ade80';
  const textColor = isLightMode ? '#333' : '#fff';
  const subTextColor = isLightMode ? '#666' : '#888';

  return (
    <>
      <FontLink />
      <style>{`
        .mapboxgl-popup-content { 
          border-radius: 12px !important; 
          padding: 16px 18px !important; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.4) !important;
          background: ${isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 40, 20, 0.95)'} !important;
          color: ${isLightMode ? '#333' : '#fff'} !important;
          border: 1px solid ${isLightMode ? 'rgba(0, 132, 61, 0.3)' : 'rgba(74, 222, 128, 0.3)'} !important;
        }
        .mapboxgl-popup-tip { 
          border-top-color: ${isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 40, 20, 0.95)'} !important; 
        }
        .mapboxgl-ctrl-group { 
          border-radius: 10px !important; 
          overflow: hidden; 
          box-shadow: ${SHADOW} !important;
          background: ${isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 31, 10, 0.9)'} !important;
        }
        .mapboxgl-ctrl-group button {
          background-color: ${isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 31, 10, 0.9)'} !important;
          color: ${isLightMode ? REA_GREEN : '#4ade80'} !important;
        }
        @keyframes slideIn  { from { opacity:0; transform: translateX(24px); } to { opacity:1; transform: translateX(0); } }
        @keyframes fadeUp   { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
      `}</style>

      <div style={{ position: 'relative', height: '100vh', fontFamily: "'Barlow', sans-serif", background: isLightMode ? LIGHT_BG : DARK_BG }}>
        <div ref={mapContainer} style={{ height: '100%' }} />

        {/* ── REA Wordmark ── */}
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            background: GLASS_BG, backdropFilter: GLASS_BLUR,
            borderRadius: 12, padding: '8px 20px',
            boxShadow: SHADOW, border: `1.5px solid ${REA_GREEN}50`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif",
            }}>REA</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: themeColor, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
                PROJECT MONITORING MAP
              </div>
              <div style={{ fontSize: 9, color: subTextColor, letterSpacing: 1, textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>
                Rural Electrification Agency · Nigeria
              </div>
            </div>
          </div>
        </div>

        {/* ── View Selector ── */}
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, display: 'flex', gap: 6,
        }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => switchView(v.id)} style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
              background: view === v.id
                ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})`
                : GLASS_BG,
              color: view === v.id ? '#fff' : subTextColor,
              backdropFilter: GLASS_BLUR,
              boxShadow: view === v.id ? `0 4px 16px ${REA_GREEN}50` : '0 2px 8px rgba(0,0,0,0.3)',
              border: view === v.id ? 'none' : `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.2)'}`,
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 10 }}>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* ── Top-left controls ── */}
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Filter button */}
          <button onClick={() => setPanelOpen(o => !o)} style={{
            width: 42, height: 42, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: panelOpen ? `linear-gradient(135deg, ${REA_GREEN}, ${REA_DARK})` : GLASS_BG,
            backdropFilter: GLASS_BLUR, boxShadow: SHADOW, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: panelOpen ? '#fff' : themeColor,
            position: 'relative',
          }}>
            ⚙
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5,
                background: ACCENT_GOLD, color: '#fff',
                borderRadius: '50%', width: 16, height: 16, fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
              }}>{activeFilterCount}</span>
            )}
          </button>

          {/* Project count */}
          {pointCount !== null && view !== 'coverage' && (
            <div style={{
              background: GLASS_BG, backdropFilter: GLASS_BLUR, borderRadius: 10,
              boxShadow: SHADOW, padding: '8px 12px', border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.2)'}`,
              animation: 'fadeUp 0.3s ease',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: themeColor, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                {pointCount.toLocaleString()}
              </div>
              <div style={{ fontSize: 9, color: subTextColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {activeState ? (activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT' : activeState) : 'Total Projects'}
              </div>
            </div>
          )}
        </div>

        {/* ── Theme Toggle (Bottom Left) ── */}
        <div style={{ position: 'absolute', bottom: 30, left: 16, zIndex: 20 }}>
          <button 
            onClick={toggleTheme}
            style={{
              width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
              background: GLASS_BG, backdropFilter: GLASS_BLUR, boxShadow: SHADOW,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: themeColor,
              border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.3)'}`,
              transition: 'all 0.3s ease',
            }}
            title={isLightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {isLightMode ? '☀' : '☾'}
          </button>
        </div>

        {/* ── Filter Panel ── */}
        {panelOpen && (
          <div style={{
            position: 'absolute', top: 68, left: 16, width: 290,
            maxHeight: 'calc(100vh - 120px)', background: GLASS_BG,
            backdropFilter: GLASS_BLUR, borderRadius: 14,
            boxShadow: SHADOW, overflowY: 'auto', zIndex: 20,
            padding: '16px', border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.2)'}`,
            animation: 'fadeUp 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: themeColor, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Filter Projects
              </span>
              <button onClick={clearAll} style={{
                background: 'none', border: `1px solid ${REA_GREEN}60`, borderRadius: 6,
                padding: '3px 10px', fontSize: 10, cursor: 'pointer', color: themeColor, fontWeight: 700,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
              }}>CLEAR ALL</button>
            </div>

            {activeState && (
              <div style={{
                background: `${REA_GREEN}20`, border: `1px solid ${REA_GREEN}60`,
                borderRadius: 8, padding: '7px 10px', fontSize: 11,
                color: themeColor, marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: "'Barlow', sans-serif",
              }}>
                <span>📍 {activeState === 'ABUJA FEDERAL CAPITAL TERRITORY' ? 'FCT – Abuja' : activeState}</span>
                <button onClick={() => {
                  setActiveState(null); setStateData(null); setSidePanelIn(false);
                  map.current.setFilter('state-border-active', ['==','shapeName','']);
                  applyFilter(selectedYears, selectedStatus, selectedTypes, null);
                  map.current.flyTo({ center: [8.6753,9.0820], zoom: 5.2 });
                }} style={{ background:'none', border:'none', cursor:'pointer', color: subTextColor, fontSize:14 }}>✕</button>
              </div>
            )}

            {[
              { label:'YEAR', items:YEARS, sel:selectedYears, fn:toggleYear, color:'#4a90d9' },
              { label:'STATUS', items:STATUSES, sel:selectedStatus, fn:toggleStatus, color:null },
              { label:'PROJECT TYPE', items:TYPES, sel:selectedTypes, fn:toggleType, color:'#7c4dff' },
            ].map(({ label, items, sel, fn, color }) => (
              <div key={label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: subTextColor, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {label}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {items.map(item => (
                    <Chip key={item} label={item} active={sel.includes(item)}
                      color={color || STATUS_COLORS[item] || '#888'}
                      onClick={() => fn(item)}
                      isLight={isLightMode}
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
            position: 'absolute', top: '50%', right: 16,
            transform: 'translateY(-50%)',
            width: 270, background: GLASS_BG, backdropFilter: GLASS_BLUR,
            borderRadius: 16, boxShadow: SHADOW, zIndex: 20,
            padding: '20px 18px', border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.2)'}`,
            animation: sidePanelIn ? 'slideIn 0.3s ease' : 'none',
          }}>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: themeColor, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 2 }}>
                    {view === 'coverage' ? 'Coverage Summary' : 'Technology Mix'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: textColor, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1.2 }}>
                    {displayName}
                  </div>
                </div>
                <button onClick={() => { setActiveState(null); setStateData(null); setSidePanelIn(false); map.current.setFilter('state-border-active',['==','shapeName','']); }}
                  style={{ background:'none', border:`1px solid ${isLightMode ? '#ddd' : '#444'}`, borderRadius:6, cursor:'pointer', color: subTextColor, fontSize:12, padding:'3px 7px' }}>✕</button>
              </div>
              <div style={{ marginTop: 10, height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${REA_GREEN}, transparent)` }} />
            </div>
            {renderSideContent()}
          </div>
        )}

        {/* ── Legend ── */}
        <div style={{
          position: 'absolute', bottom: 30, right: 16,
          background: GLASS_BG, backdropFilter: GLASS_BLUR,
          padding: '12px 16px', borderRadius: 12,
          boxShadow: SHADOW, zIndex: 20,
          border: `1px solid ${isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(74, 222, 128, 0.2)'}`,
          minWidth: 160,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: themeColor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, fontFamily: "'Barlow Condensed', sans-serif" }}>
            {view === 'coverage' ? 'Project Density' : view === 'performance' ? 'Project Status' : 'Technology Type'}
          </div>
          {renderLegend()}
        </div>

      </div>
    </>
  );
};

export default ProjectMap;
