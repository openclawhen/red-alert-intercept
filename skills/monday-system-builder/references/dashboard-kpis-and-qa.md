# Dashboards, KPIs, and QA

## Role-based dashboard specs

## Executive dashboard
- KPI: throughput, on-time %, SLA breach count, aging backlog
- Widgets: numbers, timeline, high-risk table, workload by team

## Manager dashboard
- KPI: cycle time by stage, blocked items, team utilization, overdue by owner
- Widgets: battery/status chart, workload, pivot by team+status

## Operator dashboard
- KPI: my queue, items due this week, waiting approvals
- Widgets: filtered board view, calendar, reminders

## KPI definitions (must be explicit)

- **On-time %** = items completed on/before due date ÷ completed items
- **Cycle time** = done date - start date
- **Backlog aging** = today - created date for non-done items
- **SLA breach count** = items where breach flag = true

## UAT template

For each core flow, define:

1. Preconditions
2. Test data
3. User action
4. Expected board changes
5. Expected notifications/integrations
6. Pass/fail and evidence link

## Mandatory UAT scenarios

- New intake item -> triage -> approval -> execution -> done
- Rejection path and reopen path
- SLA breach and escalation path
- Permission boundary check (viewer vs editor vs owner)
- Dashboard numbers reconcile with board data

## Go-live checklist

- Freeze schema changes
- Backup/export critical boards
- Validate automations in staging/pilot workspace
- Announce operating SOP to all users
- Run day-1 hypercare with rapid fixes
