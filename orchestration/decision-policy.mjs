/**
 * Non-interactive project-decision and handoff checks.
 * The team lead executes native agent calls. This module never spawns agents,
 * runs shell commands, changes permissions, or certifies statistical validity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const policy = JSON.parse(readFileSync(new URL('./decision-policy.json', import.meta.url), 'utf8'));
const team = JSON.parse(readFileSync(new URL('./team.json', import.meta.url), 'utf8'));

function stringList(value, field) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new TypeError(`${field} must be a list of nonempty strings`);
  }
  return value;
}

export function decideAction({ action, flags = [], publicationChecksPassed = false } = {}) {
  if (typeof action !== 'string' || !action.trim()) throw new TypeError('action is required');
  stringList(flags, 'flags');
  if (typeof publicationChecksPassed !== 'boolean') throw new TypeError('publicationChecksPassed must be boolean');
  const result = (decision, reasons, role = 'lead') => ({
    action, decision, authority: decision === 'proceed' ? 'team_lead_delegation' : null,
    role, askUser: decision === 'new_user_authority_required', reasons,
    runtimePermissionsUnchanged: true,
    model: role === 'lead' ? 'preserve_current_chat_model' : team.roles.find(r => r.id === role)?.model ?? null,
    reasoningEffort: role === 'lead' ? null : team.roles.find(r => r.id === role)?.reasoning_effort ?? null,
  });
  const prohibited = flags.filter(flag => policy.prohibited.includes(flag));
  if (prohibited.length) return result('do_not_execute', prohibited);
  const newAuthority = flags.filter(flag => policy.requires_user_authority.includes(flag));
  if (newAuthority.length) return result('new_user_authority_required', newAuthority);
  const runtime = flags.filter(flag => policy.requires_runtime_approval.includes(flag));
  if (runtime.length) return result('use_runtime_approval_mechanism', runtime);
  const unknownFlags = flags.filter(flag => ![
    ...policy.prohibited, ...policy.requires_runtime_approval, ...policy.requires_user_authority,
  ].includes(flag));
  if (unknownFlags.length) return result('lead_review', ['unclassified_risk', ...unknownFlags]);
  if (!Object.hasOwn(policy.allowed_actions, action)) return result('lead_review', ['unclassified_action']);
  if (policy.publication_actions.includes(action) && !publicationChecksPassed) {
    return result('lead_repair_or_verify', ['publication_checks_not_passed']);
  }
  return result('proceed', ['in_scope_decision_delegated'], policy.allowed_actions[action]);
}

/**
 * Verify evidence completeness, not evidence truth. The lead must inspect the
 * referenced artifacts and review outputs; callers cannot self-approve content.
 */
export function assessHandoff({
  requiredArtifacts = [], deliveredArtifacts = [], checks = [],
  unresolvedFindings = [], needsIndependentReview = false,
  independentReview = 'not_required', reportedStatus = 'in_progress',
} = {}) {
  stringList(requiredArtifacts, 'requiredArtifacts');
  stringList(deliveredArtifacts, 'deliveredArtifacts');
  stringList(unresolvedFindings, 'unresolvedFindings');
  if (typeof needsIndependentReview !== 'boolean') throw new TypeError('needsIndependentReview must be boolean');
  if (!['in_progress', 'complete', 'blocked'].includes(reportedStatus)) throw new TypeError('Unknown reportedStatus');
  if (!['not_required', 'pending', 'passed', 'failed', 'unverified'].includes(independentReview)) throw new TypeError('Unknown independentReview');
  if (!Array.isArray(checks) || checks.some(check => !check || typeof check.name !== 'string' || !check.name.trim() || !['passed', 'failed', 'not_run', 'unverified'].includes(check.status))) {
    throw new TypeError('checks require a name and explicit status');
  }
  const missingArtifacts = requiredArtifacts.filter(item => !deliveredArtifacts.includes(item));
  const nonPassingChecks = checks.filter(check => check.status !== 'passed').map(check => `${check.name}:${check.status}`);
  const reviewIncomplete = ['pending', 'failed', 'unverified'].includes(independentReview)
    || needsIndependentReview && independentReview !== 'passed';
  const incomplete = !requiredArtifacts.length || !checks.length || missingArtifacts.length > 0 || nonPassingChecks.length > 0 || unresolvedFindings.length > 0 || reviewIncomplete;
  return {
    decision: reportedStatus === 'complete' && !incomplete ? 'lead_inspect_for_acceptance' : 'lead_repair_or_reassign',
    owner: 'lead', askUser: false, missingArtifacts, nonPassingChecks, reviewIncomplete,
    unresolvedFindings, reportedStatus,
    note: 'Completeness is not independent verification. The lead remains accountable.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , action, ...args] = process.argv;
    if (!action || args.some(arg => !arg.startsWith('--flag=') && arg !== '--publication-checks-passed')) {
      throw new Error('Usage: node orchestration/decision-policy.mjs ACTION [--flag=RISK] [--publication-checks-passed]');
    }
    const result = decideAction({ action, flags: args.filter(a => a.startsWith('--flag=')).map(a => a.slice(7)), publicationChecksPassed: args.includes('--publication-checks-passed') });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.decision === 'proceed' ? 0 : 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
