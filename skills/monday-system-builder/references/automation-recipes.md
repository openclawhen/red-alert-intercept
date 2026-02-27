# Automation Recipes

## Authoring format

Define each automation with:
- Name
- Trigger
- Conditions
- Actions
- Failure/loop risk note

## Recipe library

## 1) Status transition notification
- Trigger: status changes to "Ready for Review"
- Action: notify reviewer + create update mentioning owner and ETA

## 2) SLA escalation
- Trigger: date arrives and status is not done
- Conditions: priority in [High, Critical]
- Actions: set escalation status, notify manager, assign backup owner

## 3) Auto-create execution tasks
- Trigger: intake item approved
- Actions: create item/subitems in execution board, map owner/team, connect to source item

## 4) Cross-board sync (lightweight)
- Trigger: project phase changed
- Actions: push mirror-visible phase update to related tasks
- Note: preserve one source of truth; avoid two-way race conditions

## 5) Approval gate
- Trigger: status set to "Awaiting Approval"
- Actions: notify approver, set due date +2 business days, lock downstream status until approved

## Integration patterns

## Inbound (external -> monday)
- Form/webhook/CRM event creates or updates intake item
- Use idempotency key column to avoid duplicates

## Outbound (monday -> external)
- On status transitions, call Make/Zapier/custom webhook
- Send only required fields; avoid exposing private notes unless explicitly approved

## Anti-patterns

- Chained automations without ownership
- Multiple automations writing same status field
- Hidden business logic in many disconnected recipes
- Two-way sync without conflict strategy
