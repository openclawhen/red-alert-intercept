---
name: monday-system-builder
description: Design, implement, and validate complete business systems inside monday.com (workspaces, boards, item hierarchy, columns, automations, dashboards, forms, permissions, and integrations). Use when a user asks to build or refactor a monday.com system from requirements/spec documents, map business workflows into monday structures, define implementation blueprints, generate automation formulas/recipes, or produce UAT and go-live checklists.
---

# Monday System Builder

Design an end-to-end monday.com implementation from a requirements document, then produce build-ready artifacts (board schema, automation recipes, dashboard specs, QA/UAT, and rollout plan).

## Quick start workflow

1. Classify the request: new system, refactor, migration, or audit.
2. Read requirements/spec and extract objectives, actors, lifecycle states, SLAs, and reporting needs.
3. Choose architecture pattern (single-board, hub-and-spoke, or domain-separated multi-board).
4. Produce build blueprint: boards, groups, columns, relations, mirrors, item hierarchy, and ownership.
5. Define automations/integrations with explicit trigger-condition-action logic.
6. Define dashboards/KPIs and operational views for each role.
7. Produce QA/UAT plan with test cases and go-live checklist.
8. If details are missing, ask only blocking questions and proceed with explicit assumptions.

## Output contract (always provide)

Return results in this order:

1. **Assumptions & gaps** (short list)
2. **Target architecture** (boards and relationships)
3. **Board-by-board schema** (columns, types, required fields, formulas)
4. **Automation plan** (plain-language recipes + exact pseudo-logic)
5. **Dashboards & KPIs** (widget-level spec)
6. **Permissions & governance**
7. **QA/UAT checklist**
8. **Implementation phases** (MVP -> v1 -> v2)

Keep output implementation-ready, not conceptual.

## Decision rules

- Prefer simpler architecture first; add complexity only for scale, security, or reporting constraints.
- Keep status models small and unambiguous; avoid overlapping statuses.
- Use connected boards for normalized entities reused across teams (clients, vendors, assets).
- Use formula columns for deterministic calculations; use automations for event-driven updates.
- Avoid automation loops; note loop risks explicitly.
- Design dashboards by role (exec, manager, operator), not by raw data availability.
- Define one source of truth per field.

## Blocking questions only

Ask only when missing info prevents a safe design decision. Typical blockers:

- Required hierarchy (task/subitem/portfolio level)
- Compliance/privacy constraints
- Ownership model and permission boundaries
- Must-have KPIs or SLA rules
- External systems that must sync bi-directionally

If non-blocking details are missing, continue with assumptions.

## References

Read only what you need:

- For discovery and mapping requirements -> `references/intake-and-solution-design.md`
- For schema and board modeling patterns -> `references/monday-data-model-patterns.md`
- For automations and integration patterns -> `references/automation-recipes.md`
- For dashboards, QA, and rollout -> `references/dashboard-kpis-and-qa.md`
- For custom app/extensibility choices -> `references/monday-apps-extension-guide.md`

## Response style

- Be concrete and operational.
- Use bullets/tables only when they increase implementation speed.
- Prefer copy/paste-ready formulas and automation rules.
- Flag risks and tradeoffs explicitly.
