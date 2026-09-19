'use client';
import { useState, useMemo, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { MapPin, Calendar, ZoomIn, ZoomOut, RotateCcw, ChevronRight, Store, UserCheck } from 'lucide-react';
import DISTRICT_CENTERS_DATA from '../../public/district_centers.json';

const INDIA_STATES_GEO_URL = '/india-states-clean.geojson';
const INDIA_DISTRICTS_GEO_URL = '/india.geojson';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export type DrillLevel = 'india' | 'state' | 'city' | 'customer';

interface StateSalesData {
  name: string;
  code: string;
  revenue: number;
  dealers: number;
  orders: number;
  share: number;
  color: string;
  center: [number, number];
  zoom: number;
}

interface CityData {
  name: string;
  revenue: number;
  orders: number;
  dealers: number;
  units_sold: number;
  share: number;
  center: [number, number];
  zoom: number;
  color?: string;
}

interface CustomerData {
  id: string;
  name: string;
  city: string;
  state: string;
  salesman: string;
  phone?: string;
  revenue: number;
  orders: number;
  avg_order: number;
  units_sold: number;
  coords: [number, number];
}

interface TopProductData {
  name: string;
  quantity: number;
  revenue: number;
}

// Projection centers & zoom levels for India states
const STATE_PROJECTION_CONFIG: Record<string, { center: [number, number]; zoom: number; code: string; color: string }> = {
  'Haryana': { center: [76.0856, 29.0588], zoom: 5.2, code: 'HR', color: '#6366f1' },
  'Delhi': { center: [77.1025, 28.7041], zoom: 8.5, code: 'DL', color: '#06b6d4' },
  'NCT of Delhi': { center: [77.1025, 28.7041], zoom: 8.5, code: 'DL', color: '#06b6d4' },
  'Uttar Pradesh': { center: [80.9462, 26.8467], zoom: 3.8, code: 'UP', color: '#10b981' },
  'Rajasthan': { center: [74.2179, 27.0238], zoom: 3.5, code: 'RJ', color: '#f59e0b' },
  'Punjab': { center: [75.4024, 31.0356], zoom: 5.5, code: 'PB', color: '#eab308' },
  'Maharashtra': { center: [75.7139, 19.7515], zoom: 3.6, code: 'MH', color: '#f43f5e' },
  'Gujarat': { center: [71.2828, 22.4166], zoom: 4.2, code: 'GJ', color: '#ec4899' },
  'Karnataka': { center: [75.7139, 15.3173], zoom: 4.0, code: 'KA', color: '#06b6d4' },
  'Bihar': { center: [85.3131, 25.0961], zoom: 4.8, code: 'BR', color: '#ef4444' },
  'Himachal Pradesh': { center: [77.1734, 31.1048], zoom: 5.8, code: 'HP', color: '#14b8a6' },
  'Uttarakhand': { center: [79.0193, 30.0668], zoom: 5.5, code: 'UK', color: '#8b5cf6' },
};

// District Projection Centers for District-Only View
const DISTRICT_PROJECTION_CONFIG: Record<string, { center: [number, number]; zoom: number }> = {
  'Faridabad': { center: [77.3307, 28.3631], zoom: 11.5 },
  'Gurugram': { center: [76.9461, 28.3748], zoom: 11.2 },
  'Panipat': { center: [76.9026, 29.3405], zoom: 11.2 },
  'Rohtak': { center: [76.5562, 28.8972], zoom: 10.8 },
  'Karnal': { center: [76.8651, 29.7186], zoom: 10.8 },
  'Hisar': { center: [75.8237, 29.2367], zoom: 10.2 },
  'Ambala': { center: [76.8850, 30.3448], zoom: 10.8 },
  'Sonipat': { center: [76.8552, 29.0401], zoom: 10.8 },
};

const DEFAULT_STATE: StateSalesData = {
  name: 'Haryana',
  code: 'HR',
  revenue: 9850000,
  dealers: 586,
  orders: 420,
  share: 72.8,
  color: '#6366f1',
  center: [76.0856, 29.0588],
  zoom: 5.2
};

// Independent Vibrant Palette for Districts inside a State (Completely Discards State Color!)
const INDEPENDENT_DISTRICT_PALETTE = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f43f5e', '#3b82f6', '#4f46e5',
  '#059669', '#d97706', '#7c3aed', '#db2777', '#0d9488',
  '#a855f7', '#64748b', '#6366f1', '#4ade80', '#fbbf24'
];

