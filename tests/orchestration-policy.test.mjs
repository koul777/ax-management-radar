import assert from 'node:assert/strict';
import test from 'node:test';
import { decideAction, assessHandoff } from '../orchestration/decision-policy.mjs';

test('ordinary decisions proceed under lead authority without user prompts', () => {
  for (const action of ['inspect', 'test', 'implement_in_scope', 'choose_visual', 'repair_failed_work', 'update_docs', 'reassign_task']) {
    assert.equal(decideAction({ action }).decision, 'proceed');
    assert.equal(decideAction({ action }).askUser, false);
  }
});
test('model routing is read from the actual team configuration', () => {
  assert.equal(decideAction({ action: 'review_statistical_claim' }).model, 'gpt-6-astra');
  assert.equal(decideAction({ action: 'verify_literature' }).model, 'gpt-5.6-sol');
  assert.equal(decideAction({ action: 'implement_in_scope' }).model, 'gpt-5.6-terra');
  assert.equal(decideAction({ action: 'test' }).model, 'gpt-5.6-luna');
  assert.equal(decideAction({ action: 'reassign_task' }).model, 'preserve_current_chat_model');
});
test('already authorized publication still requires completed checks', () => {
  for (const action of ['commit', 'push', 'deploy_existing_site', 'publish_approved_aggregates', 'publish_promo']) {
    assert.equal(decideAction({ action }).decision, 'lead_repair_or_verify');
    assert.equal(decideAction({ action, publicationChecksPassed: true }).decision, 'proceed');
  }
});
test('runtime approval cannot be replaced by lead delegation', () => {
  const result = decideAction({ action: 'push', flags: ['runtime_permission_required'], publicationChecksPassed: true });
  assert.equal(result.decision, 'use_runtime_approval_mechanism');
  assert.equal(result.authority, null);
  assert.equal(result.runtimePermissionsUnchanged, true);
});
test('prohibited exposure or bypass never proceeds', () => {
  for (const flag of ['bypass_permissions', 'expose_credentials', 'publish_respondent_data']) {
    assert.equal(decideAction({ action: 'publish_promo', flags: [flag], publicationChecksPassed: true }).decision, 'do_not_execute');
  }
});
test('material scope changes are not implied by delegated HITL', () => {
  for (const flag of ['new_cost', 'external_contact_not_authorized', 'destructive_outside_request', 'material_scope_expansion']) {
    assert.equal(decideAction({ action: 'implement_in_scope', flags: [flag] }).decision, 'new_user_authority_required');
  }
});
test('runtime permission never masks missing project authority or a prohibition', () => {
  const base = { action: 'publish_promo', publicationChecksPassed: true };
  const scoped = decideAction({ ...base, flags: ['runtime_permission_required', 'new_cost'] });
  assert.equal(scoped.decision, 'new_user_authority_required');
  assert.equal(scoped.askUser, true);
  const prohibited = decideAction({ ...base, flags: ['runtime_permission_required', 'new_cost', 'publish_respondent_data'] });
  assert.equal(prohibited.decision, 'do_not_execute');
});
test('unknown risks and action names go to the lead, not automatic user questions', () => {
  for (const request of [{ action: 'unknown' }, { action: '__proto__' }, { action: 'test', flags: ['unclassified'] }]) {
    const result = decideAction(request);
    assert.equal(result.decision, 'lead_review');
    assert.equal(result.askUser, false);
  }
});
test('malformed approval inputs are rejected, not coerced', () => {
  for (const request of [{}, { action: 'test', flags: 'none' }, { action: 'push', publicationChecksPassed: 'true' }]) {
    assert.throws(() => decideAction(request));
  }
});
const complete = {
  requiredArtifacts: ['output.mp4', 'review.md'], deliveredArtifacts: ['output.mp4', 'review.md'],
  checks: [{ name: 'decode', status: 'passed' }], unresolvedFindings: [],
  needsIndependentReview: true, independentReview: 'passed', reportedStatus: 'complete',
};
test('a complete report is routed to actual lead inspection, not auto-approved', () => {
  assert.equal(assessHandoff(complete).decision, 'lead_inspect_for_acceptance');
});
test('missing artifacts are recovered by the lead', () => {
  const result = assessHandoff({ ...complete, deliveredArtifacts: ['output.mp4'] });
  assert.deepEqual(result.missingArtifacts, ['review.md']);
  assert.equal(result.decision, 'lead_repair_or_reassign');
  assert.equal(result.askUser, false);
});
test('failed, unrun or unverified checks cannot be reported complete', () => {
  for (const status of ['failed', 'not_run', 'unverified']) {
    assert.equal(assessHandoff({ ...complete, checks: [{ name: 'decode', status }] }).decision, 'lead_repair_or_reassign');
  }
});
test('review failures, missing checks and open findings cannot silently pass', () => {
  for (const patch of [{ independentReview: 'pending' }, { independentReview: 'failed' }, { independentReview: 'unverified' }, { checks: [] }, { unresolvedFindings: ['unreadable denominator'] }, { requiredArtifacts: [] }, { reportedStatus: 'blocked' }]) {
    assert.equal(assessHandoff({ ...complete, ...patch }).decision, 'lead_repair_or_reassign');
  }
});
test('an optional review failure cannot be erased by marking review as not required', () => {
  for (const independentReview of ['pending', 'failed', 'unverified']) {
    const result = assessHandoff({ ...complete, needsIndependentReview: false, independentReview });
    assert.equal(result.decision, 'lead_repair_or_reassign');
    assert.equal(result.reviewIncomplete, true);
  }
});
test('malformed handoff data is rejected', () => {
  for (const patch of [{ checks: [{ name: 'x', status: true }] }, { deliveredArtifacts: null }, { needsIndependentReview: 'false' }, { independentReview: 'probably' }]) {
    assert.throws(() => assessHandoff({ ...complete, ...patch }));
  }
});
