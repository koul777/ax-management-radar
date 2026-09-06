"""Reproduce KLIPS2018 and NIA2024 aggregate-only descriptive dashboard data.

Original archives are read only. Only explicitly named members are read; the
single SAV is extracted to a fixed private .tmp path. No person records, IDs or
free responses are serialized. Questionnaire page references are physical PDF
pages (printed page numbers are also recorded for NIA).
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from pathlib import Path
from zipfile import ZipFile

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.tmp' / 'supplemental_workforce'
OUTPUT = ROOT / 'app' / 'data' / 'supplemental-workforce.json'
SOURCE_ROOT_ENV = 'AX_SUPPLEMENTAL_WORKFORCE_SOURCE_ROOT'
KLIPS_ARCHIVE_RELATIVE = Path('KLIPS - 한국노동패널조사') / '한국노동패널조사 1-21차 release (SPSS)_V1 (3).zip'
NIA_ARCHIVE_RELATIVE = Path('NIA - 전자정부서비스 이용실태조사') / '2019년 전자정부서비스 이용실태조사.zip'
NIA_PREFIX = '2024년 전자정부서비스 이용실태조사/'
NIA_DATA = NIA_PREFIX + '(원천데이터)2024년 전자정부서비스 이용실태조사_RAW DATA_개방형 포맷.csv'
NIA_BOOK = NIA_PREFIX + '(원천데이터)2024년 전자정부서비스 이용실태조사_코드북_개방형 포맷.csv'
KLIPS_URL = 'https://www.kli.re.kr/boardDownload.es?bid=0026&list_no=134404&seq=14336'
NIA_URL = 'https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000014&nttId=115415'
AGREE = {1:'전혀 그렇지 않다',2:'그렇지 않은 편이다',3:'보통이다',4:'그런 편이다',5:'아주 그렇다'}
SATISFACTION = {1:'매우 만족',2:'만족',3:'보통',4:'불만족',5:'매우 불만족'}


def source_archives(source_root: Path) -> tuple[Path, Path]:
    """Resolve private archives from an explicit root without storing local paths."""
    return source_root / KLIPS_ARCHIVE_RELATIVE, source_root / NIA_ARCHIVE_RELATIVE


def distribution(values, labels, unknown_codes=()):
    """Invalid/unlabelled responses are missing, never recoded to a valid zero."""
    values = pd.to_numeric(values, errors='coerce')
    valid = values.isin(labels)
    n = int(valid.sum())
    return {
        'valid_n':n, 'missing_n':int((~valid).sum()),
        'unknown_n':int(values.isin(unknown_codes).sum()),
        'responses':[{'code':str(code),'label':label,'n':int(values.eq(code).sum()),
                      'share':float(values.eq(code).sum()/n) if n else None} for code,label in labels.items()],
    }


def question(frame, code, label, dimension, year, labels, eligible, groups, universe, note,
             scale='범주별 응답 비율(비가중)', unknown_codes=(), values=None, outside_label='질문 대상 밖'):
    values = frame[code] if values is None else values
    result = []
    for gid,glabel,gmask in groups:
        subset = eligible & gmask
        stat = distribution(values[subset], labels, unknown_codes)
        result.append({'id':gid,'label':glabel,'eligible_n':int(subset.sum()),
                       'structural_missing_n':int((gmask & ~eligible).sum()), **stat})
    outside = int((~eligible & pd.to_numeric(values,errors='coerce').isin(labels)).sum())
    if outside:
        note += f' {outside_label} 유효 응답 {outside:,}건은 이 분석에서 제외했습니다.'
    return {'id':f'{year}_{code.lower()}','label':label,'dimension':dimension,'period':year,
            'universe':universe,'scale':scale,'source_code':code,'source_note':note,'groups':result,
            'outside_universe_response_n':outside}


def klips_mask(frame):
    # p0201 distinguishes currently employed common questionnaires; p0211=1 is
    # wage work. p0314 alone would be a current-or-last-job field.
    return frame.p210201.eq(1) & frame.p210211.eq(1) & frame.p210314.isin([1,2,3])


def build_klips(archive_path: Path):
    sys.path.insert(0,str(ROOT/'.tmp'/'spss_reader'))
    import pyreadstat
    PRIVATE.mkdir(parents=True,exist_ok=True)
    target=PRIVATE/'klips21p.sav'
    with ZipFile(archive_path) as archive:
        target.write_bytes(archive.read('1-21차 release (SPSS)_V1 (3)/klips21p.sav'))
    frame,_=pyreadstat.read_sav(str(target),encoding='cp949',user_missing=True)
    if frame.pid.isna().any() or not frame.pid.is_unique:
        raise ValueError('KLIPS person IDs must be nonmissing and unique')
    wage=klips_mask(frame)
    # p0201 numeric mapping is an empirical consistency guard. The official
    # integrated questionnaire labels this field but does not print its codes.
    # The primary current-wage definition is p0211=1 (PDF258); all such records
    # are p0201=1 and p0314=1/2/3 in the supplied wave. Retain aggregate proof.
    audit={'raw_n':len(frame),'pid_unique':bool(frame.pid.is_unique),
           'current_wage_n':int(wage.sum()),
           'common_type_by_employment':pd.crosstab(frame.p210201,frame.p210211,dropna=False).to_string(),
           'common_type_by_status':pd.crosstab(frame.p210201,frame.p210314,dropna=False).to_string(),
           'mapping_note':'p0211=1 is explicitly labelled in questionnaire PDF258; p0201 numeric interpretation corroborated by raw crosstab, not a printed numeric codebook.'}
    (PRIVATE/'klips_source_audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    eligible=wage & frame.p210401.isin([1,2,3,5])
    groups=[('private','민간기업·개인사업체·외국인회사',eligible & frame.p210401.isin([1,2])),
            ('public_institution','정부 외 공공기관',eligible & frame.p210401.eq(3)),
            ('government','정부기관',eligible & frame.p210401.eq(5))]
    universe='현재 임금근로자 중 기업형태가 민간(1·2), 정부 외 공공기관(3), 정부기관(5)으로 확인된 응답자'
    qs=[]
    def add(code,label,dimension,labels,page,mask=eligible,unknown=(),scale='원 응답코드별 분포'):
        qs.append(question(frame,code,label,dimension,2018,labels,mask,groups,universe,
                           f'한국노동패널 1~21차 통합설문 PDF {page}쪽. -1 및 공란·미정의 코드는 결측 처리.',scale,unknown,outside_label='분석 비교표본 밖'))
    add('p214321','전반적인 일자리 만족','전반적 만족',SATISFACTION,280,scale='1=매우 만족 → 5=매우 불만족. 낮을수록 만족')
    add('p214322','전반적인 일(직무) 만족','전반적 만족',SATISFACTION,280,scale='1=매우 만족 → 5=매우 불만족. 낮을수록 만족')
    for i,label in enumerate(['다닐 만한 좋은 직장','입직을 기쁘게 생각','다른 사람에게 직장 추천','직장에 대한 자부심','이 직장을 계속 다니고 싶음'],1):
        add(f'p21420{i}',label,'직장에 대한 태도',AGREE,275,scale='1=전혀 그렇지 않다 → 5=아주 그렇다. 5문항을 임의 합성하지 않음')
    for i,label in enumerate(['현재 일에 만족','일을 열정적으로 함','일을 즐겁게 함','일에서 보람을 느낌','현재 일을 계속하고 싶음'],1):
        add(f'p21430{i}',label,'일에 대한 태도',AGREE,278,scale='1=전혀 그렇지 않다 → 5=아주 그렇다')
    for i,label in enumerate(['임금·보수','고용 안정성','일의 내용','근로환경','근로시간','개인의 발전가능성','의사소통·인간관계','인사고과의 공정성','복지후생'],1):
        add(f'p21431{i}',label+' 만족','관리 여건별 만족',SATISFACTION,279,scale='1=매우 만족 → 5=매우 불만족. 낮을수록 만족')
    add('p214501','교육·직업훈련 경험','학습·참여',{1:'받아본 경험이 있다',2:'현재 받고 있다',3:'받아본 적이 없다'},291,scale='지난 조사 이후 취업·창업·업무능력 향상 목적. AI 전용 교육이 아님')
    add('pa213601','노사협의회 운영 인지','학습·참여',{1:'예',2:'아니오',3:'모른다'},277,unknown=(3,))
    add('p214402','직무 요구와 본인 기술수준의 적합','숙련 적합',
        {1:'직무 수준이 본인 기술보다 매우 낮음',2:'직무 수준이 본인 기술보다 낮은 편',3:'수준이 맞음',4:'직무 수준이 본인 기술보다 높은 편',5:'직무 수준이 본인 기술보다 매우 높음'},280,
        scale='3=적합. 높은 값이 높은 개인 역량을 뜻하지 않음')
    n=int(eligible.sum())
    training=next(q for q in qs if q['source_code']=='p214501')
    shares=[]
    for g in training['groups']:
        yes=sum(r['n'] for r in g['responses'] if r['code'] in ['1','2'])
        shares.append(f"{g['label']} {yes:,}/{g['valid_n']:,}명({yes/g['valid_n']:.1%})")
    return {'id':'klips_2018','title':'한국노동패널 2018 · 공공·민간 직장 경험','source_label':'한국노동연구원 한국노동패널 21차 개인용 자료',
            'years':[2018],'unit':'현재 임금근로자(개인)','scope_type':'public_private_workers','status':'descriptive',
            'year_coverage_note':'제공본은 1~21차이며 현재 이 화면은 최신인 21차(2018년)만 집계했습니다. 이전 차수는 미조사가 아니라 문항·기관분류의 연도별 검증과 집계 전입니다.',
            'scope':'조직의 관리 여건을 근로자의 만족·직장 태도·학습·참여 경험으로 비교합니다. 직접 AI 측정이나 현재 AX 성과 자료는 아닙니다.',
            'sample':{'raw_n':len(frame),'analysis_n':n,'excluded_n':len(frame)-n,'groups':[{'id':i,'label':l,'n':int(m.sum())} for i,l,m in groups]},
            'weight_note':'비가중 응답표본 분포입니다. 제공본의 최신인 21차(2018) 단일 시점이며 패널 회귀를 수행한 결과가 아닙니다. 모집단 비율로 해석하지 마세요.',
            'cautions':[f'원자료 {len(frame):,}명 → 현재 임금근로자 {int(wage.sum()):,}명 → 기업형태가 명확한 비교표본 {n:,}명. 법인단체·무소속·시민/종교단체·기타는 민간으로 강제 분류하지 않았습니다.',
                        '정부기관 응답에는 노인일자리 등도 포함될 수 있어 정부기관 집단을 공무원만의 표본으로 해석하지 않습니다. 정부 외 공공기관과 별도로 표시합니다.',
                        '만족 문항과 동의 문항의 척도 방향이 다릅니다. 직장 잔류 의향·직장 추천을 순수한 정서적 몰입 또는 실제 조직혁신으로 바꾸지 않습니다.',
                        '성별·연령·직종·근속·규모 등 구성 차이를 통제하지 않은 분포입니다. 집단 간 차이의 원인이나 관리 개입 효과를 추정하지 않았습니다.',
                        'WPS는 사업체, 노동패널은 개인 단위입니다. 두 표본의 공공 정의와 조사시점이 달라 비율을 한 척도로 합치지 않습니다.'],
            'questions':qs,'models':[],
            'action_questions':['AX 교육을 논의할 때 실제 학습 경험·발전가능성·숙련 적합을 따로 확인하고 있는가?',
                                '현업의 제안·협의 채널을 갖추는 것과 직원이 공정성·소통을 체감하는 것을 함께 점검하는가?',
                                '공공기관과 정부기관의 직종·고용형태 차이를 고려한 후에도 관리 여건 차이가 남는지 추가로 검토할 것인가?'],
            'evidence':[{'label':'한국노동패널 1~21차 통합설문지','url':KLIPS_URL,'note':'기업형태 PDF108쪽; 취업형태257~258쪽; 만족·태도275~280쪽; 훈련291쪽을 확인했습니다.'},
                        {'label':'김도윤·나태준(2015), 노동패널 공공·민간 조직몰입 연구','url':'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001981719','note':'직무만족·조직몰입·성과급 및 부문 비교라는 변수군의 근거. 초록 확인 수준이며 본 화면은 논문의 확률효과 회귀를 재현한 것이 아닙니다.'}],
            'findings':[{'title':'학습 경험을 비교의 출발점으로','body':'지난 조사 이후 교육·직업훈련 경험/현재 수강 응답: '+' / '.join(shares)+'. 비가중 기술통계이며 AI 교육 효과가 아닙니다.'}]}


def load_nia(archive_path: Path):
    with ZipFile(archive_path) as archive:
        frame=pd.read_csv(io.BytesIO(archive.read(NIA_DATA)),encoding='utf-8-sig',low_memory=False)
        book=pd.read_csv(io.BytesIO(archive.read(NIA_BOOK)),encoding='utf-8-sig',low_memory=False)
    labels={}; variables={}; current=None
    for _,row in book.iterrows():
        if pd.notna(row['역할']):
            variables[str(row['변수'])]=str(row['레이블'])
            continue
        if pd.notna(row['변수']):
            current=str(row['변수'])
        if current and pd.notna(row['위치']):
            labels.setdefault(current,{})[int(row['위치'])]=str(row['레이블'])
    if frame.idx.isna().any() or not frame.idx.is_unique:
        raise ValueError('NIA respondent IDs must be unique and present')
    if not frame.AGE.between(16,74).all():
        raise ValueError('NIA target ages do not match questionnaire')
    return frame,variables,labels


def nia_masks(frame):
    all_rows=pd.Series(True,index=frame.index)
    aware=frame.Q4.isin([2,3,4])
    ai_aware=frame.Q23.isin([2,3,4])
    user=aware & frame.Q9.eq(1)
    ai_user=ai_aware & frame.Q24.eq(1)
    return {'all':all_rows,'aware':aware,'user':user,'nonuser':frame.Q4.eq(1)|(aware & frame.Q9.eq(2)),
            'notified':aware & frame.Q6.eq(1),'applicant':user & frame.Q12.eq(1),
            'mobile_user':frame.Q21.eq(1),'ai_aware':ai_aware,'ai_user':ai_user,
            'ai_inconvenient':ai_user & frame.Q25.isin([1,2])}


def checkbox_values(frame, columns, eligible):
    """A blank is unselected ONLY inside a completed, eligible checkbox family."""
    valid_columns=[]
    for i,c in enumerate(columns,1):
        observed=pd.to_numeric(frame[c],errors='coerce')
        if not observed.dropna().isin([i]).all():
            raise ValueError(f'{c}: unexpected multiple-response coding')
        valid_columns.append(observed.eq(i))
    answered=pd.concat(valid_columns,axis=1).any(axis=1) & eligible
    return {c:pd.Series(1.0,index=frame.index).where(sel,0.0).where(answered)
            for c,sel in zip(columns,valid_columns)}, answered


def build_nia(archive_path: Path):
    frame,variables,labels=load_nia(archive_path)
    masks=nia_masks(frame)
    groups=[('all','전체 응답자',masks['all'])]
    for lo,hi in [(16,19),(20,29),(30,39),(40,49),(50,59),(60,74)]:
        groups.append((f'age_{lo}_{hi}',f'{lo}~{hi}세',frame.AGE.between(lo,hi)))
    qs=[]
    specs=[('Q23','AI 전자정부서비스 인지','AI 서비스 경험','all',662),
           ('Q24','최근 1년 AI 전자정부서비스 이용','AI 서비스 경험','ai_aware',662),
           ('Q25','AI 전자정부서비스 이용 편리성','AI 서비스 경험','ai_user',663),
           ('Q4','전자정부서비스 인지','이용·접근','all',648),
           ('Q9','최근 1년 전자정부서비스 이용','이용·접근','aware',651),
           ('Q6','전자정부서비스 안내 수신','안내·신청','aware',649),
           ('Q6_2','안내가 도움이 된 정도','안내·신청','notified',650),
           ('Q12_1','서비스 신청 과정의 편리성','안내·신청','applicant',654),
           ('Q13','전반적 전자정부서비스 만족','만족·재이용','user',655),
           ('Q14','전자정부서비스 지속 이용 의향','만족·재이용','user',657),
           ('Q15','전자정부서비스 추천 의향','만족·재이용','user',657),
           ('Q16_1','이용 확대를 위한 방안 · 1순위','이용 장벽·개선','user',657),
           ('Q17_1','전자정부서비스 비이용 이유 · 1순위','이용 장벽·개선','nonuser',658),
           ('Q18','비이용자의 향후 이용 의향','이용 장벽·개선','nonuser',658),
           ('Q21','모바일 전자정부서비스 이용','모바일','all',661),
           ('Q22','모바일 이용 편리성','모바일','mobile_user',661)]
    universes={'all':'전체 만16~74세 응답자','aware':'전자정부서비스를 들어본 적 있거나 알고 있다고 응답(Q4=2·3·4)',
               'ai_aware':'AI 전자정부서비스를 들어본 적 있거나 알고 있다고 응답(Q23=2·3·4). 인지하지 못한 사람은 비이용 0으로 채우지 않음',
               'user':'최근 1년 전자정부서비스 이용자(Q4=2·3·4 및 Q9=1)',
               'ai_user':'AI 서비스 인지자 중 최근 1년 AI 전자정부서비스 이용자(Q24=1)',
               'notified':'전자정부서비스 인지자 중 안내 수신자(Q6=1)',
               'applicant':'전자정부서비스 이용자 중 신청 경험자(Q12=1)',
               'nonuser':'서비스 미인지(Q4=1) 또는 인지하지만 비이용(Q9=2) 응답자',
               'mobile_user':'모바일 전자정부서비스 이용 응답자(Q21=1)',
               'ai_inconvenient':'AI 전자정부서비스 이용자 중 불편 응답(Q25=1·2). 소표본이라 연령별 분할하지 않음'}
    for code,label,dim,universe,page in specs:
        item_labels=labels[code].copy()
        if code=='Q13':
            item_labels={i:(text if text!='<없음>' else f'{i}점(중간값 별도 명칭 없음)') for i,text in item_labels.items()}
        note=f'행정안전부·NIA 「2024년 전자정부서비스 이용실태조사 결과보고서」 {page}쪽(PDF {page+24}쪽), 공개용 코드북 {code}. '
        if code.endswith('_1') and code in ['Q16_1','Q17_1']:
            note+='순위형 복수응답 중 1순위만 비교하며, 전체 선택률이 아닙니다. '
        qs.append(question(frame,code,label,dim,2024,item_labels,masks[universe],groups,universes[universe],note,
                           '원문 응답 방향 유지. Q13은 7점, 편리성·추천·의향은 각 원문 척도; 다른 척도를 합산하지 않음'))
    for prefix,count,dim,universe,page in [('Q24_1_',7,'AI 이용 목적','ai_user',663),('Q25_1_',6,'AI 이용 장벽','ai_inconvenient',663),('Q26_',10,'AI 도입 수요','all',663)]:
        columns=[f'{prefix}{i}' for i in range(1,count+1)]
        binary,answered=checkbox_values(frame,columns,masks[universe])
        family_groups=groups[:1] if universe=='ai_inconvenient' else groups
        for i,code in enumerate(columns,1):
            label=labels[code][i]
            note=f'행정안전부·NIA 「2024년 전자정부서비스 이용실태조사 결과보고서」 {page}쪽(PDF {page+24}쪽). {code}: 복수응답 각 선택지를 선택/미선택으로 표시. 질문 대상이며 해당 문항에서 하나 이상 고른 경우에만 나머지 공란을 미선택으로 처리. 전부 공란은 결측.'
            qs.append(question(frame,code,label,dim,2024,{1:'선택',0:'미선택'},masks[universe],family_groups,universes[universe],note,
                               '복수응답의 항목별 선택률. 여러 항목 선택 가능하므로 항목 간 합계는 100%가 아님',values=binary[code]))
    ai_aw=int(masks['ai_aware'].sum()); ai_n=int(masks['ai_user'].sum())
    comfortable=int((masks['ai_user'] & frame.Q25.isin([4,5])).sum())
    return {'id':'nia_2024','title':'전자정부서비스 2024 · 시민의 AI 이용 경험','source_label':'행정안전부·한국지능정보사회진흥원 전자정부서비스 이용실태조사',
            'years':[2024],'unit':'만16~74세 시민(개인)','scope_type':'citizen_services','status':'descriptive',
            'scope':'시민이 AI 전자정부서비스를 알고, 사용하고, 편리하다고 느끼는지와 서비스 접근·이용 장벽을 살펴봅니다. 조직 내부의 AX 관리 효과나 공공·민간 기업 비교를 직접 측정하지 않습니다.',
            'sample':{'raw_n':len(frame),'analysis_n':len(frame),'excluded_n':0,'groups':[{'id':i,'label':l,'n':int(m.sum())} for i,l,m in groups[1:]]},
            'weight_note':'비가중 원자료 응답분포입니다. 공식 보고서의 가중 모집단 추정치와 다릅니다. 제공된 2019~2024 묶음에서 2024 공개용 CSV 한 파일만 사용했습니다.',
            'year_coverage_note':'제공 ZIP에는 2019~2024년 자료가 있으며, 현재는 2024년만 문항·질문 대상을 검증해 집계했습니다. 이전 연도는 미조사가 아니라 추가 검증·집계 전입니다.',
            'cautions':['AI 인지(Q23)는 전체, AI 경험(Q24)은 인지자, 편리성(Q25)은 이용자에게만 질문합니다. 미질문을 비이용·불만족으로 채우지 않았습니다.',
                        '전자정부서비스에는 정보·안내 수신과 대리 이용 등도 포함됩니다. 실제 조직 AX 성공률·객관적 생산성·순수 생성형AI 사용률이 아닙니다.',
                        'AI 불편 이유는 Q25=1·2 소표본의 복수응답입니다. 순위 일반화나 집단별 효과 추정을 하지 않습니다.',
                        'Q14와 Q22에는 대상 밖 기록이 각 1건 있어 해당 문항에서 제외했습니다. Q8은 검색 없음 분기와 응답 기록이 일치하지 않아 이번 공개 문항에서 보류했습니다.',
                        '연령 구간은 원자료 AGE로 재구성했습니다. 일부 응답자의 기존 RAGE 구분과 다릅니다. 연령 차이는 비가중·무통제 기술통계입니다. 조직 조사·사업체패널과 연결한 기관 관리의 인과효과가 아닙니다.'],
            'questions':qs,'models':[],
            'action_questions':['AI 서비스를 출시한 뒤 인지도·실제 이용·편리성을 서로 다른 분모로 관리하고 있는가?',
                                'AI 도입 수요와 함께 인증·안내·신청 절차 등 기존 서비스의 장애 요인도 점검하는가?',
                                '공공 AX 성과 점검에 조직 내부 효율뿐 아니라 시민의 접근성과 이용 편의성도 포함하는가?'],
            'evidence':[{'label':'2024년 전자정부서비스 이용실태조사 결과(행정안전부)','url':NIA_URL,'note':'제공된 결과보고서 648~663쪽 설문지와 공개용 코드북을 대조. 자체 비가중 재집계로 공식 공표통계와 구분합니다.'}],
            'findings':[{'title':'인지 → 경험 → 편리성의 분모를 구분','body':f'AI 서비스 인지 응답 {ai_aw:,}/{len(frame):,}명({ai_aw/len(frame):.1%}), 인지자 중 이용 경험 {ai_n:,}/{ai_aw:,}명({ai_n/ai_aw:.1%}), 이용자 중 편리·매우 편리 {comfortable:,}/{ai_n:,}명({comfortable/ai_n:.1%}). 모두 비가중 응답분포입니다.'},
                        {'title':'서비스 인지와 실제 이용은 별도 점검','body':'인지하지 못한 응답자의 이용 여부는 묻지 않았으므로 전체 인구의 미이용률로 바꾸지 않습니다. 이용 목적·불편·향후 수요도 각각 질문 대상과 시점을 구분합니다.'}]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--source-root', type=Path, default=os.environ.get(SOURCE_ROOT_ENV),
        help=f'Private archive directory (or set {SOURCE_ROOT_ENV}); source files are not included in this repository.',
    )
    args = parser.parse_args()
    if args.source_root is None:
        parser.error(f'--source-root or {SOURCE_ROOT_ENV} is required to reproduce the aggregate export')
    source_root = args.source_root.expanduser()
    if not source_root.is_dir():
        parser.error('--source-root must be an existing private source directory')
    klips_archive, nia_archive = source_archives(source_root)
    if not klips_archive.is_file() or not nia_archive.is_file():
        parser.error('Required private KLIPS and NIA archives are unavailable under --source-root')
    payload={'datasets':[build_klips(klips_archive),build_nia(nia_archive)]}
    text=json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
    OUTPUT.write_text(text,encoding='utf-8')
    print(json.dumps({d['id']:{'n':d['sample']['analysis_n'],'questions':len(d['questions']),'groups':d['sample']['groups']} for d in payload['datasets']},ensure_ascii=False,indent=2))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
