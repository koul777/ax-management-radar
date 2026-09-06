import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const excluded = new Set((await readFile(path.join(root, ".vercelignore"), "utf8")).split(/\r?\n/).map((line) => line.trim()));
for (const rule of [".tmp", ".codex", ".agents", "orchestration", "*.dta", "*.DTA", "*.sav", "*.SAV", "*.xlsx", "*.xls", "*.pdf", "*.zip", "*.hwp", "*.hwpx", ".env*"]) {
  assert.ok(excluded.has(rule), `Missing release exclusion: ${rule}`);
}
for (const legacy of ["app/data/hccp-innovation-analysis.json", "app/data/workforce-ai-analysis.json"]) {
  assert.ok(excluded.has(legacy), `Excluded dataset must not be uploaded: ${legacy}`);
}

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      const resolved = path.join(directory, entry.name);
      result.push(...(entry.isDirectory() ? await walk(resolved) : [resolved]));
    }
    return result;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

for (const filename of await walk(path.join(root, "public"))) {
  assert.doesNotMatch(filename, /\.(dta|sav|xlsx?|csv|tsv|zip|pdf|hwpx?|txt)$/i, "Source data must not be in public assets");
}
for (const filename of (await walk(path.join(root, "app"))).filter((name) => /\.[jt]sx?$/.test(name))) {
  const source = await readFile(filename, "utf8");
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*["'][^"']*(?:\.tmp[\\/]|\.dta|\.sav|\.xlsx|\.hwp|\.env)/i, `Unsafe source import: ${path.basename(filename)}`);
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*["'][^"']*(?:hccp-innovation-analysis|workforce-ai-analysis)/i, "Historical HCCP bundles must not be imported");
}

for (const filename of (await walk(path.join(root, "app", "data"))).filter((name) => name.endsWith(".json"))) {
  const content = await readFile(filename, "utf8");
  JSON.parse(content);
  assert.ok(!/(?:^|["'\s])[a-z]:[\\/]|file:\/\/|\.tmp[\\/]|(?:sk-proj-|sk-ant-)[a-z0-9_-]{15,}/i.test(content), `Private path or credential in aggregate payload: ${path.basename(filename)}`);
}

function validateUncertainty(model, term) {
  assert.doesNotMatch(term.id, /ai04[5-9]/i, "Attribution perceptions must not enter regressions");
  for (const key of ["beta", "se", "ci_low", "ci_high", "p"]) {
    assert.ok(Number.isFinite(term[key]), `${model.id}/${term.id}: non-finite ${key}`);
  }
  assert.ok(term.se >= 0 && term.p >= 0 && term.p <= 1, `${model.id}/${term.id}: invalid uncertainty`);
  assert.ok(term.ci_low <= term.beta + 1e-7 && term.beta <= term.ci_high + 1e-7, `${model.id}/${term.id}: invalid confidence interval`);
  if (term.p_holm !== undefined) {
    assert.ok(Number.isFinite(term.p_holm) && term.p_holm >= term.p - 1e-12 && term.p_holm <= 1, `${model.id}/${term.id}: invalid Holm p`);
  }
}

for (const basename of ["wps-ax-analysis.json"]) {
  const payload = JSON.parse(await readFile(path.join(root, "app", "data", basename), "utf8"));
  assert.ok(payload.meta && Array.isArray(payload.models), `${basename}: missing model metadata`);
  const allModels = [...payload.models, ...(payload.readiness_models ?? []), ...(payload.withheld_models ?? [])];
  assert.equal(new Set(allModels.map((model) => model.id)).size, allModels.length, `${basename}: duplicate model id`);
  const estimated = allModels.filter((model) => model.status === "estimated");
  assert.ok(estimated.length > 0, `${basename}: no estimated model`);
  for (const model of estimated) {
    assert.ok(model.n > 0 && Number.isInteger(model.n), `${model.id}: invalid N`);
    assert.ok(model.coefficients.length > 0, `${model.id}: missing coefficients`);
    assert.doesNotMatch([model.outcome_column, model.formula].filter(Boolean).join(" "), /ai04[5-9]/i, `${model.id}: prohibited attribution variable`);
    for (const term of [...model.coefficients, ...(model.contrasts ?? [])]) validateUncertainty(model, term);
  }
  for (const model of allModels.filter((model) => model.status === "withheld")) {
    assert.ok(model.withheld_reason || model.warnings?.length, `${model.id}: missing withholding reason`);
    assert.equal(model.contrasts?.length ?? 0, 0, `${model.id}: withheld numerical contrast still published`);
  }
  for (const model of payload.withheld_models ?? []) {
    assert.equal(model.measurement_status, "withheld_ambiguous_target");
    assert.ok(model.withheld_reason, `${model.id}: missing measurement audit reason`);
  }
  console.log(`${basename}: ${estimated.length} numerical model records checked (including audit-only retained records)`);
}

const wps = JSON.parse(await readFile(path.join(root, "app/data/wps-ax-analysis.json"), "utf8"));
assert.equal(wps.key_items.length, 30);
assert.equal(wps.governance.length, 19);
for (const item of [...wps.key_items, ...wps.governance]) {
  for (const sector of ["public", "private"]) {
    const group = item[sector];
    assert.ok(group && group.valid_n <= group.eligible_n && group.weighted_n <= group.valid_n, `${item.id}/${sector}: invalid denominator`);
    assert.equal(group.responses.reduce((n, response) => n + response.n, 0), group.valid_n, `${item.id}/${sector}: response N mismatch`);
    assert.equal(group.responses.reduce((n, response) => n + response.weighted_n, 0), group.weighted_n, `${item.id}/${sector}: weighted N mismatch`);
    if (group.source_n !== undefined) assert.equal(group.eligible_n + group.excluded_n, group.source_n);
    for (const field of ["share", "weighted_share"]) {
      const validN = field === "share" ? group.valid_n : group.weighted_n;
      if (!validN) continue;
      assert.ok(group.responses.every((response) => Number.isFinite(response[field]) && response[field] >= 0 && response[field] <= 1), `${item.id}/${sector}: invalid ${field}`);
      assert.ok(Math.abs(group.responses.reduce((n, response) => n + response[field], 0) - 1) < 1e-8, `${item.id}/${sector}: shares do not sum to 1`);
    }
  }
}
const explorer = JSON.parse(await readFile(path.join(root, "app/data/wps-explorer.json"), "utf8"));
assert.deepEqual(explorer.years, [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023]);
assert.deepEqual(explorer.size_groups.map((group) => group.id), ["all", "under300", "300_999", "1000_plus"]);
assert.equal(explorer.slices.length, 40);
assert.equal(new Set(explorer.slices.map((slice) => `${slice.year}/${slice.private_size_id}`)).size, 40);
for (const year of explorer.years) {
  const slices = explorer.slices.filter((slice) => slice.year === year);
  const all = slices.find((slice) => slice.private_size_id === "all");
  assert.ok(all, `${year}: missing all-private reference`);
  assert.equal(slices.filter((slice) => slice.private_size_id !== "all").reduce((n, slice) => n + slice.private_n, 0) + all.private_size_missing_n, all.private_n, `${year}: private size bands do not partition valid-size records`);
  for (const slice of slices) {
    assert.equal(slice.public_n, all.public_n, `${year}: public reference changed across private sizes`);
    assert.equal(slice.weight_column, `c_wgt${String(year).slice(-2)}`);
    assert.equal(slice.key_items.length, year === 2023 ? 30 : year >= 2015 ? 5 : 2);
    assert.equal(slice.key_items.some((item) => item.column === "ai001"), year === 2023);
    if (year !== 2023) {
      assert.equal(slice.public_ai_n, null);
      assert.equal(slice.private_ai_n, null);
    }
    for (const item of slice.key_items) {
      assert.ok(item.source?.file && item.source.section && item.period && item.eligibility);
      if (year !== 2023) assert.doesNotMatch(`${item.period} ${item.eligibility}`, /2023/, `${year}/${item.id}: stale 2023 metadata`);
      assert.deepEqual(item.public, all.key_items.find((reference) => reference.id === item.id).public);
      for (const sector of ["public", "private"]) {
        const group = item[sector];
        const context = `${year}/${slice.private_size_id}/${item.id}/${sector}`;
        assert.equal(group.source_n, group.eligible_n + group.excluded_n, context);
        assert.equal(group.eligible_n, group.valid_n + group.missing_n, context);
        assert.equal(group.valid_n, group.informative_n + group.unknown_n, context);
        assert.ok(group.weighted_n <= group.valid_n, context);
        if (group.suppressed) {
          assert.ok(group.valid_n < 5, context);
          assert.ok(group.responses.every((response) => ["n", "share", "weighted_n", "weighted_share"].every((field) => response[field] === null)), `${context}: suppressed values leaked`);
          continue;
        }
        assert.ok(group.valid_n === 0 || group.valid_n >= 5, `${context}: tiny distribution was not suppressed`);
        assert.equal(group.responses.reduce((n, response) => n + response.n, 0), group.valid_n, context);
        assert.equal(group.responses.reduce((n, response) => n + response.weighted_n, 0), group.weighted_n, context);
        for (const response of group.responses) {
          assert.equal(response.share, group.valid_n ? response.n / group.valid_n : null, context);
          assert.ok(response.weighted_share === null || (Number.isFinite(response.weighted_share) && response.weighted_share >= 0 && response.weighted_share <= 1), context);
        }
        if (group.weighted_n) assert.ok(Math.abs(group.responses.reduce((n, response) => n + response.weighted_share, 0) - 1) < 1e-8, context);
      }
    }
  }
}
for (const [id, n, ai] of [["under300", 1837, 83], ["300_999", 360, 47], ["1000_plus", 76, 20]]) {
  const slice = explorer.slices.find((entry) => entry.year === 2023 && entry.private_size_id === id);
  assert.equal(slice.private_n, n);
  assert.equal(slice.private_ai_n, ai);
  assert.equal(slice.public_n, 96);
  assert.equal(slice.public_ai_n, 21);
}
const primary = wps.readiness_models.find((model) => model.id === "readiness_lag21_joint_ols");
const logit = wps.readiness_models.find((model) => model.id === "readiness_lag21_joint_logit_probability_sensitivity");
assert.ok(primary && logit, "Missing primary model or logit sensitivity attempt");
assert.equal(logit.same_complete_case_as, primary.id);
assert.equal(logit.n, primary.n);
assert.deepEqual(logit.groups, primary.groups);
if (logit.status === "estimated") {
  assert.equal(logit.diagnostics.converged, true);
  assert.equal(logit.diagnostics.probability_bounds_verified, true);
  assert.ok(logit.coefficients.every((term) => term.scale === "log_odds_audit_only"));
  assert.ok(logit.contrasts.every((term) => term.scale === "standardized_probability_change"));
  assert.ok(logit.standardized_probabilities.every((term) => Number.isFinite(term.probability) && term.probability >= 0 && term.probability <= 1));
}

const evidence = JSON.parse(await readFile(path.join(root, "app/data/research-evidence.json"), "utf8"));
assert.equal(evidence.studies.length, 10);
assert.equal(new Set(evidence.studies.map((study) => study.id)).size, 10);
assert.ok(evidence.studies.every((study) => !/hccp|인적자본/i.test(study.dataset)), "Excluded HCCP studies still active");
for (const study of evidence.studies) {
  for (const field of ["dataset", "title", "citation", "unit", "x", "y", "controls", "method", "tier", "transferLimit"]) {
    assert.ok(typeof study[field] === "string" && study[field].trim(), `${study.id}: missing evidence field ${field}`);
  }
  assert.equal(new URL(study.sourceUrl).protocol, "https:", `${study.id}: invalid public source URL`);
}
let supplementalQuestions = 0;
for (const basename of ["supplemental-public.json", "supplemental-kipa-digital.json", "supplemental-personal.json", "supplemental-workforce.json"]) {
  const payload = JSON.parse(await readFile(path.join(root, "app/data", basename), "utf8"));
  assert.ok(payload.datasets.length > 0);
  for (const dataset of payload.datasets) {
    assert.ok(dataset.scope && dataset.weight_note && dataset.evidence.length && dataset.cautions.length);
    if (dataset.scope_type === "public_internal") assert.equal(dataset.publication_status, "approved", `${dataset.id}: user-authorized aggregate publication must not remain pending`);
    if (dataset.publication_status === "pending_usage_confirmation") {
      assert.equal(dataset.sample, null, `${dataset.id}: pending sample leaked`);
      for (const field of ["questions", "models", "findings", "transitions"]) assert.equal(dataset[field]?.length ?? 0, 0, `${dataset.id}: pending ${field} leaked`);
      continue;
    }
    assert.ok(dataset.sample && dataset.sample.analysis_n > 0);
    assert.equal(dataset.sample.raw_n, dataset.sample.analysis_n + dataset.sample.excluded_n);
    assert.equal(dataset.models.length, 0, "Supplemental release is descriptive only; new models need independent approval");
    for (const question of dataset.questions) {
      supplementalQuestions++;
      assert.ok(question.source_code && question.source_note && question.universe);
      for (const group of question.groups) {
        assert.equal(group.eligible_n, group.valid_n + group.missing_n, `${question.id}/${group.id}: denominator mismatch`);
        assert.ok(group.unknown_n <= group.valid_n, "Known don't-know responses stay within valid N");
        if (group.suppressed) {
          assert.ok(group.valid_n < 5, `${question.id}/${group.id}: invalid suppression threshold`);
          assert.ok(group.responses.every((response) => response.n === null && response.share === null), `${question.id}/${group.id}: suppressed cells leaked`);
          continue;
        }
        if (!question.multiple_response) assert.equal(group.responses.reduce((n, r) => n + r.n, 0), group.valid_n);
        else assert.match(question.scale, /복수응답/, `${question.id}: multiple-response scale must be explicit`);
        for (const response of group.responses) {
          assert.ok(Number.isInteger(response.n) && response.n >= 0 && response.n <= group.valid_n, `${question.id}/${group.id}: invalid response count`);
          if (!group.valid_n) assert.equal(response.share, null);
          else assert.ok(Number.isFinite(response.share) && Math.abs(response.share - response.n / group.valid_n) < 1e-8, `${question.id}/${group.id}: share does not match valid N (allowing stored 8-decimal rounding)`);
        }
      }
    }
    for (const transition of dataset.transitions ?? []) {
      assert.equal(transition.rows.reduce((n, row) => n + row.n, 0), transition.n);
      assert.ok(transition.note && transition.unit && transition.period);
    }
  }
}
const perceptions = JSON.parse(await readFile(path.join(root, "app/data/wps-attribution-perceptions.json"), "utf8"));
assert.deepEqual(Object.keys(perceptions), ["wps"]);
assert.deepEqual(Object.keys(perceptions.wps), ["perceptions"]);
assert.equal(perceptions.wps.perceptions.length, 5);
assert.ok(perceptions.wps.perceptions.every((item) => item.usage === "descriptive_only"));
console.log(`Release checks passed: HCCP excluded, raw files/private paths blocked, WPS models retained, 40 year/size slices, 10 evidence records, ${supplementalQuestions} supplemental questions. User-authorized KIPA aggregates and suppression contract verified. This is not a causal approval.`);
