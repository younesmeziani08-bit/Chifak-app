import { useEffect, useMemo, useState } from 'react';

/**
 * Carte interactive des wilayas d'Algérie.
 * - Charge /algeria-wilayas.geojson (contours des 48 wilayas).
 * - Surligne + zoome sur la wilaya sélectionnée (par code).
 * - Si un `pin` (lat/lng) est fourni (daïra/commune), pose un repère et zoome dessus.
 */

const VBW = 1000;
const VBH = 640;

type Ring = [number, number][];

interface Shape {
  name: string;
  norm: string;
  code: number | null;
  d: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface MapData {
  shapes: Shape[];
  project: (lon: number, lat: number) => [number, number];
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/wilaya of|province|[^a-z0-9]/g, '')
    .trim();
}

export default function AlgeriaMap({
  selectedCode,
  selectedNames = [],
  pin = null,
  pinScale = 16,
}: {
  selectedCode?: number | null;
  selectedNames?: string[];
  pin?: { lat: number; lng: number } | null;
  pinScale?: number;
}) {
  const [data, setData] = useState<MapData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/algeria-wilayas.geojson')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((geo) => alive && setData(buildData(geo)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const selectedNorms = useMemo(() => selectedNames.map(normalize).filter(Boolean), [selectedNames]);

  const selected = useMemo(() => {
    if (!data) return null;
    if (selectedCode != null) {
      const byCode = data.shapes.find((s) => s.code === selectedCode);
      if (byCode) return byCode;
    }
    if (selectedNorms.length === 0) return null;
    return data.shapes.find((s) => selectedNorms.some((n) => n && (s.norm === n || s.norm.includes(n) || n.includes(s.norm)))) || null;
  }, [data, selectedCode, selectedNorms]);

  const pinXY = useMemo(() => (pin && data ? data.project(pin.lng, pin.lat) : null), [pin, data]);

  const transform = useMemo(() => {
    if (pinXY) {
      const [x, y] = pinXY;
      const s = pinScale;
      return `translate(${(VBW / 2 - x * s).toFixed(1)},${(VBH / 2 - y * s).toFixed(1)}) scale(${s})`;
    }
    if (selected) {
      const { x0, y0, x1, y1 } = selected.bbox;
      const w = Math.max(x1 - x0, 1);
      const h = Math.max(y1 - y0, 1);
      const scale = Math.min((VBW * 0.72) / w, (VBH * 0.72) / h);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      return `translate(${(VBW / 2 - cx * scale).toFixed(1)},${(VBH / 2 - cy * scale).toFixed(1)}) scale(${scale.toFixed(3)})`;
    }
    return 'translate(0,0) scale(1)';
  }, [pinXY, pinScale, selected]);

  if (failed) {
    return (
      <div className="w-full h-72 sm:h-96 lg:h-[460px] rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-center p-6">
        <p className="text-sm text-blue-700/80">
          Carte des wilayas — ajoutez le fichier <code>public/algeria-wilayas.geojson</code> pour l'afficher.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full h-72 sm:h-96 lg:h-[460px]" role="img" aria-label="Carte des wilayas d'Algérie">
        <rect x="0" y="0" width={VBW} height={VBH} fill="#f1f7fe" />
        {data && (
          <g style={{ transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }} transform={transform}>
            {data.shapes.map((s) => {
              const isSel = selected === s;
              return (
                <path
                  key={s.name}
                  d={s.d}
                  fill={isSel ? '#07008F' : '#C9DEFB'}
                  stroke={isSel ? '#00264c' : '#9db8d0'}
                  strokeWidth={isSel ? 1.4 : 0.6}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        )}

        {/* Repère (daïra / commune) — fixe au centre car la carte est centrée sur lui */}
        {pinXY && (
          <g transform={`translate(${VBW / 2}, ${VBH / 2})`}>
            <path d="M0 4 C -9 -6 -9 -18 0 -22 C 9 -18 9 -6 0 4 Z" transform="translate(0,-2)" fill="#e24b4a" stroke="#fff" strokeWidth="1.5" />
            <circle cx="0" cy="-15" r="4" fill="#fff" />
          </g>
        )}

        {!data && (
          <text x={VBW / 2} y={VBH / 2} textAnchor="middle" fill="#94a3b8" fontSize="16">Chargement de la carte…</text>
        )}
      </svg>
    </div>
  );
}

/* ── Projection + génération des tracés SVG ── */
function buildData(geo: any): MapData {
  const features: any[] = geo?.features || [];

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const eachCoord = (feat: any, fn: (lon: number, lat: number) => void) => {
    const g = feat.geometry;
    if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) for (const [lon, lat] of ring) fn(lon, lat);
  };
  for (const f of features) eachCoord(f, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  });

  const spanLat = maxLat - minLat || 1;
  const meanLat = (minLat + maxLat) / 2;
  const kx = Math.cos((meanLat * Math.PI) / 180) || 1;
  const spanLonK = (maxLon - minLon) * kx || 1;
  const scale = Math.min(VBW / spanLonK, VBH / spanLat) * 0.96;
  const offX = (VBW - spanLonK * scale) / 2;
  const offY = (VBH - spanLat * scale) / 2;
  const project = (lon: number, lat: number): [number, number] => [
    offX + (lon - minLon) * kx * scale,
    offY + (maxLat - lat) * scale,
  ];

  const nameOf = (f: any) => f.properties?.shapeName || f.properties?.name || f.properties?.NAME_1 || f.properties?.nom || '';

  const shapes: Shape[] = [];
  for (const f of features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let d = '';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) {
      for (const ring of poly as Ring[]) {
        ring.forEach(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        });
        d += 'Z ';
      }
    }
    const name = nameOf(f);
    const iso = String(f.properties?.shapeISO || '');
    const m = iso.match(/(\d+)/);
    const code = m ? parseInt(m[1], 10) : null;
    shapes.push({ name, norm: normalize(name), code, d: d.trim(), bbox: { x0, y0, x1, y1 } });
  }
  return { shapes, project };
}