// Dynamic Fallback Cities per State (Fixes wrong state city display bug)
const FALLBACK_CITIES_BY_STATE: Record<string, Array<{ name: string; revenue: number; orders: number; dealers: number; units_sold: number; share: number; center: [number, number]; zoom: number }>> = {
  'Uttar Pradesh': [
    { name: 'Noida', revenue: 1450000, orders: 120, dealers: 35, units_sold: 1740, share: 42.0, center: [77.3910, 28.5355], zoom: 11.2 },
    { name: 'Ghaziabad', revenue: 980000, orders: 85, dealers: 28, units_sold: 1230, share: 28.4, center: [77.4538, 28.6692], zoom: 11.2 },
    { name: 'Kanpur', revenue: 420000, orders: 45, dealers: 18, units_sold: 650, share: 12.1, center: [80.3318, 26.4499], zoom: 10.8 },
    { name: 'Agra', revenue: 320000, orders: 35, dealers: 12, units_sold: 500, share: 9.2, center: [78.0081, 27.1767], zoom: 10.8 },
    { name: 'Lucknow', revenue: 280000, orders: 30, dealers: 9, units_sold: 430, share: 8.1, center: [80.9462, 26.8467], zoom: 10.8 },
    { name: 'Varanasi', revenue: 210000, orders: 22, dealers: 6, units_sold: 310, share: 6.1, center: [82.9739, 25.3176], zoom: 10.8 },
  ],
  'Punjab': [
    { name: 'Ludhiana', revenue: 1850000, orders: 110, dealers: 24, units_sold: 1600, share: 45.0, center: [75.8573, 30.9010], zoom: 11.0 },
    { name: 'Amritsar', revenue: 1200000, orders: 75, dealers: 16, units_sold: 1080, share: 29.2, center: [74.8723, 31.6340], zoom: 11.0 },
    { name: 'Jalandhar', revenue: 850000, orders: 50, dealers: 12, units_sold: 725, share: 20.7, center: [75.5762, 31.3260], zoom: 11.0 },
    { name: 'Patiala', revenue: 210000, orders: 18, dealers: 5, units_sold: 260, share: 5.1, center: [76.3869, 30.3398], zoom: 11.0 },
  ],
  'Rajasthan': [
    { name: 'Jaipur', revenue: 1420000, orders: 95, dealers: 22, units_sold: 1380, share: 59.1, center: [75.7873, 26.9124], zoom: 10.5 },
    { name: 'Jodhpur', revenue: 680000, orders: 48, dealers: 11, units_sold: 690, share: 28.3, center: [73.0243, 26.2389], zoom: 10.5 },
    { name: 'Udaipur', revenue: 300000, orders: 22, dealers: 6, units_sold: 310, share: 12.5, center: [73.7125, 24.5854], zoom: 10.5 },
  ],
  'Maharashtra': [
    { name: 'Mumbai', revenue: 2450000, orders: 155, dealers: 42, units_sold: 2240, share: 54.4, center: [72.8777, 19.0760], zoom: 10.8 },
    { name: 'Pune', revenue: 1420000, orders: 90, dealers: 26, units_sold: 1300, share: 31.5, center: [73.8567, 18.5204], zoom: 10.8 },
    { name: 'Nagpur', revenue: 630000, orders: 42, dealers: 12, units_sold: 610, share: 14.0, center: [79.0882, 21.1458], zoom: 10.8 },
  ],
  'Gujarat': [
    { name: 'Ahmedabad', revenue: 1680000, orders: 105, dealers: 28, units_sold: 1520, share: 52.5, center: [72.5714, 23.0225], zoom: 10.8 },
    { name: 'Surat', revenue: 1050000, orders: 68, dealers: 19, units_sold: 990, share: 32.8, center: [72.8311, 21.1702], zoom: 10.8 },
    { name: 'Vadodara', revenue: 470000, orders: 32, dealers: 9, units_sold: 460, share: 14.7, center: [73.1812, 22.3072], zoom: 10.8 },
  ],
  'Delhi': [
    { name: 'Central Delhi', revenue: 1650000, orders: 90, dealers: 32, units_sold: 1300, share: 43.0, center: [77.2090, 28.6139], zoom: 11.5 },
    { name: 'South Delhi', revenue: 1250000, orders: 68, dealers: 24, units_sold: 980, share: 32.5, center: [77.2167, 28.5355], zoom: 11.5 },
    { name: 'North Delhi', revenue: 940000, orders: 52, dealers: 18, units_sold: 740, share: 24.5, center: [77.2100, 28.7000], zoom: 11.5 },
  ],
  'Haryana': [
    { name: 'Faridabad', revenue: 4137000, orders: 180, dealers: 25, units_sold: 2550, share: 42.0, center: [77.3307, 28.3630], zoom: 11.5 },
    { name: 'Gurugram', revenue: 3250000, orders: 140, dealers: 18, units_sold: 1980, share: 33.0, center: [76.9461, 28.3747], zoom: 11.2 },
    { name: 'Panipat', revenue: 1420000, orders: 60, dealers: 10, units_sold: 870, share: 14.4, center: [76.9635, 29.3909], zoom: 11.2 },
    { name: 'Rohtak', revenue: 1043000, orders: 40, dealers: 8, units_sold: 580, share: 10.6, center: [76.6066, 28.8955], zoom: 10.8 },
    { name: 'Karnal', revenue: 950000, orders: 35, dealers: 6, units_sold: 490, share: 9.6, center: [76.9905, 29.6857], zoom: 10.8 },
    { name: 'Hisar', revenue: 840000, orders: 30, dealers: 5, units_sold: 420, share: 8.5, center: [75.8237, 29.2367], zoom: 10.2 },
  ]
};

