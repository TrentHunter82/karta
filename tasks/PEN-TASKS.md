
# Karta Pen Tool - World Class Drawing

## Vision
Make drawing feel as natural as Procreate, as precise as Figma, as delightful as Excalidraw.

---

## Claude-1 [Algorithm Research] - Find the BEST implementations

### Web Research Tasks
- [x] Research Catmull-Rom spline implementations (find 3+ sources with code)
- [x] Research cubic Bezier curve fitting algorithms (Schneider's algorithm)
- [x] Research Chaikin's corner cutting algorithm
- [x] Find open source implementations: tldraw, excalidraw, perfect-freehand
- [x] Document velocity-based stroke width algorithms
- [x] Research line stabilization techniques (lazy nezumi, spring-based)
- [x] Find Ramer-Douglas-Peucker TypeScript implementations
- [x] Study how Figma's pen tool handles smoothing

### Documentation Tasks
- [x] Create docs/research/smoothing-algorithms.md with findings
- [x] Create docs/research/pressure-simulation.md with findings
- [x] Create docs/research/stabilization.md with findings
- [x] Recommend top 3 algorithms for our implementation

## Claude-2 [Core Implementation] - Build the smoothing engine

### Utility Functions (src/utils/strokeSmoothing.ts)
- [x] Implement catmullRomSpline(points, tension, segments)
- [x] Implement fitCubicBezier(points, errorThreshold)
- [x] Implement chaikinSmooth(points, iterations)
- [x] Implement movingAverageSmooth(points, windowSize)
- [x] Implement rdpSimplify(points, epsilon) - Ramer-Douglas-Peucker

### Velocity/Pressure Simulation (src/utils/strokePressure.ts)
- [x] Implement getStrokeWidthFromVelocity(velocity, minWidth, maxWidth)
- [x] Implement calculateVelocity(currentPoint, lastPoint, deltaTime)
- [x] Implement taperStrokeEnds(points, taperLength)
- [x] Implement variableWidthStroke(points, widths) - returns outline points

### Line Stabilization (src/utils/strokeStabilization.ts)
- [x] Implement springStabilizer(targetPoint, currentPoint, springConstant)
- [x] Implement lazyStabilizer(points, stringLength)
- [x] Implement predictiveSmooth(points, lookahead)

## Claude-3 [Tool Integration] - Connect to PenTool

### PenTool Enhancements (src/tools/PenTool.ts)
- [x] Add smoothing settings interface (type, amount, stabilization)
- [x] Integrate smoothing on mouse move (real-time preview)
- [x] Add velocity tracking for pressure simulation
- [x] Implement stabilizer mode toggle
- [x] Add final stroke optimization on mouse up
- [x] Support variable-width strokes in path rendering

### Rendering Updates (src/components/layout/Canvas.tsx)
- [x] Add variable-width path rendering (quadratic curves with varying width)
- [x] Optimize path rendering for smooth curves
- [ ] Add pressure visualization in stroke preview

### UI Controls (Properties Panel)
- [x] Add smoothing slider (0-100%)
- [x] Add stabilization toggle and strength
- [ ] Add stroke taper controls (start/end)
- [ ] Add brush preview showing current settings

## Claude-4 [Test Coverage] - Make it BULLETPROOF

### Algorithm Tests (tests/unit/utils/strokeSmoothing.test.ts)
- [x] Test catmullRomSpline with known input/output
- [x] Test catmullRomSpline preserves endpoints
- [x] Test catmullRomSpline with single point (edge case)
- [x] Test fitCubicBezier approximation error within threshold
- [x] Test chaikinSmooth increases point count correctly
- [x] Test rdpSimplify reduces points while preserving shape
- [x] Test rdpSimplify with collinear points
- [x] Test rdpSimplify with epsilon = 0 (no simplification)

### Pressure Tests (tests/unit/utils/strokePressure.test.ts)
- [x] Test velocity calculation accuracy
- [x] Test width mapping from velocity (min/max bounds)
- [x] Test taper produces smooth start/end
- [x] Test variable width stroke outline is closed polygon

### Stabilization Tests (tests/unit/utils/strokeStabilization.test.ts)
- [x] Test spring stabilizer converges to target
- [x] Test lazy stabilizer maintains string length
- [x] Test predictive smooth reduces jitter
- [x] Test stabilizer with rapid input changes

### Integration Tests (tests/unit/tools/PenTool.test.ts - additions)
- [x] Test PenTool with smoothing enabled produces fewer points
- [x] Test PenTool velocity tracking updates correctly
- [x] Test PenTool stabilizer mode affects output
- [x] Test drawing produces valid PathObject with smooth curves

### Visual Regression (MANUAL - ask user)
- [ ] Compare drawing feel before/after smoothing
- [ ] Test at different zoom levels
- [ ] Test with fast vs slow drawing speeds
- [ ] Test stabilizer with shaky hand simulation

---

## Quality Bar
- Smoothed strokes should have <50% of raw sample points
- Velocity-based width should vary naturally (no sudden jumps)
- Stabilizer should add max 16ms latency
- All algorithms must handle edge cases (1 point, 2 points, 1000+ points)

## Validation
After each task:
1. npm run typecheck - must pass
2. npm run test - must pass
3. Visual test in browser with npm run dev
4. Compare drawing feel to reference apps
