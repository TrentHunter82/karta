# Karta Polish More - Task Board

## Goal
Clean up code quality issues, fix remaining TypeScript errors, and improve architecture.

---

## Claude-1 [TypeScript Fixes] - Fix all compilation errors

### Pre-existing Errors
- [x] Fix ColorInput.tsx:122 - Remove unused 'updateColorFromHsv' variable
- [x] Fix TemplatePanel.tsx:228 - Fix ObjectType to CanvasObject type assignment
- [x] Fix groupStore.ts:178 - Remove unused 'state' variable in exitGroupEditMode
- [x] Fix exportUtils.ts:8 - Remove unused 'BoundingBox' import
- [x] Fix renderStats.ts:43-44 - Remove unused lastObjectsHash/lastSelectionHash vars
- [x] Fix yjsUtils.ts:140 - Add proper type assertion with unknown intermediate

### Validation
- [x] Run npx tsc --noEmit - must have ZERO errors
- [x] Run npm test - all tests must pass

## Claude-2 [Code Cleanup] - Remove dead code and improve consistency

### Unused Code
- [x] Search for and remove all unused imports across codebase
- [x] Remove any TODO comments that are obsolete or already done
- [x] Remove commented-out code blocks older than this session
- [x] Clean up any console.log statements (except error logging)

### Consistency
- [x] Ensure all event handlers follow naming convention: handle{Event}
- [x] Ensure all useCallback deps are complete (no missing deps warnings)
- [x] Verify all exported functions have JSDoc comments
- [x] Check all switch statements have default cases

## Claude-3 [Architecture Prep] - Document and prepare for future refactors

### Documentation
- [x] Add file header comments to all files in src/stores/ explaining purpose
- [x] Add file header comments to all files in src/tools/ explaining purpose
- [x] Document the rendering pipeline in Canvas.tsx with inline comments
- [x] Create src/constants/index.ts that re-exports all constants

### Identify Extraction Candidates
- [x] In Canvas.tsx, add "// EXTRACT:" comments before code blocks that should become separate modules
- [x] In canvasStore.ts, add "// EXTRACT:" comments for code that belongs in separate stores
- [x] In SelectTool.ts, add "// EXTRACT:" comments for handlers that could be separate classes

## Claude-4 [Test Gaps] - Add tests for untested utilities

### Utility Tests
- [x] Add tests for src/utils/geometryUtils.ts - all exported functions
- [x] Add tests for src/utils/textMeasurement.ts - measureTextDimensions
- [x] Add tests for src/constants/interaction.ts - verify all exports exist
- [x] Add tests for src/constants/rendering.ts - verify all exports exist

### Edge Case Tests
- [x] Add tests for extreme zoom levels (0.1, 5.0) with coordinate transforms
- [x] Add tests for objects with zero width/height
- [x] Add tests for objects with negative coordinates
- [x] Add tests for very large canvas coordinates (>10000)

---

## Validation
After each task:
1. npx tsc --noEmit - must pass with ZERO errors
2. npm test -- --run - must pass
3. No new ESLint warnings
