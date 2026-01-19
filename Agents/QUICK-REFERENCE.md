# Quick Reference Cheatsheet

## The Pipeline at a Glance

```
YOU → Architect → [review] → Frontend + Backend → Reviewer → [review] → QA → [review] → Deploy
         ↓                         ↓                   ↓              ↓
       SPEC                      CODE               ISSUES          TESTS
```

## Starting a New Project

### 1. Prepare Your App Description
Include:
- Problem being solved
- Target users
- Core features (max 5-7 for MVP)
- Any technical constraints

### 2. Run Each Agent

**New Claude Session → Paste Agent Prompt → Paste Your Input**

| Step | Agent | Input | Output |
|------|-------|-------|--------|
| 1 | Architect | App description | Technical spec |
| 2a | Frontend | Approved spec | UI code |
| 2b | Backend | Approved spec | API code |
| 3 | Reviewer | Spec + all code | Issue report |
| 4 | QA | Spec + fixed code | Tests + bugs |

## Checkpoints (Don't Skip!)

### After Architect
- [ ] Tech stack appropriate?
- [ ] All features covered?
- [ ] API contracts complete?
- [ ] Data models correct?

### After Build Agents
- [ ] Reviewer issues all addressed?
- [ ] No critical security issues?
- [ ] Frontend/Backend contracts align?

### After QA
- [ ] All tests pass?
- [ ] E2E flows work?
- [ ] No blocking bugs?

## Common Issues & Fixes

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Frontend/backend mismatch | Spec ambiguity | Update spec, rebuild affected parts |
| Missing error handling | Agent missed edge case | Add specific cases to spec |
| Auth not working | Token handling inconsistent | Check spec auth section, verify both sides |
| Tests failing | Spec changed after build | Sync spec with code, or code with spec |

## Files Location

```
webapp-orchestra/
├── ORCHESTRATION-GUIDE.md    # Full guide
├── QUICK-REFERENCE.md        # This file
├── agents/
│   ├── ARCHITECT.md          # Step 1
│   ├── FRONTEND.md           # Step 2a
│   ├── BACKEND.md            # Step 2b
│   ├── REVIEWER.md           # Step 3
│   └── QA.md                 # Step 4
└── templates/                # Reusable templates
```

## Prompt Chaining (Copy-Paste Flow)

**Session 1 - Architect:**
```
[Paste ARCHITECT.md]

Build me an app that [your description]
```

**Session 2 - Frontend:**
```
[Paste FRONTEND.md]

Here is the approved specification:
[Paste spec from Session 1]
```

**Session 3 - Backend:**
```
[Paste BACKEND.md]

Here is the approved specification:
[Paste spec from Session 1]
```

**Session 4 - Reviewer:**
```
[Paste REVIEWER.md]

SPECIFICATION:
[Paste spec]

FRONTEND CODE:
[Paste frontend code]

BACKEND CODE:
[Paste backend code]
```

**Session 5 - QA:**
```
[Paste QA.md]

SPECIFICATION:
[Paste spec]

CODEBASE:
[Paste all code]
```

## Tips for Speed

1. **Parallel Build** - Frontend and Backend can run in separate sessions simultaneously
2. **Reuse Specs** - Save good specs as templates for similar apps
3. **Incremental Features** - Build MVP first, add features through mini-pipelines
4. **Pre-made Components** - Build a UI library once, reference in specs

## Tips for Quality

1. **Never skip Reviewer** - It catches 80% of integration bugs
2. **Spec changes = rebuild** - Don't patch, regenerate from updated spec
3. **Test early** - Run QA after each major feature, not just at the end
4. **Document decisions** - Update spec when you deviate from it
