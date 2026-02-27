# Monday Apps Extension Guide

Use this guide when native monday features are insufficient.

## Build-vs-buy decision

Choose native/automation first. Escalate to custom app only if one or more apply:

- Complex UI interaction needed inside item/board views
- Advanced business rules not maintainable in recipes/formulas
- Secure external API calls requiring controlled backend
- Reusable custom widget across many boards/workspaces

## Extension options

1. monday app (board/item/dashboard app)
2. Integration recipe app
3. External automation via Make/Zapier/n8n
4. Internal microservice + webhook integration

## Implementation safeguards

- Keep app config environment-specific (dev/stage/prod)
- Log every write-back action with correlation id
- Enforce retries with idempotency for webhook consumers
- Document fallback behavior when external service is down

## App handoff artifacts

- API contract and auth model
- Event map (trigger -> payload -> action)
- Error catalog and operator runbook
- Monitoring KPIs (success rate, latency, failure causes)
