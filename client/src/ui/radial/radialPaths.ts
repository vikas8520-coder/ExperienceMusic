export function polarToCartesian(cx: number, cy: number, r: number, aDeg: number) {
  const a = ((aDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export function describeRingSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const delta = endAngle - startAngle;
  const largeArc = delta <= 180 ? "0" : "1";

  const pOuterStart = polarToCartesian(cx, cy, rOuter, startAngle);
  const pOuterEnd = polarToCartesian(cx, cy, rOuter, endAngle);
  const pInnerEnd = polarToCartesian(cx, cy, rInner, endAngle);
  const pInnerStart = polarToCartesian(cx, cy, rInner, startAngle);

  return [
    `M ${pOuterStart.x} ${pOuterStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${pOuterEnd.x} ${pOuterEnd.y}`,
    `L ${pInnerEnd.x} ${pInnerEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${pInnerStart.x} ${pInnerStart.y}`,
    "Z",
  ].join(" ");
}
