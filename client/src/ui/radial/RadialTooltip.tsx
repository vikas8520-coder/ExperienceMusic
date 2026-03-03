import React from "react";

export function RadialTooltip({
  x,
  y,
  text,
}: {
  x: number;
  y: number;
  text: string;
}) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x - 92}
        y={y - 44}
        width={184}
        height={34}
        rx={10}
        fill="rgba(12,12,18,0.92)"
        stroke="rgba(255,255,255,0.12)"
      />
      <text
        x={x}
        y={y - 22}
        textAnchor="middle"
        fill="rgba(255,255,255,0.92)"
        fontSize={11}
        fontWeight={700}
        style={{ letterSpacing: "0.02em" }}
      >
        {text}
      </text>
    </g>
  );
}
