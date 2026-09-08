#!/usr/bin/env python3
"""Validate packaged data against source totals and declared conventions.

Usage: python3 path/to/innovation-data-pack/scripts/validate_data.py
Uses only the Python standard library. Does not fetch data or mutate inputs.
"""
import collections
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))

def require(condition, message):
    if not condition:
        raise ValueError(message)

def unique(rows, field):
    require(len({r[field] for r in rows}) == len(rows), f'Duplicate {field}')

def main():
    sources = read('data/source-catalog.json')
    metrics = read('data/metrics.json')
    obs = read('data/observations.json')
    agency = read('data/agency-evaluations.json')
    local = read('data/local-enterprise-evaluations.json')
    variables = read('data/variable-map.json')
    manifest = read('metadata/package-manifest.json')
    counts = manifest['counts']
    for rows, field in [(sources,'source_id'),(metrics,'metric_id'),(obs,'observation_id'),(agency,'record_id'),(local,'record_id')]:
        unique(rows,field)
    source_ids = {r['source_id'] for r in sources}
    require(len(sources)==counts['source_catalog_rows']==38, 'Source count')
    require(sum(s['novelty']=='new' for s in sources)==counts['new_sources']==36, 'New source count')
    require(len(agency)==counts['agency_evaluation_rows']==1554, 'Agency record count')
    require(len(local)==counts['local_enterprise_evaluation_rows']==2150, 'Local enterprise record count')
    require(len(obs)==counts['observation_rows']==278, 'Observation count')
    require(len(metrics)==counts['metric_rows']==81, 'Metric count')
    require(len(variables)==counts['variable_map_rows']==32, 'Variable map count')
    for rows in [metrics,obs,agency,local,variables]:
        require(all(r['source_id'] in source_ids for r in rows), 'Unknown source reference')
    for source in sources:
        require(source['landing_url'].startswith('https://'), 'Missing official source URL')
        for path in source['included_data_files']:
            require((ROOT/path).is_file(), f'Missing declared data file: {path}')

    metric_by_id = {r['metric_id']:r for r in metrics}
    obs_keys=set()
    for row in obs:
        m=metric_by_id[row['metric_id']]
        require((row['source_id'],row['metric_label'],row['unit']) == (m['source_id'],m['metric_label'],m['unit']), 'Metric definition mismatch')
        k=(row['source_id'],row['metric_id'],row['reference_period'],row['group_label'])
        require(k not in obs_keys, 'Duplicate observation identity')
        obs_keys.add(k)
        require(bool(row['denominator_label']) and bool(row['source_location']) and row['source_url'].startswith('https://'), 'Observation provenance incomplete')
        v=row['value']
        if v is None:
            require(row['value_status']=='not_asked' and row['source_id']=='D14' and row['year']==2020, 'Unexpected missing data')
            continue
        require(row['value_status']=='observed', 'Numeric value with missing status')
        require(isinstance(v,(float,int)) and not isinstance(v,bool) and math.isfinite(v), 'Non-finite or non-numeric value')
        if row['unit'] in ['percent','index_0_100']:
            require(0<=v<=100, 'Percent/index outside0..100')
        else:
            require(v>=0, 'Negative count/amount')
        if row['unit'] in ['cases','institutions','persons']:
            require(int(v)==v, 'Fractional count')
    require(sum(r['value'] is None for r in obs)==counts['not_asked_observations']==3,'Missing count')
    require(sum(r['value'] is not None for r in obs)==counts['numeric_observations']==275,'Numeric count')

    # Independently documented full-population totals from the official evaluation tables.
    expected_grades={
        'D01':{'매우우수':34,'우수':304,'보통':134,'미흡':64,'매우미흡':148},
        'D02':{'매우우수':57,'우수':291,'보통':121,'미흡':67,'매우미흡':148},
        'D03':{'매우우수':12,'우수':65,'보통':84,'미흡':20,'매우미흡':2,'평가제외':3},
    }
    mois_categories={'중앙행정기관':47,'광역자치단체':17,'기초자치단체':226,'공기업·준정부기관':88,'지방공기업':47,'기타공공기관':242,'시도교육청':17}
    for sid,expected in expected_grades.items():
        rows=[r for r in agency if r['source_id']==sid]
        require(dict(collections.Counter(r['grade'] for r in rows))==expected, f'{sid} grade totals differ from source')
        require(len({r['institution_name'] for r in rows})==len(rows), f'{sid} duplicate institution name')
        cats=mois_categories if sid!='D03' else {'공기업':20,'준정부기관':54,'기타공공기관':112}
        require(dict(collections.Counter(r['institution_category'] for r in rows))==cats, f'{sid} institution category totals')
    for row in agency:
        require(row['evaluation_year']==2025, 'Unexpected agency evaluation year')
        require(row['source_page']>0, 'Missing source page')
        require(row['record_status']==('excluded' if row['grade']=='평가제외' else 'graded'), 'Grade/status mismatch')

    local_by_row=collections.defaultdict(list)
    for row in local:
        require(row['performance_year']==row['evaluation_year']-1, 'Local performance year mismatch')
        expected={'대상아님':'not_applicable','기타':'other'}.get(row['grade'],'graded')
        require(row['record_status']==expected, 'Local grade/status mismatch')
        local_by_row[row['source_row_number']].append(row)
    require(len(local_by_row)==430, 'Local source row total')
    require(all({r['evaluation_year'] for r in rows}==set(range(2021,2026)) for rows in local_by_row.values()),'Local missing year')
    require(dict(collections.Counter(r['grade'] for r in local))=={'가':122,'나':367,'다':675,'라':125,'마':38,'대상아님':821,'기타':2}, 'Local source grade totals')
    collisions=[r for r in local if r['institution_name']=='고성군상수도']
    require(len(collisions)==10 and len({r['source_row_number'] for r in collisions})==2, 'Homonymous institutions were merged')
    require(all(r['name_collision'] for r in collisions), 'Missing name collision flag')
    require(sum(r['record_status']=='graded' for r in agency+local)==counts['valid_graded_records']==2878, 'Valid grade count')
    require(all(r['canonical_institution_id'] is None for r in agency+local), 'Unexpected unreviewed institution join')

    for metric in [r for r in metrics if r['source_id']=='D05']:
        rows=[r for r in obs if r['metric_id']==metric['metric_id']]
        total=next(r['value'] for r in rows if r['group_label']=='전체')
        require(total==sum(r['value'] for r in rows if r['group_label']!='전체'), 'ALIO institution-type total mismatch')
    contracts=[r for r in obs if r['source_id']=='D07' and r['unit']=='cases']
    for year in range(2014,2024):
        rows=[r for r in contracts if r['year']==year]
        total=next(r['value'] for r in rows if r['group_label']=='전체')
        require(total==sum(r['value'] for r in rows if r['group_label']!='전체'), 'SPRi contract category total')
    require(sum(r['value'] for r in contracts if r['group_label']=='전체')==5891, 'SPRi contract grand total')
    sentinel=next(r for r in obs if r['source_id']=='D09' and r['metric_id']=='D09_M01' and r['year']==2023)
    require(sentinel['value']==18.1 and sentinel['unit']=='percent','WPS2023 source sentinel')
    result={'status':'passed','package_version':manifest['package_version'],'counts':counts,
        'checks':['JSON and IDs','source and metric references','percentage and index units','three unasked cells',
            'agency grade and category totals','local source rows and years','homonym preservation',
            'ALIO type sums','SPRi category and grand totals','WPS source sentinel'],
        'scope':'Package data validation only; no target repository build or remote API request'}
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