// District Salesman Mapping
const DISTRICT_SALESMAN_MAP: Record<string, string[]> = {
  'faridabad': ['RAVINDER KUMAR', 'Rahul'],
  'gurugram': ['ANKIT', 'Vikas'],
  'panipat': ['NALKA', 'Vikram'],
  'rohtak': ['SAURAV', 'Deepak'],
  'karnal': ['CHANDRA PRAKASH', 'Mohit'],
  'hisar': ['Amit', 'Suresh'],
  'ambala': ['Rajesh', 'Tarun'],
  'sonipat': ['Sunil', 'Praveen'],
  'noida': ['RAVINDER KUMAR', 'Sanjay'],
  'ghaziabad': ['ANKIT', 'Manish'],
  'kanpur': ['SAURAV', 'Rakesh'],
  'agra': ['CHANDRA PRAKASH', 'Verma'],
  'lucknow': ['NALKA', 'Vivek'],
  'varanasi': ['Pankaj', 'Alok'],
  'ludhiana': ['RAVINDER KUMAR', 'Gurpreet'],
  'amritsar': ['ANKIT', 'Harpreet'],
  'jalandhar': ['SAURAV', 'Jaswinder'],
  'patiala': ['CHANDRA PRAKASH', 'Simran'],
  'jaipur': ['RAVINDER KUMAR', 'Mahesh'],
  'jodhpur': ['ANKIT', 'Dinesh'],
  'udaipur': ['SAURAV', 'Ramesh'],
  'mumbai': ['RAVINDER KUMAR', 'Vijay'],
  'pune': ['ANKIT', 'Sachin'],
  'nagpur': ['SAURAV', 'Nitin'],
  'central delhi': ['RAVINDER KUMAR', 'Amit'],
  'south delhi': ['ANKIT', 'Kapil'],
  'north delhi': ['SAURAV', 'Deepak'],
};

