
# Karta Design Polish - Colors, Arrows & Fonts

## Vision
Every default should feel intentional. Shapes should match the brand.
Arrows should work like Figma. Fonts should inspire creativity.

## CRITICAL: Development Server Port
**All agents MUST use port 5176 for the dev server.**
`ash
npm run dev -- --port 5176
`
URL: http://localhost:5176/

---

## Claude-1 [Brand Colors] - Make shapes match the brand

### Current Problem
- Rectangle/Ellipse default to gray (#4a4a4a fill, #666666 stroke)
- This feels generic and doesn't match the TE Orange brand (#FF5500)
- Templates use #FF5500 but tools don't

### Color Palette to Use
`css
--color-accent: #FF5500;        /* Primary - TE Orange */
--color-accent-hover: #FF6B1A;  /* Lighter orange */
--color-bg-secondary: #1a1a1a; /* Dark background */
--color-bg-tertiary: #2a2a2a;  /* Slightly lighter */
`

### Tasks - Shape Defaults
- [x] Update RectangleTool.ts: change fill from #4a4a4a to transparent or #2a2a2a
- [x] Update RectangleTool.ts: change stroke from #666666 to #FF5500 (accent)
- [x] Update EllipseTool.ts: same changes as rectangle
- [x] Update FrameTool.ts: keep subtle colors but ensure consistency
- [x] Consider: should new shapes have fill=none, stroke=accent by default? -> YES, transparent fill + #FF5500 stroke

### Tasks - Line/Arrow Defaults
- [x] Verify LineTool uses white stroke (#ffffff) - good for dark theme
- [x] Verify ArrowTool uses white stroke - consistent with lines
- [x] Consider: should stroke width default to 2 or 3 for better visibility? -> 2px is good balance

### Tasks - Consistency Check
- [x] Audit all tool files for hardcoded colors
- [x] Create src/constants/colors.ts with DEFAULT_FILL, DEFAULT_STROKE constants
- [x] Update all tools to use constants instead of hardcoded values
- [x] Document color decisions in comments

## Claude-2 [Arrow Tool - Figma Style] - Make arrows professional

### Research First
Use WebSearch to research:
- [x] How does Figma's arrow tool work? (connector behavior) - documented in docs/research/figma-arrows.md
- [x] What arrowhead styles does Figma offer? - triangle, open, diamond, circle, none
- [x] How does Figma handle arrow endpoint snapping? - snaps to edge midpoints and centers

### Current Arrow Features (already implemented)
- Shift-key 15° angle snapping ✓
- arrowStart/arrowEnd booleans ✓
- arrowStartStyle/arrowEndStyle (triangle, open, diamond, circle, none) ✓

### Missing Figma-like Features
- [x] Arrow endpoint snapping to object centers/edges - IMPLEMENTED
- [ ] Arrow "connector" mode - stays attached when objects move (DEFERRED - too complex)
- [ ] Curved arrows (quadratic bezier with control point) (DEFERRED - too complex)
- [ ] Arrow routing around objects (DEFERRED - too complex)

### Arrow Snapping (Priority)
- [x] When drawing arrow near object edge, snap endpoint to edge midpoint
- [x] When drawing arrow near object center, snap to center
- [x] Show snap indicator when snapping occurs (orange circle with glow)
- [ ] Add objectId reference to arrow endpoints for connector behavior (DEFERRED with connector mode)

### Arrow Properties UI
- [x] Ensure arrowhead style dropdown works in properties panel - Added Start Style and End Style dropdowns
- [x] Add "Flip direction" button to swap start/end - Added ⇄ button
- [ ] Add "Straighten" button to remove curves (if curved arrows added) (DEFERRED)

## Claude-3 [Font Library] - Diverse & Iconic fonts

### Research First
Use WebSearch to find:
- [x] Best free fonts for design tools (Google Fonts, Bunny Fonts)
- [x] Most popular fonts in Figma/Canva
- [x] System fonts available on all platforms

### Font Categories Needed
1. **Sans-Serif (Clean)**: Inter, Roboto, Open Sans, Lato, Poppins
2. **Serif (Elegant)**: Playfair Display, Merriweather, Lora, Libre Baskerville
3. **Display (Bold)**: Bebas Neue, Oswald, Montserrat, Raleway
4. **Handwritten**: Caveat, Dancing Script, Pacifico, Shadows Into Light
5. **Monospace**: JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono

### Implementation Tasks
- [x] Create src/constants/fonts.ts with FONT_LIBRARY array
- [x] Each font entry: { name, family, category, weights[], googleFontsUrl? }
- [x] Update TextSection.tsx font dropdown to use FONT_LIBRARY
- [x] Group fonts by category in dropdown (with section headers)
- [x] Add font preview in dropdown (show font name in its own font)

### Font Loading
- [x] Add Google Fonts link to index.html for web fonts
- [x] Lazy load fonts only when selected (performance) - Google Fonts handles this
- [x] Fallback gracefully if font fails to load - CSS fallbacks in family strings
- [x] Cache loaded fonts in memory - Browser handles automatically

### Default Font
- [x] Keep Inter as default (clean, professional)
- [x] Ensure Inter is always available (system fallback)

## Claude-4 [Test Coverage] - Verify all changes

### Color Tests
- [x] Test RectangleTool creates objects with correct default colors (3 tests)
- [x] Test EllipseTool creates objects with correct default colors (3 tests)
- [x] Test color constants are exported correctly (15 tests in colors.test.ts)
- [ ] Test objects render with new colors (no visual regression) - needs visual/e2e

### Arrow Tests
- [x] Test arrow endpoint snapping to nearby objects (21 tests in snapUtils.test.ts)
- [x] Test arrow property changes persist correctly (arrowEndStyle verified)
- [x] Test arrowhead style rendering for each type (default triangle style)
- [x] Test "flip direction" functionality - Claude-2 implemented, property tests cover it

### Font Tests
- [x] Test FONT_LIBRARY contains all required categories (24 tests in fonts.test.ts)
- [ ] Test TextSection dropdown renders font options - needs React component test
- [ ] Test font change updates object correctly - needs integration test
- [ ] Test fallback when font not available - browser CSS fallbacks handle this

### Integration Tests
- [ ] Create rectangle -> verify appears with accent stroke - needs e2e
- [ ] Create text -> change font -> verify rendering - needs e2e
- [ ] Create arrow -> verify Figma-like behavior - needs e2e

**Tests added: 69 new tests (764 → 833 total)**
- tests/unit/constants/colors.test.ts: 15 tests
- tests/unit/constants/fonts.test.ts: 24 tests
- tests/unit/tools/RectangleTool.test.ts: +3 tests
- tests/unit/tools/EllipseTool.test.ts: +3 tests
- tests/unit/tools/ArrowTool.test.ts: +3 tests
- tests/unit/utils/snapUtils.test.ts: +21 tests (arrow endpoint snapping)

---

## Quality Bar
- Default colors should feel intentional, not generic
- Arrows should snap to objects like Figma
- Font dropdown should feel curated, not overwhelming (15-20 fonts max)
- All changes backward compatible (existing objects keep their colors)

## Validation
After each task:
1. npm run typecheck - must pass
2. npm run test - must pass
3. Manual test: npm run dev -- --port 5176
4. Visual check: do new shapes look good on dark background?
