# Web App Orchestra - Master Orchestration Guide

## Philosophy

**Single-agent development fails at scale.** This system uses specialized agents with clear interfaces, adversarial review, and mandatory checkpoints to produce production-quality web apps efficiently.

## The Pipeline

```
YOU (Orchestrator)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: SPECIFICATION                                     │
│  ────────────────────────────────────────────────────────── │
│  1. You describe the app concept                            │
│  2. Run ARCHITECT AGENT → produces full technical spec      │
│  3. ✅ CHECKPOINT: You review and approve spec              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: PARALLEL BUILD                                    │
│  ────────────────────────────────────────────────────────── │
│  1. Run FRONTEND AGENT (with spec) → builds UI              │
│  2. Run BACKEND AGENT (with spec) → builds API              │
│     (These can run in parallel sessions)                    │
│  3. Run REVIEWER AGENT → adversarial code review            │
│  4. ✅ CHECKPOINT: You review findings, approve or iterate  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: INTEGRATION & QA                                  │
│  ────────────────────────────────────────────────────────── │
│  1. Merge frontend + backend                                │
│  2. Run QA AGENT → writes tests, finds bugs                 │
│  3. Bugs go back to relevant agent for fixes                │
│  4. ✅ CHECKPOINT: Final review before deploy               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
   🚀 DEPLOY
```

## Quick Start

### Step 1: Describe Your App
Write a clear description including:
- What problem it solves
- Who the users are
- Core features (prioritized)
- Any technical requirements

### Step 2: Run Architect Agent
Start a new Claude session and paste the Architect Agent prompt from `agents/ARCHITECT.md`, followed by your app description.

### Step 3: Review the Spec
The Architect will produce:
- Tech stack decisions
- File/folder structure
- Data models
- API contracts
- Component hierarchy

**Don't proceed until you approve this spec.**

### Step 4: Run Build Agents
Open two Claude sessions:
1. Frontend Agent (paste `agents/FRONTEND.md` + the approved spec)
2. Backend Agent (paste `agents/BACKEND.md` + the approved spec)

### Step 5: Run Reviewer
Paste the code from both agents into a new session with `agents/REVIEWER.md`.
The Reviewer will find issues before integration.

### Step 6: Run QA Agent
After fixes, run the QA Agent (`agents/QA.md`) to write tests and validate.

---

## Agent Reference

| Agent | File | Purpose | Inputs | Outputs |
|-------|------|---------|--------|---------|
| Architect | `agents/ARCHITECT.md` | Design the system | App concept | Technical spec |
| Frontend | `agents/FRONTEND.md` | Build UI | Spec | React/Vue/etc components |
| Backend | `agents/BACKEND.md` | Build API | Spec | Routes, DB, auth |
| Reviewer | `agents/REVIEWER.md` | Code review | Code from build agents | Issues, fixes |
| QA | `agents/QA.md` | Testing | Integrated code | Tests, bug reports |

---

## Checkpoints (Never Skip These)

### Checkpoint 1: Spec Approval
- [ ] Tech stack makes sense for requirements
- [ ] File structure is clear and scalable
- [ ] Data models cover all features
- [ ] API contracts are complete and RESTful
- [ ] No ambiguity for build agents

### Checkpoint 2: Code Review Approval
- [ ] Frontend matches API contracts
- [ ] Backend implements all endpoints
- [ ] No security issues flagged
- [ ] Error handling is consistent
- [ ] Code follows spec patterns

### Checkpoint 3: QA Approval
- [ ] All tests pass
- [ ] E2E flow works
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] Ready for production

---

## Best Practices

### Keep Agents Focused
Each agent should only do its job. Don't ask the Frontend Agent to "also add a quick endpoint" - that's Backend's job.

### Spec is the Contract
If something isn't in the spec, it doesn't get built. This prevents scope creep and ensures alignment.

### Adversarial Review is Critical
The Reviewer Agent exists to find problems. Don't skip it to save time - it will save you more time than it costs.

### Iterate in Phases
If Reviewer finds issues, fix them BEFORE QA. Don't pass known bugs forward.

### Document Decisions
When you make tradeoffs or changes, update the spec. The spec should always reflect reality.

---

## Scaling Tips

### For Larger Apps
- Split into feature modules
- Run the full pipeline per module
- Have a final "Integration Agent" merge modules

### For Teams
- Each person can run different agents
- Spec becomes the shared contract
- Review happens at integration points

### For Speed
- Frontend and Backend can run truly parallel
- Pre-define common patterns in templates
- Build a library of approved specs for common features
