'use client';
import { useEffect, useRef } from 'react';
import { healthColor } from '@/lib/design-tokens';

interface Props {
  value: number; // bps, 10_000 = 1.0
}

// SVG arc gauge: 180° half-circle, radius 80, cx=100, cy=100
const CX = 100;
const CY = 100;
const R = 80;
const STROKE = 16;

// Zones: 0–50% danger, 50–75% warning, 75–100% safe
// Full arc spans 180° (π radians), left to right
function polarToXY(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  };
}

function arcPath(startDeg: number, endDeg: number) {
  const s = polarToXY(startDeg);
  const e = polarToXY(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
}

// The gauge spans from 180° (left) to 0° (right) going counter-clockwise visually
// In SVG coords: start=180°, end=0°, but we draw left→right so start=-180, end=0 mapped:
// We use the bottom half: 180° → 0° (going left to right via the top)
// Simpler: gauge arc from 180° to 0° (top arc). Angles in standard math coords.

// Map value fraction [0,1] to arc: 0 = leftmost (180°), 1 = rightmost (0°)
// Going from 180° down to 0° counter-clockwise means decreasing angle
function valueToAngle(frac: number): number {
  return 180 - frac * 180; // 180° at 0, 0° at 1
}

const ZONES = [
  { start: 0, end: 0.5, color: '#DC2626', label: 'Danger' },
  { start: 0.5, end: 0.75, color: '#D97706', label: 'Warning' },
  { start: 0.75, end: 1, color: '#16A34A', label: 'Safe' },
];

export default function HealthGauge({ value }: Props) {
  const frac = Math.min(value / 20_000, 1); // cap at 200% (2.0x)
  const displayValue = (value / 10_000).toFixed(2);
  const color = healthColor(value);
  const label = value >= 15_000 ? 'Safe' : value >= 10_000 ? 'Warning' : 'Danger';

  // Animate needle via ref to avoid re-renders
  const needleRef = useRef<SVGLineElement>(null);
  const progressRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const targetAngle = valueToAngle(frac);
    const targetRad = (targetAngle * Math.PI) / 180;
    const nx = CX + (R - STROKE / 2) * Math.cos(targetRad);
    const ny = CY + (R - STROKE / 2) * Math.sin(targetRad);

    if (needleRef.current) {
      needleRef.current.setAttribute('x2', String(nx));
      needleRef.current.setAttribute('y2', String(ny));
    }

    // Animate progress arc stroke-dashoffset
    if (progressRef.current) {
      const arcLength = Math.PI * R; // half circumference
      const filledLength = frac * arcLength;
      progressRef.current.style.strokeDasharray = `${arcLength}`;
      progressRef.current.style.strokeDashoffset = `${arcLength - filledLength}`;
    }
  }, [frac]);

  const needleAngle = valueToAngle(frac);
  const needleRad = (needleAngle * Math.PI) / 180;
  const nx = CX + (R - STROKE / 2) * Math.cos(needleRad);
  const ny = CY + (R - STROKE / 2) * Math.sin(needleRad);

  return (
    <div
      className="flex flex-col items-center w-full"
      role="status"
      aria-live="polite"
      aria-label={`Health factor: ${displayValue}x, ${label}`}
    >
      <svg viewBox="20 20 160 90" className="w-full max-w-xs" aria-hidden="true">
        {/* Background track */}
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Color zone arcs */}
        {ZONES.map((z) => (
          <path
            key={z.label}
            d={arcPath(valueToAngle(z.start), valueToAngle(z.end))}
            fill="none"
            stroke={z.color}
            strokeWidth={STROKE}
            opacity={0.25}
          />
        ))}

        {/* Filled progress arc — animated via useEffect */}
        <path
          ref={progressRef}
          d={arcPath(180, 0)}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={{
            strokeDasharray: `${Math.PI * R}`,
            strokeDashoffset: `${Math.PI * R * (1 - frac)}`,
            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.4s',
          }}
        />

        {/* Needle */}
        <line
          ref={needleRef}
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="#1c1917"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transition: 'x2 0.8s ease-out, y2 0.8s ease-out' }}
        />
        <circle cx={CX} cy={CY} r={5} fill="#1c1917" />

        {/* Numeric value */}
        <text x={CX} y={CY + 18} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {displayValue}x
        </text>
      </svg>

      {/* Label below */}
      <span className="text-sm font-semibold mt-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
