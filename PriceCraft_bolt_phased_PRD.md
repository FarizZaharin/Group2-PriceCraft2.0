# PriceCraft PRD (bolt.new Phased Build Plan)

Source PRD: fileciteturn0file0  
Date: 10 Feb 2026 (v0.1 Draft)

**Project Name:** PriceCraft  
**Description:** Tender pre‑tender cost estimation workspace that converts a Scope of Work (SOW) into a draft Bill of Quantities (BoQ) and produces a defensible estimate with governance (versioning, audit trail, and AI Draft → Accept workflow).

---

## Guiding Principles

- **Governance-first:** Everything exported must map to a frozen version with audit trail.
- **Human-in-the-loop:** AI output is always **Draft** until explicitly **Accepted**.
- **MVP keeps it simple:** No PDF/DOCX export, no vendor quote comparison, no full tender lifecycle.

---

# Phase 0: Foundations (Project Setup)

## Objective
Create the basic app shell and shared components so later phases are faster and consistent.

## What to Build
- App shell (navigation, layout, route structure)
- Global settings (currency defaults, tax/SST default %, rounding rules)
- Shared UI components: table shell, modal, toast/alerts, confirmation dialogs
- Environment setup for bolt.new database + storage

## Success Criteria
- App runs end-to-end with placeholder pages and shared UI primitives available.

---

# Phase 1: Database (Core Data Structure)

## Objective
Set up the data structure for estimates, SOW versions, BoQ versions, line items, and governance logs.

## Data Entities

### 1) Users
Stores login identity and role.
- id, name, email, role, createdAt

### 2) Estimates (Estimate Workspace)
Top-level container per tender/project estimate.
- id, title, category, location, currency, estimateClass, timelineStart, timelineEnd
- ownerUserId (FK Users)
- status: Draft | InReview | Final | Archived
- createdAt, updatedAt

### 3) SOWVersions
Version history for SOW text per Estimate.
- id, estimateId (FK Estimates)
- versionLabel (e.g., v0.1), sowText, createdByUserId, createdAt
- isCurrent (bool)

### 4) BoQVersions
Version history for BoQ per Estimate.
- id, estimateId (FK Estimates)
- versionLabel (e.g., v0.1), createdByUserId, createdAt
- isFrozen (bool) — frozen versions are used for export
- basedOnBoQVersionId (nullable FK BoQVersions) — supports duplication/branching

### 5) BoQRows
The editable tender table rows for a specific BoQVersion.
- id, boqVersionId (FK BoQVersions)
- rowType: LineItem | SectionHeader
- itemNo (string/number), section (string), description (text)
- uom (string), qty (number nullable), rate (number nullable), amount (computed)
- measurement (text), assumptions (text), category (string)
- rowStatus: AIDraft | Final
- sortOrder (number), createdAt, updatedAt

### 6) AddOnConfigs
Stores add-ons and calculation controls per Estimate (or per BoQVersion if you prefer).
- id, estimateId (FK Estimates)
- prelimsPct, contingencyPct, profitPct, taxPct
- roundingRule (e.g., 2 decimals), createdAt, updatedAt

### 7) RowComments
Line-item comments for review.
- id, boqRowId (FK BoQRows)
- commentText, createdByUserId, createdAt

### 8) AuditLogs
Immutable log of key actions (edit, version save, freeze, export, AI run acceptance).
- id, estimateId (FK Estimates)
- actorUserId (FK Users)
- actionType (string), entityType (string), entityId (string)
- beforeSnapshot (json/text), afterSnapshot (json/text)
- createdAt

### 9) AIRuns (Phase 2 ready, can be created now)
Metadata about AI actions (even if AI not enabled yet).
- id, estimateId (FK Estimates)
- sowVersionId (FK SOWVersions), outputBoQVersionId (FK BoQVersions nullable)
- modelName, promptContext (text/json), outputJson (json/text)
- createdAt, acceptedByUserId (nullable), acceptedAt (nullable), status: Draft | Accepted | Rejected

## Relationships (Summary)
- User 1—M Estimates
- Estimate 1—M SOWVersions
- Estimate 1—M BoQVersions
- BoQVersion 1—M BoQRows
- BoQRow 1—M RowComments
- Estimate 1—1 AddOnConfigs
- Estimate 1—M AuditLogs
- Estimate 1—M AIRuns

## Seed Data
- Default AddOnConfigs percentages (admin configurable later)
- Basic category list: Prelims, Labour, Material, Equipment, Subcon, Other
- Basic UOM list (optional): LS, m, m2, m3, unit, lot

## Success Criteria
Database tables/collections exist, relationships work, and sample data can be created and read.

---

# Phase 2: Authentication & Roles

## Objective
Implement login and role-based permissions.

## What to Build
- Sign up / Login / Logout
- Password reset (optional for MVP but recommended)
- Role-based access control (RBAC)

## Roles (MVP)
- **Procurement Admin:** manage templates/settings, access control
- **Procurement Officer:** create/manage estimates, BoQ versions, export
- **Estimator / SME:** review/comment, accept/reject AI drafts (Phase 2 AI)
- **Viewer:** read-only

## Protected Resources
- Create/edit/freeze/export estimates: Admin, Procurement Officer
- Comment/review: Estimator/SME, Admin, Procurement Officer
- View-only: Viewer
- Settings management: Admin only

## Success Criteria
Users can authenticate, and permissions prevent unauthorized edits/actions.

---

# Phase 3: Backend Logic (MVP Core Workflow)

