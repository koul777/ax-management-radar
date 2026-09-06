import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

// Project-specific adaptations of Video Shotcraft's spotlight-hero-card,
// outro-group-photo-launch and focus-handoff motion grammar. Brand, assets,
// geometry and reading holds belong to AX Management Radar.
const progress = (frame: number, start: number, end: number) => interpolate(
  frame, [start, end], [0, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(.2, .75, .3, 1) },
);

export function HeroContour({ width, height, color = '#108c7d' }: {
  width: number; height: number; color?: string;
}) {
  const frame = useCurrentFrame();
  // Two complete contour laps while the actual hero card is lifted.
  const lap = interpolate(frame, [68, 128], [0, 2], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = progress(frame, 65, 71) * (1 - progress(frame, 127, 133));
  return <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity, overflow: 'visible' }}>
    <rect x="5" y="5" width={Math.max(1, width - 10)} height={Math.max(1, height - 10)}
      rx="13" pathLength="1" fill="none" stroke={color} strokeWidth="4"
      strokeDasharray="0.11 0.89" strokeDashoffset={-lap} strokeLinecap="round" />
    <rect x="6" y="6" width={Math.max(1, width - 12)} height={Math.max(1, height - 12)}
      rx="12" pathLength="1" fill="none" stroke="#ffffff" strokeWidth="1.5"
      strokeDasharray="0.04 0.96" strokeDashoffset={-lap} strokeLinecap="round" />
  </svg>;
}

export function CraneStage({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const landing = progress(frame, 0, 70);
  return <AbsoluteFill style={{
    transformOrigin: '50% 50%',
    transform: `perspective(1800px) translateY(${78 * (1 - landing)}px) rotateX(${8 * (1 - landing)}deg) scale(${1.035 - .035 * landing})`,
  }}>{children}</AbsoluteFill>;
}

export function FocusScene({ children, duration }: {
  children: React.ReactNode; duration: number;
}) {
  const frame = useCurrentFrame();
  const incoming = progress(frame, 0, 10);
  const outgoing = progress(frame, duration - 10, duration - 1);
  const defocus = Math.max(1 - incoming, outgoing);
  return <AbsoluteFill style={{
    filter: `blur(${8 * defocus}px)`,
    transform: `translateX(${18 * (1 - incoming) - 18 * outgoing}px)`,
  }}>{children}</AbsoluteFill>;
}
