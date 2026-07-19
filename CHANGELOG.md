# Changelog

## V0.12 — Focused Workflow Release Candidate

- Rebuilt Today as a focused operational dashboard
- Added next-fair hero, four core metrics, three attention panels, Continue Working, and a compact status strip
- Rebuilt Action Board into Do Now, Do Next, and Waiting lanes
- Hid completed work and advanced complexity by default
- Simplified default navigation to Today, Fairs, Action Board, Run of Show, Day-of, People, Files, and More
- Added progressive disclosure for advanced OS tools
- Replaced Release Center in the mobile dock with Day-of
- Added phone-first card, toolbar, navigation, spacing, and touch-target rules
- Added one-time V0.12 migration to Simple Production navigation
- Added focused-workflow validation to Release Center
- Updated cache, manifest, migration, and static tests

## V0.11 — Responsive Shell Release Candidate

- Fixed the broken half-collapsed sidebar state
- Added intentional Full, Compact Rail, and Mobile Drawer shells
- Added Auto sidebar fit based on viewport width
- Compact rail now hides section headings and record lists correctly
- Compact rail temporarily expands on hover or keyboard focus
- Added navigation labels and native tooltips in compact mode
- Kept the sidebar expand/collapse control available in both desktop states
- Added medium-desktop spacing controls: Roomy, Balanced, and Dense
- Polished Run of Show toolbar wrapping, metrics, stage rows, and side panels
- Added maximum workspace width for ultra-wide displays
- Added viewport and connection diagnostics
- Added first-run compact-layout guidance
- Added responsive-shell QA validation
- Updated migration, cache, manifest, docs, and smoke tests

## V0.10 — Release Candidate

- Added Release Center
- Added guided Production setup checklist
- Added local QA test suite
- Added runtime error monitor
- Added Release Candidate readiness score and launch gate
- Added Simple Production and Full OS navigation modes
- Grouped sidebar navigation into Core Production, Operations, System, and Release
- Added text scaling, reduced motion, high contrast, and focus outline controls
- Added explicit Production/Admin permission-boundary guidance
- Added built-in shortcut help
- Added downloadable and copyable release report
- Added migration defaults for V0.09 browser data
- Added static package smoke-test harness
- Updated PWA cache and manifest metadata

## Important limitation

V0.10 remains a local-first static web application. It does not include real authentication, cloud synchronization, server-side backups, or multi-user concurrency.
