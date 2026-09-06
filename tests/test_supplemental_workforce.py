import json
from pathlib import Path
import sys
import unittest

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from analyze_supplemental_workforce import distribution, klips_mask, nia_masks, checkbox_values, question


class SupplementalWorkforceTest(unittest.TestCase):
    def test_wage_filter_requires_current_employment(self):
        frame = pd.DataFrame({'p210201':[1,2,1,1], 'p210211':[1,1,2,1], 'p210314':[1,1,4,3]})
        self.assertEqual(klips_mask(frame).tolist(),[True,False,False,True])

    def test_unknown_is_not_forced_to_no(self):
        result = distribution(pd.Series([1,2,3,-1,None]),{1:'예',2:'아니오',3:'모른다'},(3,))
        self.assertEqual((result['valid_n'],result['missing_n'],result['unknown_n']),(3,2,1))
        self.assertAlmostEqual(sum(r['share'] for r in result['responses']),1)

    def test_nia_routing_not_aware_is_not_nonuse_answer(self):
        frame=pd.DataFrame({'Q4':[1,2,3], 'Q9':[None,2,1], 'Q23':[1,2,3], 'Q24':[None,2,1],
                            'Q25':[None,None,2],'Q6':[None,1,1],'Q12':[None,None,1],'Q21':[2,2,1]})
        masks=nia_masks(frame)
        self.assertEqual(masks['ai_aware'].tolist(),[False,True,True])
        self.assertEqual(masks['ai_user'].tolist(),[False,False,True])
        self.assertEqual(masks['ai_inconvenient'].tolist(),[False,False,True])
        self.assertEqual(masks['nonuser'].tolist(),[True,True,False])

    def test_checkbox_blank_only_recode_within_answered_family(self):
        frame=pd.DataFrame({'x1':[1,None,None,1],'x2':[None,2,None,None]})
        eligible=pd.Series([True,True,True,False])
        values,answered=checkbox_values(frame,['x1','x2'],eligible)
        self.assertEqual(answered.tolist(),[True,True,False,False])
        self.assertEqual(values['x1'].iloc[:2].tolist(),[1,0])
        self.assertTrue(values['x1'].iloc[2:].isna().all())

    def test_outside_universe_is_audited_not_counted(self):
        frame=pd.DataFrame({'x':[1,2,1]})
        result=question(frame,'x','label','dim',2024,{1:'예',2:'아니오'},pd.Series([True,True,False]),
                        [('all','전체',pd.Series([True,True,True]))],'대상','출처')
        self.assertEqual(result['outside_universe_response_n'],1)
        self.assertEqual(result['groups'][0]['eligible_n'],2)

    def test_saved_aggregates_and_all_denominators(self):
        payload=json.loads((ROOT/'app/data/supplemental-workforce.json').read_text(encoding='utf-8'))
        self.assertEqual([(d['id'],len(d['questions'])) for d in payload['datasets']],[('klips_2018',24),('nia_2024',39)])
        for dataset in payload['datasets']:
            self.assertEqual(dataset['models'],[])
            sample=dataset['sample']
            self.assertEqual(sample['raw_n'],sample['analysis_n']+sample['excluded_n'])
            self.assertEqual(sum(g['n'] for g in sample['groups']),sample['analysis_n'])
            for q in dataset['questions']:
                self.assertEqual(len({g['id'] for g in q['groups']}),len(q['groups']))
                for g in q['groups']:
                    self.assertEqual(g['eligible_n'],g['valid_n']+g['missing_n'])
                    self.assertLessEqual(g['unknown_n'],g['valid_n'])
                    self.assertEqual(sum(r['n'] for r in g['responses']),g['valid_n'])
                    for r in g['responses']:
                        self.assertEqual(r['share'],r['n']/g['valid_n'] if g['valid_n'] else None)
        nia=payload['datasets'][1]
        q={item['source_code']:item for item in nia['questions']}
        self.assertEqual(q['Q23']['groups'][0]['valid_n'],4000)
        self.assertEqual(q['Q24']['groups'][0]['valid_n'],2996)
        self.assertEqual(q['Q25']['groups'][0]['valid_n'],643)
        self.assertEqual(q['Q25_1_2']['groups'][0]['eligible_n'],19)
        self.assertEqual(q['Q14']['outside_universe_response_n'],1)
        self.assertEqual(q['Q22']['outside_universe_response_n'],1)
        self.assertNotIn('Q8',q)

    def test_no_raw_export(self):
        public=(ROOT/'app/data/supplemental-workforce.json').read_text(encoding='utf-8')
        for forbidden in ['E:\\','C:\\','pid','"idx"','SQ2_2','Q25_1_6_etc','.sav','.tmp']:
            self.assertNotIn(forbidden,public)


if __name__=='__main__':
    unittest.main()