export default function IndiaMapChart() {
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('india');
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [78.9629, 22.5937],
    zoom: 1
  });
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'ytd' | 'all'>('30d');

  // Context State
  const [indiaData, setIndiaData] = useState<any>(null);
  const [selectedState, setSelectedState] = useState<StateSalesData>(DEFAULT_STATE);
  const [stateDetail, setStateDetail] = useState<any>(null);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [cityDetail, setCityDetail] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  // Hover state for India level & State level dynamic summaries
  const [hoveredStateObj, setHoveredStateObj] = useState<StateSalesData | null>(null);
  const [hoveredCityObj, setHoveredCityObj] = useState<CityData | null>(null);

  // Hover state ONLY for individual district polygons
  const [hoveredDistrictCode, setHoveredDistrictCode] = useState<string | null>(null);
  const [hoveredDistrictName, setHoveredDistrictName] = useState<string | null>(null);

  // Multiplier for calculations based on timeRange
  const multiplier = useMemo(() => {
    if (timeRange === '90d') return 2.8;
    if (timeRange === 'ytd') return 7.2;
    if (timeRange === 'all') return 12.4;
    return 1.0;
  }, [timeRange]);

  // Fetch India Summary
  useEffect(() => {
    async function fetchIndia() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/geography/india?range=${timeRange}`);
        if (res.ok) {
          const json = await res.json();
          setIndiaData(json);
        }
      } catch (err) {
        console.warn('Failed to fetch India summary:', err);
      }
    }
    fetchIndia();
  }, [timeRange]);

  // Fetch State Details
  const fetchStateDetail = async (stName: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/geography/states/${stName}?range=${timeRange}`);
      if (res.ok) {
        const json = await res.json();
        setStateDetail(json);
        return json;
      }
    } catch (err) {
      console.warn('State fetch error:', err);
    }
    return null;
  };

  // Fetch City Details
  const fetchCityDetail = async (ctName: string, stName?: string) => {
    try {
      const parentSt = stName || selectedState.name;
      const res = await fetch(`${API_BASE_URL}/api/geography/cities/${ctName}?state_name=${parentSt}&range=${timeRange}`);
      if (res.ok) {
        const json = await res.json();
        setCityDetail(json);
        return json;
      }
    } catch (err) {
      console.warn('City fetch error:', err);
    }
    return null;
  };

  // Fetch Customer Details
  const fetchCustomerDetail = async (custId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/geography/customers/${custId}?range=${timeRange}`);
      if (res.ok) {
        const json = await res.json();
        setCustomerDetail(json);
        return json;
      }
    } catch (err) {
      console.warn('Customer fetch error:', err);
    }
    return null;
  };

  // Top States List
  const topStatesList = useMemo(() => {
    if (indiaData?.states) return indiaData.states.slice(0, 6);
    return [
      { name: 'Haryana', code: 'HR', revenue: 9850000, dealers: 586, orders: 420, share: 72.8, color: '#6366f1' },
      { name: 'Delhi', code: 'DL', revenue: 3840000, dealers: 105, orders: 195, share: 13.1, color: '#06b6d4' },
      { name: 'Uttar Pradesh', code: 'UP', revenue: 3450000, dealers: 102, orders: 180, share: 12.7, color: '#10b981' },
      { name: 'Rajasthan', code: 'RJ', revenue: 2400000, dealers: 45, orders: 110, share: 8.5, color: '#f59e0b' },
      { name: 'Punjab', code: 'PB', revenue: 2100000, dealers: 38, orders: 95, share: 7.2, color: '#eab308' },
      { name: 'Maharashtra', code: 'MH', revenue: 1800000, dealers: 32, orders: 80, share: 6.1, color: '#f43f5e' },
    ];
  }, [indiaData]);

  // ── DRILL DOWN HANDLERS ───────────────────────────────────────────────────

  // Handler 1: Select State
  const handleSelectState = async (stName: string) => {
    const cfg = STATE_PROJECTION_CONFIG[stName] || { code: 'IN', color: '#6366f1', center: [78.9629, 22.5937] as [number, number], zoom: 5.2 };
    const stObj: StateSalesData = {
      name: stName,
      code: cfg.code,
      revenue: stName === 'Haryana' ? 9850000 : stName === 'Uttar Pradesh' ? 3450000 : 3840000,
      dealers: stName === 'Haryana' ? 586 : stName === 'Uttar Pradesh' ? 102 : 105,
      orders: 420,
      share: stName === 'Haryana' ? 72.8 : stName === 'Uttar Pradesh' ? 12.7 : 13.1,
      color: cfg.color,
      center: cfg.center,
      zoom: cfg.zoom
    };

    setSelectedState(stObj);
    setDrillLevel('state');
    setSelectedCity(null);
    setSelectedCustomer(null);
    setHoveredStateObj(null);
    setHoveredCityObj(null);
    setHoveredDistrictCode(null);
    setHoveredDistrictName(null);

    // Smooth camera transition to selected state center & zoom
    setPosition({ coordinates: cfg.center, zoom: cfg.zoom });

    await fetchStateDetail(stName);
  };

  // Handler 2: Click District Polygon on State Map (Updates Right Panel & Bottom Bar with District Breakdown!)
  const handleSelectCity = async (ctName: string, coords?: [number, number]) => {
    const dtInfo = (DISTRICT_CENTERS_DATA as any)[ctName.toLowerCase()];
    const dtCenter: [number, number] = coords || (dtInfo ? dtInfo.center : selectedState.center);
    const dtZoom: number = dtInfo ? dtInfo.zoom : selectedState.zoom;

    const knownMatch = activeCities.find((c: any) => c.name.toLowerCase() === ctName.toLowerCase());
    const hash = ctName.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

    const cityObj: CityData = knownMatch || {
      name: ctName,
      revenue: 450000 + (hash % 14) * 95000,
      orders: 28 + (hash % 9) * 7,
      dealers: 5 + (hash % 6) * 3,
      units_sold: (28 + (hash % 9) * 7) * 18,
      share: 3.5 + (hash % 6) * 1.5,
      center: dtCenter,
      zoom: dtZoom
    };

    setSelectedCity(cityObj);
    setSelectedCustomer(null);

    // Keep map at state level, updating right panel & bottom bar contextually
    await fetchCityDetail(ctName, selectedState.name);
  };

  // Handler 3: Click Customer Account (Updates Right Panel with Customer Breakdown)
  const handleSelectCustomer = async (cust: CustomerData) => {
    setSelectedCustomer(cust);
    await fetchCustomerDetail(cust.id || cust.name);
  };

  // Breadcrumb / Back Handler
  const handleBreadcrumbClick = (targetLevel: DrillLevel | 'district') => {
    setHoveredStateObj(null);
    setHoveredCityObj(null);
    setHoveredDistrictCode(null);
    setHoveredDistrictName(null);
    if (targetLevel === 'india') {
      setDrillLevel('india');
      setSelectedCity(null);
      setSelectedCustomer(null);
      setPosition({ coordinates: [78.9629, 22.5937], zoom: 1 });
    } else if (targetLevel === 'state') {
      setDrillLevel('state');
      setSelectedCity(null);
      setSelectedCustomer(null);
      const cfg = STATE_PROJECTION_CONFIG[selectedState.name] || { center: [76.0856, 29.0588], zoom: 5.2 };
      setPosition({ coordinates: cfg.center, zoom: cfg.zoom });
    }
  };

  // Map Controls
  function handleZoomIn() {
    setPosition(pos => ({ ...pos, zoom: Math.min(pos.zoom + 0.8, 25) }));
  }

  function handleZoomOut() {
    setPosition(pos => ({ ...pos, zoom: Math.max(pos.zoom - 0.8, 1) }));
  }

  function handleReset() {
    handleBreadcrumbClick('india');
  }

  // Active cities/districts list for State level (Strictly state-matched!)
  const activeCities = useMemo(() => {
    if (stateDetail?.cities && stateDetail?.state_name === selectedState.name) {
      return stateDetail.cities;
    }
    const fallbackList = FALLBACK_CITIES_BY_STATE[selectedState.name];
    if (fallbackList) return fallbackList;

    return [
      { name: `${selectedState.name} District 1`, revenue: 2100000, orders: 120, dealers: 18, units_sold: 1550, share: 50.0, center: selectedState.center, zoom: 10.5 },
      { name: `${selectedState.name} District 2`, revenue: 1400000, orders: 80, dealers: 12, units_sold: 980, share: 30.0, center: selectedState.center, zoom: 10.5 }
    ];
  }, [stateDetail, selectedState]);

  // Active customer list for City level (Dynamically synchronized with district hover!)
  const activeCustomers = useMemo(() => {
    const currentCity = hoveredCityObj || selectedCity;
    const cityName = currentCity?.name || 'Faridabad';

    if (cityDetail?.customer_list && cityDetail?.city_name?.toLowerCase() === cityName.toLowerCase()) {
      return cityDetail.customer_list;
    }

    const dtKey = cityName.toLowerCase();
    const reps = DISTRICT_SALESMAN_MAP[dtKey] || ['RAVINDER KUMAR', 'ANKIT'];

    const centerLng = currentCity?.center[0] || 77.3307;
    const centerLat = currentCity?.center[1] || 28.3630;
    const hash = cityName.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

    return [
      { id: `CUST-${hash}-1`, name: `${cityName} Metal Works`, city: cityName, state: selectedState.name, salesman: reps[0], revenue: 482000 + (hash % 7) * 45000, orders: 64, avg_order: 7531, units_sold: 492, coords: [centerLng - 0.005, centerLat + 0.004] as [number, number] },
      { id: `CUST-${hash}-2`, name: `Apex Hardware ${cityName}`, city: cityName, state: selectedState.name, salesman: reps[1] || reps[0], revenue: 395000 + (hash % 5) * 32000, orders: 52, avg_order: 7596, units_sold: 410, coords: [centerLng + 0.006, centerLat - 0.005] as [number, number] },
      { id: `CUST-${hash}-3`, name: `Gupta Sanitary Store`, city: cityName, state: selectedState.name, salesman: reps[0], revenue: 310000 + (hash % 4) * 28000, orders: 41, avg_order: 7560, units_sold: 320, coords: [centerLng - 0.004, centerLat - 0.006] as [number, number] },
      { id: `CUST-${hash}-4`, name: `RK Traders ${cityName}`, city: cityName, state: selectedState.name, salesman: reps[1] || reps[0], revenue: 260000 + (hash % 6) * 22000, orders: 34, avg_order: 7647, units_sold: 280, coords: [centerLng + 0.005, centerLat + 0.007] as [number, number] },
    ];
  }, [cityDetail, hoveredCityObj, selectedCity, selectedState]);

  // Active top products for Customer level
  const activeTopProducts: TopProductData[] = useMemo(() => {
    if (customerDetail?.top_products) return customerDetail.top_products;
    return [
      { name: '1"x6" BRASS CHAAL NIPPLE - TARUN', quantity: Math.round(180 * multiplier), revenue: 142000 * multiplier },
      { name: 'BRASS CONCEALED VALVE 15MM', quantity: Math.round(140 * multiplier), revenue: 118000 * multiplier },
      { name: 'HEAVY DUTY CP TAPS & FITTINGS', quantity: Math.round(110 * multiplier), revenue: 95000 * multiplier },
      { name: 'STAINLESS STEEL SINK COUPLING', quantity: Math.round(95 * multiplier), revenue: 72000 * multiplier },
      { name: 'CHROME EXTENSION NIPPLE 1/2"', quantity: Math.round(80 * multiplier), revenue: 55000 * multiplier },
    ];
  }, [customerDetail, multiplier]);

  return (
    <div
      className="panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '520px',
        height: 'auto',
        width: '100%',
        boxSizing: 'border-box',
        padding: '1.25rem 1.5rem',
        gap: '0.75rem',
        background: '#0b0f19',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
      }}
    >
      {/* ── Top Header, Interactive Breadcrumb & Toolbar Controls ────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} className="text-accent" />
            <span>India Regional Revenue & Dealer Distribution Map</span>
          </div>

          {/* Clean Interactive Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', marginTop: '4px', color: '#94a3b8' }}>
            <span
              onClick={() => handleBreadcrumbClick('india')}
              style={{
                color: drillLevel === 'india' ? '#f8fafc' : '#6366f1',
                fontWeight: drillLevel === 'india' ? 800 : 600,
                cursor: 'pointer',
                textDecoration: drillLevel === 'india' ? 'none' : 'underline'
              }}
            >
              India
            </span>

            {(drillLevel === 'state' || drillLevel === 'city' || drillLevel === 'customer') && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <span
                  onClick={() => handleBreadcrumbClick('state')}
                  style={{
                    color: drillLevel === 'state' ? '#f8fafc' : '#6366f1',
                    fontWeight: drillLevel === 'state' ? 800 : 600,
                    cursor: 'pointer',
                    textDecoration: drillLevel === 'state' ? 'none' : 'underline'
                  }}
                >
                  {selectedState.name}
                </span>
              </>
            )}

            {(drillLevel === 'city' || drillLevel === 'customer') && selectedCity && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <span
                  onClick={() => handleBreadcrumbClick('city')}
                  style={{
                    color: drillLevel === 'city' ? '#f8fafc' : '#6366f1',
                    fontWeight: drillLevel === 'city' ? 800 : 600,
                    cursor: 'pointer',
                    textDecoration: drillLevel === 'city' ? 'none' : 'underline'
                  }}
                >
                  {selectedCity.name}
                </span>
              </>
            )}

            {drillLevel === 'customer' && selectedCustomer && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <span style={{ color: '#f8fafc', fontWeight: 800 }}>
                  {selectedCustomer.name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Time Range Selector Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', padding: '5px 12px', borderRadius: '6px' }}>
            <Calendar size={13} className="text-accent" />
            <span>Range: <strong>{timeRange === '30d' ? 'Last 30 Days' : timeRange === '90d' ? 'Last 90 Days' : timeRange === 'ytd' ? 'Year to Date' : 'All Time'}</strong></span>
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.75rem',
              padding: '5px 10px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year to Date (YTD)</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* ── Main Card Layout (Preserved Exactly: Left Map, Right Panel) ────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        minHeight: '380px',
        width: '100%',
        gap: '1.5rem',
        boxSizing: 'border-box'
      }}>

        {/* ── LEFT SIDE: True Vector GeoJSON Map with Smooth Camera Zoom ─────── */}
        <div style={{
          flex: '1 1 45%',
          height: '360px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '280px',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: '#070a12',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {/* Zoom & Reset Overlay Buttons */}
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 10 }}>
            <button
              onClick={handleZoomIn}
              style={{ width: '28px', height: '28px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleZoomOut}
              style={{ width: '28px', height: '28px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleReset}
              style={{ width: '28px', height: '28px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Reset Zoom to India"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 1000, center: [78.9629, 22.5937] }}
            style={{ width: '100%', height: '100%', transition: 'all 0.5s ease-in-out' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={setPosition}
            >
              {/* LEVEL 1: INDIA COUNTRY MAP (Renders ONLY clean State Boundaries from india-states-clean.geojson) */}
              {drillLevel === 'india' && (
                <Geographies geography={INDIA_STATES_GEO_URL}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo: any, idx: number) => {
                      const stName = geo.properties.st_nm || geo.properties.name || '';
                      const stCfg = STATE_PROJECTION_CONFIG[stName];
                      const isOperatingState = Boolean(stCfg);

                      const isHoveredThisState = hoveredStateObj ? (hoveredStateObj.name === stName || (stName === 'NCT of Delhi' && hoveredStateObj.name === 'Delhi')) : false;
                      const isSelectedThisState = selectedState.name === stName || (stName === 'NCT of Delhi' && selectedState.name === 'Delhi');

                      // Dynamic highlight: If a state is hovered, highlight ONLY the hovered state! Otherwise highlight selected state.
                      const isHighlighted = hoveredStateObj ? isHoveredThisState : isSelectedThisState;
                      const fillColor = isOperatingState ? stCfg.color : '#1e293b';

                      return (
                        <Geography
                          key={`clean-state-${geo.rsmKey || idx}`}
                          geography={geo}
                          onMouseEnter={() => {
                            // Only update summary for operating states!
                            if (isOperatingState) {
                              const stObj: StateSalesData = {
                                name: stName,
                                code: stCfg.code,
                                revenue: stName === 'Haryana' ? 9850000 : stName === 'Uttar Pradesh' ? 3450000 : 3840000,
                                dealers: stName === 'Haryana' ? 586 : stName === 'Uttar Pradesh' ? 102 : 105,
                                orders: 420,
                                share: stName === 'Haryana' ? 72.8 : stName === 'Uttar Pradesh' ? 12.7 : 13.1,
                                color: stCfg.color,
                                center: stCfg.center,
                                zoom: stCfg.zoom
                              };
                              setHoveredStateObj(stObj);
                            }
                          }}
                          onMouseLeave={() => {
                            // Keep previously hovered state summary intact unless moving out
                          }}
                          onClick={() => {
                            if (isOperatingState) {
                              handleSelectState(stName);
                            }
                          }}
                          style={{
                            default: {
                              fill: fillColor,
                              fillOpacity: isOperatingState ? (isHighlighted ? 0.95 : 0.65) : 0.35,
                              filter: isOperatingState && isHighlighted ? 'brightness(1.4) saturate(1.2)' : 'none',
                              stroke: isHighlighted ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
                              strokeWidth: isHighlighted ? 1.2 : 0.4,
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none',
                              transition: 'all 0.25s ease'
                            },
                            hover: {
                              fill: fillColor,
                              fillOpacity: isOperatingState ? 1.0 : 0.4,
                              filter: isOperatingState ? 'brightness(1.55) saturate(1.25)' : 'none',
                              stroke: isOperatingState ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
                              strokeWidth: isOperatingState ? 1.2 : 0.4,
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none',
                              cursor: isOperatingState ? 'pointer' : 'not-allowed'
                            },
                            pressed: {
                              fill: fillColor,
                              filter: isOperatingState ? 'brightness(1.7)' : 'none',
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none'
                            }
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              )}

              {/* LEVEL 2: STATE VIEW (Color-coding ONLY active operating districts, non-operating districts remain dark neutral!) */}
              {drillLevel === 'state' && (
                <Geographies geography={INDIA_DISTRICTS_GEO_URL}>
                  {({ geographies }: { geographies: any[] }) => {
                    const stTarget = selectedState.name === 'Delhi' ? ['Delhi', 'NCT of Delhi'] : [selectedState.name];
                    // STRICT FILTER: Exclude whole-state boundary features (which lack a valid district property)
                    const stateDistrictsGeos = geographies.filter((g: any) => {
                      const matchesState = stTarget.includes(g.properties.st_nm);
                      const hasDistrict = Boolean(g.properties.district && g.properties.district !== 'None');
                      return matchesState && hasDistrict;
                    });

                    // Build operating district map from activeCities
                    const operatingMap = new Map<string, { city: any; color: string }>();
                    activeCities.forEach((ct: any, cIdx: number) => {
                      const color = INDEPENDENT_DISTRICT_PALETTE[cIdx % INDEPENDENT_DISTRICT_PALETTE.length];
                      operatingMap.set(ct.name.toLowerCase(), { city: ct, color });
                    });

                    return stateDistrictsGeos.map((geo: any, idx: number) => {
                      const stName = geo.properties.st_nm || '';
                      const dtName = geo.properties.district;
                      const dtCode = geo.properties.dt_code || `${stName}-${dtName}-${idx}`;

                      const opInfo = operatingMap.get(dtName?.toLowerCase());
                      const isOperatingDistrict = Boolean(opInfo);
                      const districtColor = opInfo ? opInfo.color : '#1e293b';

                      const isHoveredThisDistrict = hoveredDistrictCode === dtCode;

                      return (
                        <Geography
                          key={`state-dt-${dtCode}`}
                          geography={geo}
                          onMouseEnter={() => {
                            if (isOperatingDistrict && opInfo) {
                              setHoveredDistrictCode(dtCode);
                              setHoveredDistrictName(dtName);
                              const dtInfo = (DISTRICT_CENTERS_DATA as any)[dtName.toLowerCase()];
                              const dtObj: CityData = {
                                name: opInfo.city.name,
                                revenue: opInfo.city.revenue,
                                orders: opInfo.city.orders,
                                dealers: opInfo.city.dealers,
                                units_sold: opInfo.city.units_sold || 2550,
                                share: opInfo.city.share || 42.0,
                                center: dtInfo ? dtInfo.center : selectedState.center,
                                zoom: dtInfo ? dtInfo.zoom : selectedState.zoom
                              };
                              setHoveredCityObj(dtObj);
                              fetchCityDetail(dtName, selectedState.name);
                            }
                          }}
                          onMouseLeave={() => {
                            if (isOperatingDistrict) {
                              setHoveredDistrictCode(null);
                              setHoveredDistrictName(null);
                              setHoveredCityObj(null);
                            }
                          }}
                          style={{
                            default: {
                              fill: districtColor,
                              fillOpacity: isOperatingDistrict ? (isHoveredThisDistrict ? 1.0 : 0.85) : 0.25,
                              filter: isOperatingDistrict && isHoveredThisDistrict ? 'brightness(1.55) saturate(1.25)' : 'none',
                              stroke: isOperatingDistrict ? (isHoveredThisDistrict ? '#ffffff' : 'rgba(15, 23, 42, 0.5)') : 'rgba(255, 255, 255, 0.08)',
                              strokeWidth: isOperatingDistrict ? (isHoveredThisDistrict ? 1.0 : 0.4) : 0.3,
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none',
                              transition: 'all 0.2s ease'
                            },
                            hover: {
                              fill: districtColor,
                              fillOpacity: isOperatingDistrict ? 1.0 : 0.25,
                              filter: isOperatingDistrict ? 'brightness(1.55) saturate(1.25)' : 'none',
                              stroke: isOperatingDistrict ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                              strokeWidth: isOperatingDistrict ? 1.0 : 0.3,
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none',
                              cursor: isOperatingDistrict ? 'pointer' : 'not-allowed'
                            },
                            pressed: {
                              fill: districtColor,
                              filter: isOperatingDistrict ? 'brightness(1.8)' : 'none',
                              vectorEffect: 'non-scaling-stroke',
                              outline: 'none'
                            }
                          }}
                        />
                      );
                    });
                  }}
                </Geographies>
              )}
            </ZoomableGroup>
          </ComposableMap>

          {/* Compact Hover Tooltip Overlay for State level City/District Polygons */}
          {drillLevel === 'state' && hoveredDistrictName && hoveredDistrictName !== 'None' && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid #6366f1',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                boxShadow: '0 8px 16px rgba(0,0,0,0.7)',
                pointerEvents: 'none',
                zIndex: 20
              }}
            >
              📍 Operating District: <span style={{ color: '#6366f1' }}>{hoveredDistrictName}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDE: Context-Sensitive Information Panel ─────────────── */}
        <div style={{
          flex: '1 1 45%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '0.85rem',
          boxSizing: 'border-box',
          minWidth: '280px',
          maxWidth: '100%'
        }}>
          
          <div
            className="fade-in"
            style={{
              padding: '1.2rem',
              background: '#131b2e',
              borderRadius: '14px',
              border: `1.5px solid ${selectedCustomer ? '#10b981' : hoveredCityObj ? '#6366f1' : (hoveredStateObj?.color || selectedState.color)}`,
              boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${selectedCustomer ? '#10b98130' : hoveredCityObj ? '#6366f130' : (hoveredStateObj?.color || selectedState.color) + '30'}`
            }}
          >
            {/* Context Title Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {drillLevel === 'india' && !hoveredStateObj && <MapPin size={18} style={{ color: selectedState.color }} />}
                {drillLevel === 'india' && hoveredStateObj && <MapPin size={18} style={{ color: hoveredStateObj.color }} />}
                {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && <MapPin size={18} style={{ color: selectedState.color }} />}
                {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && <Store size={18} style={{ color: '#6366f1' }} />}
                {selectedCustomer && <UserCheck size={18} style={{ color: '#10b981' }} />}

                <span>
                  {drillLevel === 'india' && !hoveredStateObj && 'India (IN)'}
                  {drillLevel === 'india' && hoveredStateObj && `${hoveredStateObj.name} (${hoveredStateObj.code})`}
                  {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && `${selectedState.name} (${selectedState.code})`}
                  {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && `${hoveredCityObj.name} District (${selectedState.name})`}
                  {selectedCustomer && `${selectedCustomer.name} (${selectedState.name})`}
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: selectedCustomer ? '#10b98125' : hoveredCityObj ? '#6366f125' : hoveredStateObj ? '#f59e0b25' : `${selectedState.color}30`,
                  color: selectedCustomer ? '#10b981' : hoveredCityObj ? '#6366f1' : hoveredStateObj ? '#f59e0b' : selectedState.color,
                  border: `1px solid ${selectedCustomer ? '#10b98160' : hoveredCityObj ? '#6366f160' : hoveredStateObj ? '#f59e0b60' : selectedState.color + '60'}`
                }}
              >
                {drillLevel === 'india' && !hoveredStateObj && 'National Summary'}
                {drillLevel === 'india' && hoveredStateObj && 'State Preview'}
                {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && 'State Territory Overview'}
                {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && 'District Hover Summary'}
                {selectedCustomer && 'Key Account Breakdown'}
              </span>
            </div>

            {/* Metrics Grid Synchronized with Hover Context */}
            <div>
              
              {/* Level 1: INDIA (National Summary when not hovering; State Preview when hovering) */}
              {drillLevel === 'india' && !hoveredStateObj && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.6rem' }}>
                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Gross Sales</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      ₹{((18370000 * multiplier) / 10000000).toFixed(2)}Cr
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Orders</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {Math.round(920 * multiplier)} Orders
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Active Outlets</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>
                      804 Dealers
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Active States</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      11 States
                    </div>
                  </div>
                </div>
              )}

              {/* Level 1 HOVER: State Preview Metrics */}
              {drillLevel === 'india' && hoveredStateObj && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.6rem' }}>
                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Gross Sales</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      ₹{((hoveredStateObj.revenue * multiplier) / 100000).toFixed(1)}L
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>National Share</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {hoveredStateObj.share}%
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Active Outlets</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>
                      {hoveredStateObj.dealers} Dealers
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Orders Handled</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {Math.round(hoveredStateObj.orders * multiplier)} Orders
                    </div>
                  </div>
                </div>
              )}

              {/* Level 2: STATE OVERVIEW (No district hovered) */}
              {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.6rem' }}>
                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Gross Sales</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      ₹{((selectedState.revenue * multiplier) / 100000).toFixed(1)}L
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>National Share</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      {selectedState.share}%
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Active Outlets</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>
                      {selectedState.dealers} Dealers
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Orders Handled</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {Math.round(selectedState.orders * multiplier)} Orders
                    </div>
                  </div>
                </div>
              )}

              {/* Level 2 HOVER: DISTRICT SUMMARY (District hovered) */}
              {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '0.6rem' }}>
                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Gross Sales</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      ₹{((hoveredCityObj.revenue * multiplier) / 100000).toFixed(1)}L
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Lead Salesman</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeCustomers[0]?.salesman || 'RAVINDER KUMAR'}
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Outlets / Dealers</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>
                      {hoveredCityObj.dealers || 25} Outlets
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Orders</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {Math.round(hoveredCityObj.orders * multiplier)} Orders
                    </div>
                  </div>
                </div>
              )}

              {/* CUSTOMER BREAKDOWN (Customer account selected in bottom list) */}
              {selectedCustomer && (
                <>
                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Gross Sales</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#6366f1', marginTop: '2px' }}>
                      ₹{((selectedCustomer.revenue * multiplier) / 100000).toFixed(2)}L
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Orders</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                      {Math.round(selectedCustomer.orders * multiplier)}
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Average Order</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                      ₹{Math.round(selectedCustomer.avg_order).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Salesman</div>
                    <div style={{ fontSize: '1.0rem', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>
                      {selectedCustomer.salesman || 'Rahul'}
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* ── BOTTOM CONTRIBUTION LIST (Adapts dynamically on state vs district hover) ──── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>
              {drillLevel === 'india' && !hoveredStateObj && 'Top State Territory Contributions:'}
              {drillLevel === 'india' && hoveredStateObj && `Top Districts in ${hoveredStateObj.name} Preview:`}
              {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && `Top Districts in ${selectedState.name}:`}
              {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && `Top Accounts in ${hoveredCityObj.name} (Share %):`}
              {selectedCustomer && `Top Products Purchased by ${selectedCustomer.name}:`}
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              
              {/* Level 1: Top States */}
              {drillLevel === 'india' && !hoveredStateObj && topStatesList.map((st: any) => (
                <button
                  key={st.code || st.name}
                  type="button"
                  onClick={() => handleSelectState(st.name)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${st.color || '#6366f1'}70`,
                    background: selectedState.code === st.code ? `${st.color || '#6366f1'}35` : 'rgba(15, 23, 42, 0.6)',
                    color: '#ffffff',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st.name} ({st.share || 72.8}%)
                </button>
              ))}

              {/* Level 2 (State Hovered/Active, NO District Hovered): Cities by contribution amount in Lacs! */}
              {drillLevel === 'state' && !hoveredCityObj && !selectedCustomer && activeCities.map((ct: any) => (
                <button
                  key={ct.name}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid #6366f170`,
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: '#ffffff',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'default',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {ct.name} (₹{((ct.revenue * multiplier) / 100000).toFixed(1)}L)
                </button>
              ))}

              {/* Level 2 (District Hovered): Customers by share percentage %! */}
              {drillLevel === 'state' && hoveredCityObj && !selectedCustomer && (() => {
                const totalRev = activeCustomers.reduce((sum: number, c: any) => sum + (c.revenue || 1), 0);
                return activeCustomers.map((cust: any) => {
                  const sharePct = totalRev > 0 ? (((cust.revenue || 1) / totalRev) * 100).toFixed(1) : '25.0';
                  return (
                    <button
                      key={cust.id || cust.name}
                      type="button"
                      onClick={() => handleSelectCustomer(cust)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: `1px solid #10b98170`,
                        background: (selectedCustomer as any)?.id === cust?.id ? '#10b98135' : 'rgba(15, 23, 42, 0.6)',
                        color: '#ffffff',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      📍 {cust.name} ({sharePct}%)
                    </button>
                  );
                });
              })()}

              {/* Customer Top Products */}
              {selectedCustomer && activeTopProducts.map((p: any) => (
                <button
                  key={p.name}
                  type="button"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid #c084fc70`,
                    background: 'rgba(15, 23, 42, 0.6)',
                    color: '#ffffff',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'default',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.name.split(' - ')[0]} (₹{(p.revenue / 1000).toFixed(0)}k)
                </button>
              ))}

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
