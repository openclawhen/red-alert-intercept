# Monday Data Model Patterns

## Core objects

- Workspace: domain boundary
- Board: entity container
- Group: stage/category partition
- Item: primary record
- Subitem: child work package
- Update: event log/discussion

## Recommended board set for full systems

1. **Requests/Intake** board
2. **Projects/Initiatives** board
3. **Tasks/Execution** board
4. **Clients/Accounts** board (master)
5. **People/Capacity** board (optional)
6. **Risk/Issues** board (optional)

## Column design rules

- Use short, stable internal names.
- Keep required fields minimal for adoption.
- Prefer one canonical status per lifecycle.
- Use dropdowns for taxonomies that outgrow status labels.
- Use numbers + formula for SLA or scoring.

## Common column bundle (task-oriented)

- Item Name (text)
- Status (status)
- Priority (status/dropdown)
- Owner (people)
- Team (team)
- Start Date (date)
- Due Date (date)
- Effort (numbers)
- Actual Effort (numbers)
- SLA Breach Risk (formula)
- Dependency (connect boards or dependency)
- Client (connect boards -> clients)
- Project (connect boards -> projects)

## Formula examples

### Days to due
`DAYS({Due Date}, TODAY())`

### Late flag
`IF(AND({Status}!="Done", TODAY()>{Due Date}), "Late", "On Track")`

### SLA risk bucket
`IF({Days to Due}<0,"Breached",IF({Days to Due}<=2,"At Risk","Healthy"))`

## Normalization guidance

- Put reusable entities on dedicated master boards (clients/vendors/products).
- Mirror values for visibility, not as authoritative editable source.
- Avoid duplicated manual fields across boards if they can be connected/mirrored.
