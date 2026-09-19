'use client';

import React, { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

// Local world-atlas served from /public — no external network request
const GEO_URL = '/world-110m.json';

// India numeric code in world-atlas TopoJSON
const INDIA_ID = 356;

// City revenue data
const CITIES = [
  { name: 'Delhi NCR',  lat: 28.6139, lng: 77.2090, revenue: 14.5, dealers: 48, color: '#ef4444' },
  { name: 'Mumbai',     lat: 19.0760, lng: 72.8777, revenue: 11.2, dealers: 36, color: '#f97316' },
  { name: 'Bengaluru',  lat: 12.9716, lng: 77.5946, revenue:  9.8, dealers: 29, color: '#f97316' },
  { name: 'Hyderabad',  lat: 17.3850, lng: 78.4867, revenue:  7.4, dealers: 22, color: '#f59e0b' },
  { name: 'Chennai',    lat: 13.0827, lng: 80.2707, revenue:  6.5, dealers: 19, color: '#f59e0b' },
  { name: 'Kolkata',    lat: 22.5726, lng: 88.3639, revenue:  5.8, dealers: 17, color: '#3b82f6' },
  { name: 'Pune',       lat: 18.5204, lng: 73.8567, revenue:  4.6, dealers: 14, color: '#3b82f6' },
  { name: 'Ahmedabad',  lat: 23.0225, lng: 72.5714, revenue:  4.1, dealers: 13, color: '#3b82f6' },
  { name: 'Jaipur',     lat: 26.9124, lng: 75.7873, revenue:  3.2, dealers: 10, color: '#60a5fa' },
  { name: 'Lucknow',    lat: 26.8467, lng: 80.9462, revenue:  2.9, dealers:  9, color: '#60a5fa' },
  { name: 'Surat',      lat: 21.1702, lng: 72.8311, revenue:  2.5, dealers:  8, color: '#60a5fa' },
  { name: 'Nagpur',     lat: 21.1458, lng: 79.0882, revenue:  2.1, dealers:  6, color: '#60a5fa' },
];

// State centroid labels
const STATES = [
  { name: 'Rajasthan',      lat: 27.02,  lng: 74.22 },
  { name: 'Gujarat',        lat: 22.26,  lng: 71.19 },
  { name: 'Punjab',         lat: 31.15,  lng: 75.34 },
  { name: 'Haryana',        lat: 29.06,  lng: 76.09 },
  { name: 'Uttar Pradesh',  lat: 26.85,  lng: 80.95 },
  { name: 'Maharashtra',    lat: 19.75,  lng: 75.71 },
  { name: 'Karnataka',      lat: 15.32,  lng: 75.71 },
  { name: 'Tamil Nadu',     lat: 11.13,  lng: 78.66 },
  { name: 'Telangana',      lat: 18.11,  lng: 79.02 },
  { name: 'West Bengal',    lat: 22.99,  lng: 87.85 },
  { name: 'Madhya Pradesh', lat: 22.97,  lng: 78.66 },
  { name: 'Bihar',          lat: 25.10,  lng: 85.31 },
  { name: 'Odisha',         lat: 20.95,  lng: 84.50 },
  { name: 'Kerala',         lat: 10.85,  lng: 76.27 },
  { name: 'Andhra Pradesh', lat: 15.91,  lng: 79.74 },
  { name: 'Assam',          lat: 26.20,  lng: 92.94 },
  { name: 'Jharkhand',      lat: 23.61,  lng: 85.28 },
];

function getRadius(revenue: number): number {
  return Math.max(5, Math.round((revenue / 14.5) * 20));
}

interface City {
  name: string;
  lat: number;
  lng: number;
  revenue: number;
  dealers: number;
  color: string;
}

export default function IndiaRevenueMap() {
  const [hovered, setHovered] = useState<City | null>(null);
  const [tooltipXY, setTooltipXY] = useState({ x: 0, y: 0 });

  const totalRevenue = CITIES.reduce((s, c) => s + c.revenue, 0);
  const totalDealers = CITIES.reduce((s, c) => s + c.dealers, 0);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            India Revenue Map
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            State regions · City revenue bubbles · Hover for drill-down
          </p>
          <div style={{ marginTop: '6px', display: 'inline-flex', gap: '4px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
            {CITIES.length} Cities &nbsp;|&nbsp; Total &#8377;{totalRevenue.toFixed(1)}M &nbsp;|&nbsp; {totalDealers} Dealers
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.72rem', alignItems: 'center' }}>
          {[
            { label: '> ₹10M',  color: '#ef4444', size: 12 },
            { label: '₹7–10M', color: '#f97316', size: 10 },
            { label: '₹4–7M',  color: '#f59e0b', size: 9  },
            { label: '< ₹4M',  color: '#60a5fa', size: 7  },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: l.size, height: l.size, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', background: '#0d1526', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82.5, 22], scale: 900 }}
          width={900}
          height={520}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={6} center={[82.5, 22]}>
            {/* Render ONLY India */}
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: unknown[] }) =>
                geographies
                  .filter((geo: unknown) => (geo as { id: number }).id === INDIA_ID)
                  .map((geo: unknown) => (
                    <Geography
                      key={(geo as { rsmKey: string }).rsmKey}
                      geography={geo as object}
                      fill="#1a2e4a"
                      stroke="#3b5a7a"
                      strokeWidth={0.8}
                      style={{
                        default: { outline: 'none' },
                        hover:   { fill: '#1e3455', outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  ))
              }
            </Geographies>

            {/* State label markers */}
            {STATES.map(s => (
              <Marker key={s.name} coordinates={[s.lng, s.lat]}>
                <text
                  textAnchor="middle"
                  style={{
                    fontSize: '6px',
                    fill: '#4a7090',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  {s.name}
                </text>
              </Marker>
            ))}

            {/* City revenue bubbles */}
            {CITIES.map(city => {
              const r = getRadius(city.revenue);
              return (
                <Marker
                  key={city.name}
                  coordinates={[city.lng, city.lat]}
                  onMouseEnter={(e: React.MouseEvent<SVGElement>) => {
                    setHovered(city);
                    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
                    if (rect) setTooltipXY({ x: e.nativeEvent.clientX - rect.left, y: e.nativeEvent.clientY - rect.top });
                  }}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Glow ring */}
                  <circle r={r + 5} fill={city.color} fillOpacity={0.1} stroke={city.color} strokeOpacity={0.2} strokeWidth={0.8} />
                  {/* Bubble */}
                  <circle r={r} fill={city.color} fillOpacity={0.85} stroke="#ffffff" strokeWidth={0.7} style={{ cursor: 'pointer' }} />
                  {/* City label */}
                  <text
                    textAnchor="middle"
                    y={r + 9}
                    style={{
                      fontSize: '5.5px',
                      fill: '#94a3b8',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 700,
                      pointerEvents: 'none',
                    }}
                  >
                    {city.name}
                  </text>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute',
            left: tooltipXY.x + 14,
            top: tooltipXY.y - 14,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '10px 14px',
            minWidth: '165px',
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: '0.87rem', fontWeight: 700, color: '#60a5fa', marginBottom: '6px' }}>{hovered.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
              <span style={{ color: '#94a3b8' }}>Revenue</span>
              <span style={{ color: '#10b981', fontWeight: 700 }}>&#8377;{hovered.revenue}M</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
              <span style={{ color: '#94a3b8' }}>Dealers</span>
              <span style={{ color: '#f59e0b', fontWeight: 700 }}>{hovered.dealers}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
              <span style={{ color: '#94a3b8' }}>Share</span>
              <span style={{ color: '#c084fc', fontWeight: 700 }}>{((hovered.revenue / totalRevenue) * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: '0.67rem', color: '#3a5070' }}>
          Scroll to zoom · Drag to pan
        </div>
      </div>

      {/* City summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {CITIES.map(city => (
          <div key={city.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 9px', fontSize: '0.73rem' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: city.color, display: 'inline-block' }} />
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{city.name}</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>&#8377;{city.revenue}M</span>
          </div>
        ))}
      </div>
    </div>
  );
}
