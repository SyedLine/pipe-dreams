export type LngLat = [number, number]

const R_NM = 3440.065 // mean Earth radius in nautical miles
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in nautical miles. */
export function distanceNm([lon1, lat1]: LngLat, [lon2, lat2]: LngLat): number {
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Total length of a polyline in nautical miles. */
export function pathNm(points: LngLat[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceNm(points[i - 1], points[i])
  return total
}

/**
 * Points along the great circle from a to b. Longitudes are "unwrapped" so
 * the line stays continuous across the antimeridian (MapLibre draws lon < -180
 * on the neighbouring world copy, which keeps Pacific crossings in one piece).
 */
export function greatCircle(a: LngLat, b: LngLat, steps = 64): LngLat[] {
  const [lon1, lat1, lon2, lat2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])]
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    )
  if (d === 0) return [a, b]
  const out: LngLat[] = []
  let prevLon = a[0]
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    let lon = deg(Math.atan2(y, x))
    const lat = deg(Math.atan2(z, Math.sqrt(x * x + y * y)))
    while (lon - prevLon > 180) lon -= 360
    while (lon - prevLon < -180) lon += 360
    prevLon = lon
    out.push([lon, lat])
  }
  return out
}

/** Shift a longitude by whole turns so it sits on the same world copy as `ref`. */
export function unwrapTo(lon: number, ref: number): number {
  while (lon - ref > 180) lon -= 360
  while (lon - ref < -180) lon += 360
  return lon
}

/**
 * Smooth a polyline with a Catmull-Rom spline. The curve passes through every
 * original waypoint, so terminals and hubs stay exactly on the line.
 */
export function smooth(points: LngLat[], perSegment = 10): LngLat[] {
  if (points.length < 3) return points
  const out: LngLat[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(points[points.length - 1])
  return out
}
