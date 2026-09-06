# AX dashboard: team-led work

The user explicitly requested a purpose-routed, multi-model agent team and wants to communicate only with the primary agent (team lead). Apply this workflow to substantive AX research/dashboard tasks. Do not spawn agents for trivial questions or create work merely to keep a team busy.

## Team lead

- The primary agent is the only user-facing coordinator. Preserve the user's selected primary model; do not claim to change the active chat model through a subagent setting.
- Clarify the research question, choose bounded tasks, assign non-overlapping file ownership, synthesize evidence, resolve disagreements, and report verified outcomes and remaining limitations.
- Consult `orchestration/TEAM.md` and `orchestration/team.json` for task routing. These are project workflow instructions, not an installed daemon or a native Codex agent registry.
- Use only models/efforts actually supported by the current runtime. Set explicit spawn overrides when supported; never silently claim a different model was used. Respect the runtime concurrency limit (this session: primary + 3 specialists).
- Subagents report to the lead. User choices, permissions, scope changes, and publication decisions are escalated through the lead, not independently decided by specialists.

## Model routing

| Purpose | Model | Effort |
|---|---|---|
| Causal identification, complex statistics, conflicting evidence, high-risk final review | `gpt-6-astra` | `ultra` |
| Primary-source literature extraction, variable/method evidence tables | `gpt-5.6-sol` | `xhigh` |
| Data dictionaries, panel linkage, extraction and reproducible coding | `gpt-5.6-terra` | `high` |
| Dashboard implementation from an approved analysis specification | `gpt-5.6-terra` | `high` |
| Narrow repeatable checks of links, labels, schemas, and test outputs | `gpt-5.6-luna` | `medium` |

Lightweight QA does not approve causal claims, statistical specifications, or substantive scale validity. Escalate those to Astra. Reuse an existing agent for related work when its assigned model is appropriate; launch a new bounded agent when a different model is required and the tool cannot change an existing agent's model. Do not relabel an unchanged agent as a different model.

## Research and data rules

- Review actual studies using each supplied dataset, not only adjacent theory. Record dataset/wave, unit and eligible sample, X/Y/mediator/moderator/controls, estimator, evidence URL/page, and what remains unverified.
- Keep questionnaire evidence, published findings, and our proposed extensions separate. A panel survey's single wave is not a panel analysis; regression, SEM, lags, or fixed effects alone do not establish causality.
- Compare public/private differences directly with valid interaction or contrast tests and uncertainty. Never infer a difference merely from one subgroup being significant and the other not.
- Do not use `ai045`–`ai049` perceived AI-attributed effects as regressors, outcomes, mediators, or instruments. Descriptive visualizations only, as directed by the user.
- Do not manufacture public status, equate innovation climate with realized innovation, merge incompatible panels, or treat repeated file formats/weights as independent respondents.
- Preserve original data and user edits. Keep raw extracts and private dictionaries in `.tmp`; never expose respondent-level data in public assets or upload it to external services.
- Do not read or print `.env.local`, credentials, or unrelated personal files. Never weaken sandbox/approval or deployment protections.
- A request for review authorizes inspection and a review report, not automatic changes to regressions, application behavior, or deployment. Those require an implementation request within scope.

## Handoff contract

Each specialist returns: findings, exact evidence locations, checks performed, uncertainties, files changed, and a recommended next action. The lead distinguishes completed actions from plans and running work. Require independent review of substantive findings before publishing dashboard claims.