## Objective
Deliver the core “Estimate → BoQ → Totals” workflow without AI.

## What to Build

### A) Estimate Workspace
- Create, view, duplicate, archive estimates
- Update estimate metadata
- Status transitions:
  - Draft → InReview → Final → Archived  
  - Rule: Final requires a frozen BoQ version

### B) SOW Intake + Versioning
- Add new SOW version from pasted text
- Set current SOW version
- Track author + timestamp
- Log actions to AuditLogs

### C) BoQ Builder (No AI yet)
- Create BoQ version (v0.1), duplicate version (v0.2), set current version
- BoQ row CRUD:
  - add line item
  - add section header
  - delete/duplicate/reorder rows
- Auto numbering/renumbering:
  - itemNo increments for LineItem rows
  - section headers are not numbered (or use a different scheme)
- Row comments (review notes)

### D) Estimation & Totals
- Amount = qty × rate (with rounding rule)
- Subtotals by section and category
- Add-ons:
  - prelims/overheads %, contingency %, profit %, tax/SST %
- Grand total summary

### E) Freeze / Lock for Export
- “Freeze version” sets BoQVersion.isFrozen = true
- Frozen versions are read-only (except Admin override if needed)
- Every freeze creates an AuditLog record

## Success Criteria
A user can create an estimate, paste SOW, build BoQ, fill qty/rates, see totals, and freeze a version.

---

# Phase 4: Frontend (MVP UI)

## Objective
Build the user-facing pages and interactions.

## Pages / Views

### 1) Login / Account
- Login, signup, password reset

### 2) Estimates List
- Create new estimate
- Search/filter by status/category
- Open estimate workspace

### 3) Estimate Workspace
Tabs recommended:
- **Overview** (metadata + status)
- **SOW** (current + version list)
- **BoQ** (spreadsheet editor)
- **Summary** (totals + add-ons)
- **Audit** (activity feed)

### 4) BoQ Editor (Core UI)
- Spreadsheet-like table with keyboard navigation
- Clear indicators:
  - Section header rows
  - Line item rows
  - Draft vs Final (reserved for Phase 6 AI, but UI can pre-exist)
- Inline edit cells; row action menu
- Side panel for totals

### 5) Review & Comments
- Comment panel per line item
- Comment history

## Success Criteria
Users can complete the workflow without confusing navigation; editor is usable on modern browsers.

---

# Phase 5: Export & Outputs (MVP)

## Objective
Enable tender-ready outputs for practical use.

## What to Build
- Export frozen BoQ version to CSV / Excel-compatible format
- Printable HTML view (A4-friendly) for BoQ
- Export summary breakdown (totals + add-ons) as CSV/HTML section
- Include assumptions/exclusions notes in export output

## Rules
- Only frozen BoQ versions can be exported (unless Admin override)
- Export action creates an AuditLog entry referencing the frozen version

## Success Criteria
Exported tables open cleanly in Excel and printable HTML matches tender table structure.

---

# Phase 6: AI Assist (Phase 2 — Core Value)

## Objective
Add AI actions with strict governance: AI outputs are Draft until Accepted.

## What to Build

### A) SOW → Draft BoQ (AI Action)
- Input: current SOW text + optional structured parameters (duration, sites, floor area)
- Output: JSON rows with schema:
  - section, description, uom, qty, measurement, category, confidence
- Persist AI run:
  - prompt context, model, timestamp, outputJson
- Create a new BoQVersion containing rows marked **rowStatus = AIDraft**

### B) Draft → Accept Workflow
- Row-level actions:
  - Accept row → converts to Final
  - Reject row → removes or keeps flagged (choose one behavior; MVP: remove)
- Bulk actions:
  - Accept all in section
  - Accept selected
- Store acceptance decisions in AIRuns + AuditLogs

### C) AI Rewrite (Optional in this phase if time allows)
- Rewrite selected BoQ descriptions into standardized tender language
- Outputs must remain Draft until accepted

### D) Missing Items / Unclear Scope Checker
- Produce:
  - likely missing components list
  - clarification questions
  - assumptions/exclusions suggestions
- These should generate **notes**, not auto-edit BoQ unless user confirms insertion

## Guardrails
- Do not invent regulations/standards; flag “Needs confirmation”
- Prefer placeholders/ranges when quantities not derivable
- Avoid vendor brand names unless present in SOW
- Always label AI outputs as Draft

## Success Criteria
AI can generate a draft BoQ from SOW, and users can safely accept/reject rows with full auditability.

---

# Phase 7: Admin Settings (Optional / After MVP Stabilization)

## Objective
Make the system configurable without developer changes.

## What to Build
- Manage default add-on percentages
- Manage category library and section templates (simple list-based)
- Manage retention policy settings (if required)

## Success Criteria
Procurement Admin can configure defaults and templates via UI.

---

# Out of Scope (Explicit)

- Full tender lifecycle management (bidders, clarifications portal, scoring)
- Vendor quotation ingestion & comparison
- Automated award recommendation/scoring decisions
- PDF/DOCX export (planned later)
- Real-time multi-user co-editing (decide later)

---

# Open Questions (Decisions Needed)

1) Primary tender category for MVP (services / IT / M&E / construction)?  
2) Default currency and tax/SST rules?  
3) Concurrency rule for MVP:
   - Option A: single editor per BoQ version (recommended)
   - Option B: allow concurrent edits with last-write-wins
4) Required tender table format:
   - client template, internal template, or both?
5) Audit log retention requirements?

