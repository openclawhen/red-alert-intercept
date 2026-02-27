# Intake and Solution Design

## Discovery checklist

Capture these before final design:

1. Business goal and success metric
2. Actor roles (requester, approver, executor, reviewer, leadership)
3. Workflow states from intake to done/canceled
4. SLA/urgency rules and escalation path
5. Required artifacts (files, approvals, comments, signatures)
6. Reporting requirements by role
7. Permission boundaries (team/private/shareable)
8. Integrations (CRM/ERP/support/email/forms)
9. Volume assumptions (items per day, active projects, historical retention)
10. Migration scope (legacy data, cutover date, parallel run)

## Requirement-to-monday mapping

- Entity -> Board or Item type
- Lifecycle state -> Status column
- Ownership -> People/Team column
- Due target -> Date + SLA formula + automation
- Cross-entity relation -> Connect boards + Mirror
- Stage gate/approval -> Status + approval automation + updates feed
- Intake -> monday form or integration webhook

## Architecture pattern chooser

## 1) Single-board
Use when process is linear, one team owns delivery, and reporting is simple.

Pros: fast setup, easy adoption
Cons: low normalization, harder scaling

## 2) Hub-and-spoke (recommended default)
Use when core entities are shared (clients, projects, requests, tasks).

Pros: reusable data, better reporting, cleaner ownership
Cons: more setup complexity

## 3) Domain-separated multi-board
Use when business units or privacy rules require separation.

Pros: strict governance, team autonomy
Cons: heavier integration/reporting layer

## Design deliverables

Always produce:
- Board inventory and purpose
- Relationship diagram (textual if no visual)
- Column dictionary per board
- Automation catalog with owner
- Dashboard catalog by role
- UAT scenarios mapped to business outcomes
