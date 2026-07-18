# OATF Admin Portal — V0.01

A static, browser-persistent operations workspace for Out at the Fair®.

## Built in V0.01

- Demo login with session memory
- LocalStorage-backed dashboard data
- Create fair workspaces
- Create, filter, drag, complete, and delete tasks
- Add talent and move performers through pipeline stages
- Add calendar deadlines and navigate months
- Add local file records
- Post shared fair notes
- Log and update day-of issues
- Dynamic overview metrics
- Dynamic fair workspace counts
- Search fairs, tasks, talent, and files with Command/Ctrl + K
- Activity logging for local changes
- JSON export/import backups
- Reset demo data
- Mobile sidebar support

## Important

No external services are connected yet. Data is stored only in the browser using `localStorage`.

Use **Settings → Export JSON backup** before clearing browser data or switching devices.

Open `index.html` locally or deploy the folder to GitHub Pages.


## V0.02 — Smart Operations Layer

- New Smart Brief executive view
- Season-wide readiness score
- Individual fair readiness scores
- Automatic task risk scoring
- Overdue and approaching deadline detection
- Waiting/blocked task detection
- Talent pipeline risk detection
- Recommended next actions
- Dependency mapping using “Blocked by”
- Estimated remaining effort tracking
- Weekly momentum dashboard
- Automatic migration from V0.01 local data
- Smart Brief shortcut in the top bar
