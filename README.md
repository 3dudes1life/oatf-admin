# OATF OS — Production

Version 0.05

Shared **Production** portal. The portal is not named for an individual user. William and Spencer may still appear as record owners, contacts, or activity authors, but the workspace identity and Action Board are simply **Production**.

## V0.05 — Production Operating System

- Production Control Center
- deterministic production rule engine
- system-wide compliance score
- saved operational lenses for exceptions, missing materials, overdue work, waiting items, schedule risks, and open issues
- one-click task creation from rule violations
- 14-day workload pressure map
- session delta since the last checkpoint
- local restorable checkpoints
- browser storage and offline-shell health indicators
- Briefing Center
- generated Production Brief
- generated Fair Readiness Report
- generated Day-of Call Sheet
- generated Follow-Up Digest
- generated Issue & Risk Report
- generated Public Schedule
- copy, download, print, and Save-as-PDF report actions
- deterministic command results inside universal search
- automatic migration from V0.04 local data

## Production-only boundary

This ZIP contains no Admin password, Admin login, revenue, fair payments, budgets, profitability, private fair agreements, negotiations, insurance, executive notes, or AI features. Those belong in the separately deployed **OATF Admin** portal.

## Local-first behavior

All operational data, checkpoints, preferences, and reports are generated in the current browser. No database, cloud storage, calendar, email account, or external API is connected.

## Hosting

Upload every file while preserving the included folder structure. The app works on GitHub Pages and other static hosts.


## V0.06 — Workflow Orchestration Engine

V0.06 makes OATF OS understand production as a connected lifecycle rather than a set of isolated records.

### New orchestration workspace

- six production phases: Foundation, Booking, Materials, Schedule, Day-of Prep, and Closeout
- automatic phase health and overall workflow score
- fair selector for focused production management
- production-wide next-available-work queue

### Readiness gates

- deterministic Go / Conditional Go / Hold decision
- checks fair profile, fair contacts, talent readiness, materials, run of show, overdue work, blockers, and open high-severity issues
- one-click gate explanations

### Production playbooks

- New Fair Foundation
- Talent Lock
- Materials Lock
- 30-Day Production Lock
- 7-Day Day-of Readiness
- Post-Event Closeout
- playbooks create idempotent connected task chains

### Dependency engine

- tasks can depend on other tasks
- dependent work remains blocked until its prerequisite is complete
- automatic next-available-work calculation
- visual production chain with blocked, available, and complete states

### Operational handoffs

- save session or shift summaries
- preserve blockers, decisions, and the next required action
- handoff history remains connected to each fair

### Local OS commands

Universal search now understands deterministic commands for:

- workflow / orchestration
- go-no-go readiness
- next available work
- playbooks
- handoffs

No AI, financial information, private agreements, executive notes, or Admin credentials are included.


## V0.07 — Local Production OS Kernel

V0.07 adds system behavior on top of the production records and orchestration engine.

### OS Center

A dedicated operating-system workspace with:

- smart inbox
- deterministic local automations
- operating modes
- reversible change journal
- Data Doctor
- storage and recovery health

### Smart Inbox

The OS creates deduplicated local signals for:

- critically overdue work
- newly unlocked task dependencies
- missing contracted-talent materials
- due and overdue follow-ups
- run-of-show risks
- stale active work
- unresolved high-severity issues
- missing handoff continuity

Inbox items can be opened, snoozed until tomorrow, acknowledged, or converted into Production tasks.

### Automation rules

Every rule can be:

- enabled or disabled
- set to Inbox Only
- set to Inbox + Task
- run manually
- evaluated while the OS is being used

This is deterministic local logic, not AI and not a background cloud process.

### Operating modes

- Planning
- Production Lock
- Day-of
- Closeout

Each mode changes the workspace focus, density, and starting screen.

### Change Journal

- records creations, edits, deletions, and restores
- keeps up to 250 local record versions
- supports one-click rollback
- filters history by fair

### Data Doctor

The OS checks for:

- broken task dependencies
- invalid recent-item references
- duplicate inbox entries
- orphaned fair references
- duplicate record IDs

Safe repair never deletes production records.

### OS commands

Universal search now understands:

- open OS Center
- run automations
- Planning Mode
- Production Lock
- Day-of Mode
- Closeout Mode
- Data Doctor
- Change Journal

No AI, budgets, fair payments, private agreements, negotiations, Admin credentials, or executive-only notes are included.


## V0.08 — Production Digital Twin

V0.08 adds a non-destructive modeling layer to OATF OS.

### Twin Lab

Production can simulate:

- performer cancellation
- schedule delay
- stage-time reduction
- missing performer materials
- unavailable contacts
- compressed deadlines

Every simulation calculates:

- readiness before and after
- schedule-warning changes
- affected connected records
- active-work impact
- recommended production response

Scenarios may be saved without changing live data. Committing a scenario creates a checkpoint first, applies only the approved changes, and records the decision and rationale.

### Production Spaces

Spaces preserve operating context:

- view
- focus fair
- operating mode
- Control Center lens

The release includes Production Command, Talent Lock, Live Stage, and Closeout Spaces. Custom Spaces can also be saved locally.

### Production Horizon

Forecasts 7-, 14-, and 30-day workload using:

- task estimates
- high-impact work
- connected deadlines
- modeled workload pressure

### Relationship Map

A fair-centered relationship view connects:

- talent
- tasks
- contacts
- run-of-show blocks
- issues
- files

Each connected record receives a simple local health signal.

### Bulk Deck

Production can select multiple tasks and:

- start them
- complete them
- shift due dates by one or seven days
- assign them to Production

A checkpoint is created before bulk updates.

### Decision Log

Production decisions now preserve:

- the decision
- rationale
- fair
- status
- timestamp

Committed Twin Lab scenarios automatically create decision records.

### Twin commands

Universal search now understands:

- open Twin Lab
- simulate performer cancellation
- simulate schedule delay
- simulate stage-time reduction
- relationship map
- bulk deck
- decision log

No AI, budgets, revenue, fair payments, private agreements, negotiations, Admin credentials, or executive-only notes are included.


## V0.09 — Production State Engine

V0.09 makes local Production data portable, comparable, transactional, and reversible.

### State Captures and Visual Diff

- capture a fair and every connected record
- generate a stable state fingerprint
- compare current state with any capture
- see created, updated, and deleted records
- restore one record or the complete captured state
- automatically create safety checkpoints before restores

### Transactional Change Sets

Stage several Production operations before anything changes:

- move work into progress
- complete work
- shift deadlines
- reassign owners
- change priority and operational impact

The OS calculates the exact record-level diff before commit and applies the whole transaction after creating a checkpoint.

### Fair Package Exchange

Export a portable fair package containing:

- fair profile
- contacts
- talent
- tasks
- run of show
- deadlines
- files
- notes
- issues
- handoffs
- incidents
- decisions

Incoming packages are analyzed without changing local data.

Conflict strategies:

- keep newest record
- always keep local
- always use incoming

Every import and export is written to the package audit history.

### Incident Replay

Production can timestamp:

- decisions
- delays
- performer events
- issues
- stage events
- handoffs
- resolutions

The timeline can be replayed chronologically and copied as a production record.

### State commands

Universal search now understands:

- open State Engine
- capture state
- state diff
- change set
- export fair package
- merge package
- incident replay

No AI, budgets, revenue, fair payments, private agreements, negotiations, Admin credentials, or executive-only notes are included.
