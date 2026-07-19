# Deployment Guide — V0.10 Release Candidate

## Static hosting

Upload the contents of this folder, preserving the directory structure. GitHub Pages is supported.

## Before controlled testing

1. Open Release Center.
2. Run the QA Test Suite after the site is hosted.
3. Export a Production backup.
4. Create a State Engine capture for the active fair.
5. Confirm the portal boundary says Production.
6. Review mobile, iPad, and desktop layouts.
7. Generate and save the Release Report.

## Data behavior

Production data is stored in browser localStorage. Different browsers and devices do not automatically share data.

Use:

- full JSON backup for the entire workspace
- Fair Package Exchange for a single fair
- State Captures and checkpoints before major changes

## Security boundary

Do not put Admin passwords, budgets, revenue, payments, private agreements, negotiations, insurance, or executive-only notes into this Production build.

A future Admin portal must use backend-enforced authentication. A password embedded in static JavaScript is not secure.
