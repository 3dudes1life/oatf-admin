# OATF OS — Production Board

Version 0.03

Shared production workspace for William and Spencer.

## Portal boundary

This build is intentionally production-facing. It does not contain:

- fair payments or revenue
- production profit or budget data
- private fair agreements
- negotiations
- insurance information
- executive-only notes
- AI features

Those belong in the future private **OATF Admin** portal.

## V0.03 features

- Apple-inspired Today view
- My Work view personalized for William or Spencer
- connected fair, talent, task, contact, file, deadline, note, issue, and activity records
- slide-over record details
- favorites
- recently viewed records
- universal local search with Command/Ctrl + K
- production contacts and follow-up center
- talent readiness and missing-material detection
- task risk and fair readiness calculations
- local notifications
- quick-create menu
- drag-and-drop task board
- autosave indicator
- undo for supported actions
- calendar
- local activity timeline
- local JSON export and import
- responsive mobile dock
- installable PWA shell
- offline asset cache
- local identity switcher for William and Spencer
- day-of preview workspace

## Local-first behavior

Data is stored in the current browser using localStorage. The app attempts to migrate compatible V0.01 and V0.02 local data when available.

No database, email, cloud file storage, authentication provider, or external API is connected.

## Upload

Upload the contents of this folder to a static host such as GitHub Pages. Keep the relative folder structure intact.
