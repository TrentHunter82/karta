# PRD-Polish: Karta Hardening & Improvement Pass

## Goal
Improve code quality, fix edge cases, enhance performance, and polish the existing Karta implementation. **No new features** — focus entirely on making what exists more robust and professional.

## Context
Karta is a near-complete Figma-style design tool with React 18, TypeScript, Zustand, Canvas 2D rendering, and Yjs collaboration. All core user stories from PRD.md are implemented. 

**Important Guidelines:**
- Do NOT restructure the architecture
- Do NOT add new features
- Focus on hardening, polish, and code quality
- Read progress.txt learnings section before starting work
- Run `npm run typecheck` after all changes
- Test changes in browser with `npm run dev`

## Tasks

### Code Quality (impl-1)
- [x] Review canvasStore.ts (37KB) for any code that could be extracted into utility functions
- [x] Add JSDoc comments to all exported functions in src/stores/*.ts
- [x] Ensure consistent error handling patterns across all tool files in src/tools/
- [x] Review and improve TypeScript types - eliminate any `any` types
- [x] Extract magic numbers into named constants (especially in rendering code)

### Edge Case Handling (impl-2)
- [ ] Audit SelectTool.ts for edge cases: zero-size selections, rapid clicks, drag threshold
- [ ] Ensure all canvas operations handle objects with rotation correctly
- [x] Verify paste operations work when clipboard is empty or contains invalid data
- [x] Test and fix any issues with objects at extreme positions (very large x/y coordinates)
- [ ] Ensure export works correctly with rotated objects and groups

### Performance Review (reviewer)
- [x] Profile the canvas render loop - identify any unnecessary redraws
- [x] Review mouse event handlers for expensive operations that should be throttled
- [x] Check for memory leaks in event listener cleanup (component unmounts)
- [x] Verify quadtree.ts is being used effectively for spatial queries
- [x] Ensure large object counts (100+) don't degrade selection/drag performance

### Polish & UX
- [ ] Review all cursor changes - ensure they accurately reflect current tool/state
- [ ] Verify keyboard shortcuts work consistently and don't conflict
- [ ] Check all hover states and visual feedback on interactive elements
- [ ] Ensure smooth animations/transitions where appropriate
- [ ] Review error boundary coverage - are all major sections wrapped?

### Testing Gaps
- [ ] Add unit tests for coordinate transformation functions
- [ ] Add tests for selection logic (single, multi, marquee, shift-click)
- [ ] Add tests for clipboard operations (copy, paste, duplicate)
- [ ] Add tests for history operations (undo, redo boundaries)
- [ ] Verify existing tests pass: `npm run test` (if test script exists)

## Files to Focus On

**High Priority (large/complex):**
- `src/stores/canvasStore.ts` (37KB) - main state, likely has optimization opportunities
- `src/tools/SelectTool.ts` (23KB) - complex interaction logic
- `src/components/layout/` (124KB total) - rendering components
- `src/utils/exportUtils.ts` (13KB) - export logic

**Medium Priority:**
- `src/hooks/useKeyboardShortcuts.ts` (14KB) - shortcut handling
- `src/stores/collaborationStore.ts` (10KB) - Yjs integration
- `src/components/properties/` (113KB total) - property panels

## Validation
After each task:
1. Run `npm run typecheck` - must pass
2. Run `npm run lint` - should pass (warnings OK)
3. Test in browser - verify no regressions
4. If tests exist, run `npm run test`

## Notes
- This project uses Vite for development: `npm run dev`
- Real-time collaboration via Yjs - test with multiple browser tabs
- Canvas uses custom 2D rendering with viewport transform
- See progress.txt for accumulated learnings from previous iterations
