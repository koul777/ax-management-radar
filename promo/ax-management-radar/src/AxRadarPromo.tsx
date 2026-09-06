import React from 'react';
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { PageCam } from './lib/PageCam';
import { CraneStage, FocusScene, HeroContour } from './MotionFinishes';
import layout from './live-layout.json';
import focus from './focus-layout.json';

export const SHOTS = {
  brand: { from: 0, duration: 120 }, question: { from: 120, duration: 180 }, bridgeA: { from: 300, duration: 54 },
  year: { from: 354, duration: 180 }, size: { from: 534, duration: 180 }, kipa: { from: 714, duration: 210 },
  research: { from: 924, duration: 180 }, bridgeB: { from: 1104, duration: 54 }, outro: { from: 1158, duration: 210 }, sources: { from: 1368, duration: 212 },
} as const;
export const TOTAL = 1580;
export type PromoProps = { bgm?: boolean };

const INK = '#172331'; const SLATE = '#687482'; const PAPER = '#eef1f4'; const NAVY = '#182b3e'; const TEAL = '#108c7d'; const CORAL = '#e67d58'; const LINE = '#dfe5ea';
const SANS = '"Malgun Gothic", "Noto Sans KR", sans-serif';
const clamp = (value: number, a = 0, b = 1) => Math.min(b, Math.max(a, value));
const rise = (frame: number, start: number, duration: number, easing = Easing.bezier(0.2, 0.75, 0.3, 1)) => interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
const fade = (frame: number, duration: number) => interpolate(frame, [duration - 10, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Cutout: React.FC<{ file: string; x: number; y: number; w?: number; h?: number; style?: React.CSSProperties }> = ({ file, x, y, w, h, style }) => <Img src={staticFile(`textures/live/${file}`)} style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }} />;
export const PromoCaption: React.FC<{ text: string; detail?: string; accent?: string; fontSize?: number; detailSize?: number }> = ({ text, detail, accent = TEAL, fontSize = 58, detailSize = 32 }) => <div style={{ position: 'absolute', left: 96, right: 96, bottom: 64, color: INK, fontFamily: SANS, fontSize, lineHeight: 1.28, fontWeight: 700, letterSpacing: '-2.5px', wordBreak: 'keep-all', background: 'rgba(255,255,255,.96)', borderLeft: `8px solid ${accent}`, padding: '21px 26px', boxShadow: '0 7px 26px rgba(23,35,49,.12)' }}>{text}{detail ? <div style={{ color: SLATE, fontSize: detailSize, lineHeight: 1.45, letterSpacing: '-1px', marginTop: 9, fontWeight: 600 }}>{detail}</div> : null}</div>;

export const BRAND_DEFAULTS = { title: 'AX 조직관리 레이더', subtitle: 'AX Management Radar', ink: INK, titleSize: 104 };
const BrandOpen: React.FC<Partial<typeof BRAND_DEFAULTS>> = (props) => {
  const { title, subtitle, ink, titleSize } = { ...BRAND_DEFAULTS, ...props };
  const f = useCurrentFrame(); const out = interpolate(f, [105, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chars = title.split('');
  return <AbsoluteFill style={{ background: PAPER, fontFamily: SANS, alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', top: 226, width: 88, height: 88, border: `7px solid ${NAVY}`, borderRadius: 22, transform: `scale(${rise(f, 0, 16)})`, opacity: 1 - out }} />
    <div style={{ textAlign: 'center', transform: `translateY(${-out * 38}px) scale(${1 - out * .08})`, opacity: 1 - out }}>
      <div style={{ fontSize: 32, color: SLATE, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 27 }}>EVIDENCE-FIRST ORGANIZATIONAL QUESTIONS</div>
      <div style={{ display: 'flex', justifyContent: 'center', fontWeight: 800, color: ink, fontSize: titleSize, letterSpacing: '-6px' }}>{chars.map((ch, i) => { const t = rise(f, 12 + i * 3, 12); return <span key={`${ch}-${i}`} style={{ display: 'inline-block', opacity: t, transform: `scale(${1.5 - .5 * t})`, filter: `blur(${(1 - t) * 7}px)`, whiteSpace: 'pre' }}>{ch}</span>; })}</div>
      <div style={{ width: 148, height: 8, borderRadius: 5, background: TEAL, margin: '31px auto 25px', transform: `scaleX(${rise(f, 52, 14)})` }} />
      <div style={{ fontSize: 39, letterSpacing: '.03em', color: SLATE, fontWeight: 600 }}>{subtitle}</div>
    </div>
  </AbsoluteFill>;
};

const QuestionScene: React.FC = () => {
  const f = useCurrentFrame(); const hero = layout['wps-2023'].heroHires; const card = layout['wps-2023'].boxes.foundation[0]; const lift = rise(f, 58, 16, Easing.bezier(.2, 1.2, .3, 1)); const land = rise(f, 140, 18); const z = 58 * lift * (1 - land);
  return <AbsoluteFill style={{ background: PAPER }}><PageCam src="textures/live/wps-2023-full.png" pageH={layout['wps-2023'].pageH} keys={[{ frame: 0, cx: 960, cy: 530, zoom: .74 }, { frame: 42, cx: card.x + card.w / 2, cy: card.y + 340, zoom: 1.27, rotY: 4, rotX: 1, persp: 1600 }, { frame: 179, cx: card.x + card.w / 2, cy: card.y + 340, zoom: 1.27, rotY: 4, rotX: 1, persp: 1600 }]}>
    <div style={{ position: 'absolute', left: hero.x, top: hero.y, width: hero.w, height: hero.h, transform: `translateZ(${z}px)`, borderRadius: 17, overflow: 'hidden', opacity: rise(f, 30, 10), boxShadow: `0 ${22 * lift}px ${60 * lift}px rgba(23,35,49,.24)` }}><Img src={staticFile('textures/live/wps-foundation-hires.png')} style={{ width: '100%', height: '100%' }} /><HeroContour width={hero.w} height={hero.h} /></div>
  </PageCam><div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(620px 360px at 50% 55%, transparent 35%, rgba(23,35,49,${.34 * rise(f, 18, 18)}) 100%)` }} /></AbsoluteFill>;
};

export const TITLE_A_DEFAULTS = { text: '공공과 민간 AX,\n다른 조직 조건부터', accentAt: 1, fontSize: 84, accent: TEAL };
export const TITLE_B_DEFAULTS = { text: '숫자를 읽고,\n조직의 질문을 바꾸다', accentAt: 0, fontSize: 84, accent: TEAL };
type TitleCardProps = { text: string; accentAt: number; fontSize?: number; accent?: string };
const TitleCard: React.FC<TitleCardProps> = ({ text, accentAt, fontSize = 84, accent = TEAL }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ background: '#fff', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, opacity: fade(f, 54), backgroundImage: 'radial-gradient(850px 600px at 50% 40%, #fff 0%, #eef1f4 100%)' }}><div style={{ textAlign: 'center', maxWidth: 1560 }}>{text.split('\n').map((line, i) => { const t = rise(f, 5 + i * 8, 13); return <div key={line} style={{ color: i === accentAt ? accent : INK, fontSize, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-5px', opacity: t, transform: `scale(${1.26 - .26 * t})`, filter: `blur(${(1-t)*7}px)` }}>{line}</div>; })}<div style={{ width: 170, height: 7, background: NAVY, margin: '32px auto 0', transform: `scaleX(${rise(f, 20, 14)})` }} /></div></AbsoluteFill>; };

const YearScene: React.FC = () => {
  const f = useCurrentFrame();
  return <FocusScene duration={SHOTS.year.duration}><AbsoluteFill style={{ background: PAPER, fontFamily: SANS }}>
    <div style={{ position: 'absolute', left: 96, right: 96, top: 76, color: INK, fontSize: 64, fontWeight: 800, letterSpacing: '-3px' }}>연도마다, 확인할 수 있는 문항이 다릅니다.</div>
    <div style={{ position: 'absolute', left: 100, top: 178, color: SLATE, fontSize: 36 }}>실제 연도 선택 화면 · 같은 민간 규모(300–999명)</div>
    {[{ year: 2021, x: 126, start: 10, note: '과거 관리·혁신 문항 탐색' }, { year: 2023, x: 1114, start: 64, note: 'AI 직접 문항까지 탐색' }].map(s => {
      const t = rise(f, s.start, 20);
      return <div key={s.year} style={{ opacity: t, transform: `translateY(${(1-t)*38}px)` }}>
        <Cutout file={`year-select-${s.year}.png`} x={s.x} y={330} w={680} style={{ borderRadius: 12, boxShadow: '0 16px 38px rgba(23,35,49,.12)' }}/>
        <div style={{ position: 'absolute', left: s.x, top: 704, width: 690, color: s.year === 2023 ? TEAL : SLATE, fontSize: 40, fontWeight: 700 }}>{s.note}</div>
      </div>;
    })}
    <div style={{ position: 'absolute', left: 902, top: 442, color: TEAL, fontSize: 90, opacity: rise(f, 51, 13) }}>→</div>
  </AbsoluteFill></FocusScene>;
};

const SizeScene: React.FC = () => {
  const f = useCurrentFrame();
  const table = { x: 96, y: 323, w: 1728 };
  const scale = table.w / focus.crops['size-table-slots'].w;
  const summaries = [
    { label: '300명 미만', value: '4.5%', count: '83 / 1,837 사업체' },
    { label: '300–999명', value: '13.1%', count: '47 / 360 사업체' },
    { label: '1,000명 이상', value: '26.3%', count: '20 / 76 사업체' },
  ];
  return <FocusScene duration={SHOTS.size.duration}><AbsoluteFill style={{ background: PAPER, fontFamily: SANS }}>
    <div style={{ position: 'absolute', left: 96, top: 55, color: INK, fontSize: 60, fontWeight: 800, letterSpacing: '-3px' }}>민간 규모를 나누어 비교하기</div>
    <div style={{ position: 'absolute', left: 98, top: 137, color: SLATE, fontSize: 32 }}>2023년 · 비가중 · AI 활용 사업체 수 / AI 문항 유효응답 수</div>
    <div style={{ position: 'absolute', left: 96, right: 96, top: 186, display: 'flex', gap: 20 }}>
      {summaries.map((s,i) => <div key={s.label} style={{ flex: 1, background: '#fff', padding: '13px 22px', borderTop: `5px solid ${i===1 ? TEAL : CORAL}`, opacity: rise(f, 20+i*14, 14) }}>
        <div style={{ color: INK, fontSize: 34, lineHeight: 1.3, fontWeight: 800 }}>{s.label} <span style={{ color: i===1 ? TEAL : CORAL }}>{s.value}</span></div>
        <div style={{ color: SLATE, fontSize: 32, lineHeight: 1.3 }}>{s.count}</div>
      </div>)}
    </div>
    <Cutout file="size-table-slots.png" x={table.x} y={table.y} w={table.w} style={{ borderRadius: 16, boxShadow: '0 14px 38px rgba(23,35,49,.1)' }}/>
    {focus.sizeRows.map((row,i) => {
      // Three genuine row crops settle into the exact native table slots; final landing f62.
      const t = rise(f, 20+i*14, 14, Easing.bezier(.2, 1.12, .3, 1));
      return <Cutout key={row.file} file={row.file} x={table.x+row.x*scale} y={table.y+row.y*scale} w={row.w*scale}
        style={{ opacity: clamp(t), transformOrigin: '50% 50%', transform: `perspective(1200px) translateX(${-90*(1-t)}px) translateY(${-42*(1-t)}px) rotateX(${12*(1-t)}deg)` }}/>;
    })}
  </AbsoluteFill></FocusScene>;
};

const KipaScene: React.FC = () => {
  const f = useCurrentFrame();
  const enter = rise(f, 0, 25);
  const documentY = -Math.min(140, f * 1.1);
  const questions = [
    { file: 'kipa-q3.png', label: '업무에 AI를 활용했는가?', code: 'Q3 · 전체 1,608명' },
    { file: 'kipa-q16-support.png', label: '조직은 AI 활용을 지원하는가?', code: 'Q16_2 · 전체 1,608명' },
    { file: 'kipa-q19-resources.png', label: '어떤 지원·자원이 필요한가?', code: 'Q19 · 복수 응답' },
  ];
  return <FocusScene duration={SHOTS.kipa.duration}><AbsoluteFill style={{ background: PAPER, fontFamily: SANS }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: 800, height: 820, overflow: 'hidden', opacity: .84 }}>
      <Cutout file="kipa-dataset.png" x={-100} y={100} w={1320} style={{ transform: `translateX(${-340*enter}px) translateY(${documentY}px)`, boxShadow: '0 16px 40px rgba(23,35,49,.12)' }}/>
    </div>
    <div style={{ position: 'absolute', left: 866, top: 68, width: 968 }}>
      <div style={{ color: TEAL, fontSize: 32, fontWeight: 800 }}>한국행정연구원 · 2023 · 공공 내부 조사</div>
      <div style={{ color: INK, fontSize: 62, lineHeight: 1.22, letterSpacing: '-3px', marginTop: 22, fontWeight: 800 }}>활용만 묻지 않고,<br/>조직의 지원을 함께 봅니다.</div>
    </div>
    {questions.map((q,i) => {
      const t = rise(f, 38+i*43, 13, Easing.bezier(.25,1.18,.38,1));
      return <div key={q.file} style={{ position: 'absolute', left: 866, top: 291+i*164, width: 964, height: 147, overflow: 'hidden', opacity: clamp(t), transform: `translateY(${(1-t)*28}px) scale(${.95+.05*t})`, borderRadius: 14, border: `1px solid ${LINE}`, boxShadow: '0 10px 26px rgba(23,35,49,.11)', background: '#fff' }}>
        <Cutout file={q.file} x={0} y={34} w={964} style={{ opacity: .5 }}/>
        <div style={{ position: 'absolute', left: 21, right: 16, top: 14, background: 'rgba(255,255,255,.98)', padding: '8px 12px', borderLeft: `6px solid ${i===1 ? TEAL : CORAL}` }}>
          <div style={{ color: INK, fontSize: 35, fontWeight: 800, lineHeight: 1.3 }}>{q.label}</div>
          <div style={{ color: SLATE, fontSize: 32, marginTop: 5 }}>{q.code}</div>
        </div>
      </div>;
    })}
  </AbsoluteFill></FocusScene>;
};

const ResearchScene: React.FC = () => {
  const f = useCurrentFrame();
  const on = rise(f, 0, 20);
  return <FocusScene duration={SHOTS.research.duration}><AbsoluteFill style={{ background: PAPER, fontFamily: SANS }}>
    <div style={{ position: 'absolute', left: 96, top: 63, color: INK, fontSize: 62, fontWeight: 800, letterSpacing: '-3px' }}>연구의 근거와 우리 분석을 구분합니다.</div>
    <div style={{ position: 'absolute', left: 96, top: 181, width: 802, height: 617, boxSizing: 'border-box', opacity: on, transform: `translateY(${26*(1-on)}px)`, background: '#fff', borderRadius: 18, padding: 30, boxShadow: '0 12px 32px rgba(23,35,49,.1)' }}>
      <div style={{ color: TEAL, fontSize: 32, fontWeight: 800 }}>선행연구 · {focus.study.evidenceLevel}</div>
      <div style={{ color: INK, fontSize: 43, lineHeight: 1.38, fontWeight: 800, marginTop: 21, wordBreak: 'keep-all' }}>{focus.study.title}</div>
      <div style={{ color: SLATE, fontSize: 34, lineHeight: 1.45, marginTop: 18 }}>이순권(2016) · WPS 2011</div>
      <div style={{ color: INK, fontSize: 34, lineHeight: 1.45, marginTop: 15 }}>{focus.study.method}</div>
      <div style={{ position: 'absolute', left: 30, right: 30, bottom: 100, height: 102, overflow: 'hidden', opacity: .8 }}>
        <Cutout file="research-study-open.png" x={0} y={0} w={738}/>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, bottom: 28, color: SLATE, fontSize: 32 }}>원문 모형·코딩의 미확인 범위 명시</div>
    </div>
    <div style={{ position: 'absolute', left: 938, top: 181, width: 886, height: 617, boxSizing: 'border-box', background: NAVY, color: '#fff', borderRadius: 18, padding: 32, opacity: rise(f, 25, 18), boxShadow: '0 12px 32px rgba(23,35,49,.16)' }}>
      <div style={{ color: '#aad9d4', fontSize: 32, fontWeight: 800 }}>대시보드 주 분석 · WPS</div>
      <div style={{ fontSize: 43, fontWeight: 800, lineHeight: 1.35, marginTop: 20 }}>2021 조직관리 → 2023 AI 활용</div>
      <div style={{ fontSize: 42, fontWeight: 800, marginTop: 12 }}>N = {focus.model.n}</div>
      <div style={{ fontSize: 32, lineHeight: 1.5, marginTop: 14 }}>다중 선형확률회귀(OLS) · HC3</div>
      <div style={{ fontSize: 32, lineHeight: 1.5, marginTop: 19 }}>통제: 2021 종업원 수(로그)<br/>산업 대분류 · 노조 상태</div>
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 102, overflow: 'hidden', height: 62, borderRadius: 7 }}>
        <Cutout file="model-heading-focus.png" x={0} y={0} w={822}/>
      </div>
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 25, color: '#d4e3eb', fontSize: 32, lineHeight: 1.3 }}>연도·규모 필터로 회귀를 재추정하지 않음</div>
    </div>
  </AbsoluteFill></FocusScene>;
};

const OutroScene: React.FC = () => { const f = useCurrentFrame(); const els = [{file:'wps-header.png',x:130,y:120,w:660,dx:-360,dy:-180},{file:'wps-controls.png',x:1090,y:150,w:640,dx:420,dy:-170},{file:'wps-comparison.png',x:120,y:630,w:820,dx:-410,dy:260},{file:'kipa-header.png',x:1110,y:600,w:610,dx:440,dy:280},{file:'kipa-question-1.png',x:1530,y:390,w:300,dx:380,dy:0},{file:'research-header.png',x:90,y:440, w:440,dx:-430,dy:0}]; return <AbsoluteFill style={{ background:PAPER, fontFamily:SANS, overflow:'hidden' }}><CraneStage><AbsoluteFill style={{ background:'radial-gradient(700px 350px at 50% 51%,rgba(255,255,255,.98),rgba(238,241,244,.65) 60%,rgba(23,35,49,.12))' }} />{els.map((e,i)=>{const t=rise(f, 5+i*6, 13,Easing.bezier(.34,1.4,.44,1)); return <Cutout key={e.file} file={e.file} x={e.x} y={e.y} w={e.w} style={{ opacity:t*.86, transform:`translate(${e.dx*(1-t)}px,${e.dy*(1-t)}px) rotate(${(i%2?4:-4)*(1-t)}deg) scale(${1.1-.1*t})`, borderRadius:12, boxShadow:'0 15px 35px rgba(23,35,49,.17)' }} />; })}<div style={{ position:'absolute', left:0,right:0,top:330,textAlign:'center',opacity:rise(f,55,14) }}><div style={{ color:INK,fontSize:91,lineHeight:1.1,fontWeight:800,letterSpacing:'-6px' }}>AX 조직관리 레이더</div><div style={{ width:226,height:8,background:TEAL,margin:'29px auto' }} /><div style={{ color:SLATE,fontSize:39,fontWeight:700,letterSpacing:'-2px' }}>조직의 AX, 근거에서 시작하세요.</div><div style={{ color:SLATE,fontSize:32,marginTop:24 }}>public-private-innovation-dashboard.vercel.app</div></div></CraneStage></AbsoluteFill>; };

const SourcesScene: React.FC = () => { const f=useCurrentFrame(); const o=rise(f,0,16); return <AbsoluteFill style={{ background:'#fff', fontFamily:SANS, padding:'92px 120px', opacity:o, wordBreak:'keep-all' }}><div style={{ color:TEAL,fontSize:28,fontWeight:800,letterSpacing:'.12em' }}>SOURCES · SCOPE · CAUTION</div><h1 style={{ color:INK,fontSize:72,lineHeight:1.18,letterSpacing:'-4px',margin:'18px 0 42px' }}>출처와 해석 범위</h1><div style={{ maxWidth:1630,color:INK,fontSize:38,lineHeight:1.52 }}><b>자료</b><br/>한국노동연구원(WPS) · 한국행정연구원(KIPA) / 제작자 재분석<br/><br/><span style={{ fontSize:34,color:SLATE }}>WPS 2005–2023 연도·규모별 집계 · AI 직접 문항은 2023년만</span><br/><br/><span style={{ fontSize:32,color:SLATE }}>본 홍보영상의 한국행정연구원 자료 분석은 한국행정연구원에서 생산된 자료를 활용하였으며, 한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음.</span></div><div style={{ position:'absolute',bottom:78,left:120,color:SLATE,fontSize:34 }}>세부 출처·해석 범위: README</div></AbsoluteFill>; };


export const CAPTIONS = [
  { id: 'question', ...SHOTS.question, props: { text: '어떤 조직관리 조건을 먼저 살펴봐야 할까요?', accent: TEAL, fontSize: 58, detailSize: 32 } },
  { id: 'year', ...SHOTS.year, props: { text: 'WPS 2005–2023 · AI 직접 문항은 2023년만', accent: TEAL, fontSize: 58, detailSize: 32 } },
  { id: 'size', ...SHOTS.size, props: { text: '공공 전체와 규모를 맞춘 비교는 아닙니다.', accent: CORAL, fontSize: 58, detailSize: 32 } },
  { id: 'kipa', ...SHOTS.kipa, props: { text: 'AI 업무 활용 23.4% · 조직 지원 긍정 13.7%', detail: '업무 활용 377/1,608명 · 지원 긍정 220/1,608명(4·5점 합산) · 공공 내부 조사', accent: TEAL, fontSize: 58, detailSize: 32 } },
  { id: 'research', ...SHOTS.research, props: { text: '통제변수와 시차만으로 인과효과가 입증되지는 않습니다.', accent: NAVY, fontSize: 56, detailSize: 32 } },
] as const;

const SOURCE_PEAK_LAG_F: Record<string, number> = { 'audio/sfx/transition-soft.mp3': 13.0375, 'audio/sfx/air-whoosh-powerful.mp3': 5.5944, 'audio/sfx/impact-deep-whoosh.mp3': 16.5338, 'audio/sfx/shimmer-sparkle-sweep.mp3': 29.3581 };
// Output AAC offset is deliberately not guessed: it is measured after the first no-BGM render.
const sfxAt = (targetPeakF: number, src: string) => Math.max(0, Math.round(targetPeakF - (SOURCE_PEAK_LAG_F[src] ?? 0)));
export const SFX = [
  { from: sfxAt(SHOTS.brand.from + 46, 'audio/sfx/transition-soft.mp3'), src: 'audio/sfx/transition-soft.mp3', volume: .28 }, { from: sfxAt(SHOTS.question.from + 42, 'audio/sfx/air-whoosh-powerful.mp3'), src: 'audio/sfx/air-whoosh-powerful.mp3', volume: .28 },
  { from: sfxAt(SHOTS.year.from + 30, 'audio/sfx/transition-soft.mp3'), src: 'audio/sfx/transition-soft.mp3', volume: .25 }, { from: sfxAt(SHOTS.size.from + 62, 'audio/sfx/impact-deep-whoosh.mp3'), src: 'audio/sfx/impact-deep-whoosh.mp3', volume: .3 },
  { from: sfxAt(SHOTS.kipa.from + 25, 'audio/sfx/transition-soft.mp3'), src: 'audio/sfx/transition-soft.mp3', volume: .22 }, { from: sfxAt(SHOTS.research.from + 20, 'audio/sfx/air-whoosh-powerful.mp3'), src: 'audio/sfx/air-whoosh-powerful.mp3', volume: .22 },
  { from: sfxAt(SHOTS.outro.from + 8, 'audio/sfx/air-whoosh-powerful.mp3'), src: 'audio/sfx/air-whoosh-powerful.mp3', volume: .25 }, { from: sfxAt(SHOTS.outro.from + 58, 'audio/sfx/impact-deep-whoosh.mp3'), src: 'audio/sfx/impact-deep-whoosh.mp3', volume: .38 }, { from: sfxAt(SHOTS.outro.from + 92, 'audio/sfx/shimmer-sparkle-sweep.mp3'), src: 'audio/sfx/shimmer-sparkle-sweep.mp3', volume: .18 },
] as const;
const scene = (shot: { from: number; duration: number }, component: React.ReactNode, key: string) => <Sequence key={key} from={shot.from} durationInFrames={shot.duration}>{component}</Sequence>;
export const AxRadarPromo: React.FC<PromoProps> = ({ bgm = true }) => <AbsoluteFill style={{ background: PAPER }}>
  {bgm ? <Audio src={staticFile('audio/bgm/cat-walk.mp3')} volume={.12} /> : null}
  {SFX.map((s,i)=><Sequence key={`sfx-${i}`} from={s.from} durationInFrames={120}><Audio src={staticFile(s.src)} volume={s.volume}/></Sequence>)}
  {scene(SHOTS.brand,<BrandOpen/>,'brand')}{scene(SHOTS.question,<QuestionScene/>,'question')}{scene(SHOTS.bridgeA,<TitleCard {...TITLE_A_DEFAULTS}/>,'bridge-a')}{scene(SHOTS.year,<YearScene/>,'year')}{scene(SHOTS.size,<SizeScene/>,'size')}{scene(SHOTS.kipa,<KipaScene/>,'kipa')}{scene(SHOTS.research,<ResearchScene/>,'research')}{scene(SHOTS.bridgeB,<TitleCard {...TITLE_B_DEFAULTS}/>,'bridge-b')}{scene(SHOTS.outro,<OutroScene/>,'outro')}{scene(SHOTS.sources,<SourcesScene/>,'sources')}
  {CAPTIONS.map(c => <Sequence key={c.id} from={c.from} durationInFrames={c.duration}><PromoCaption {...c.props}/></Sequence>)}
</AbsoluteFill>;

// Audio-free scene units are exported for workbench parity. The full composition
// is the only place that lays the single BGM and SFX tracks.
export const Shot01: React.FC = BrandOpen;
export const Shot02: React.FC = QuestionScene;
export const Shot03: React.FC<Partial<typeof TITLE_A_DEFAULTS>> = (props) => <TitleCard {...{ ...TITLE_A_DEFAULTS, ...props }} />;
export const Shot04: React.FC = YearScene;
export const Shot05: React.FC = SizeScene;
export const Shot06: React.FC = KipaScene;
export const Shot07: React.FC = ResearchScene;
export const Shot08: React.FC<Partial<typeof TITLE_B_DEFAULTS>> = (props) => <TitleCard {...{ ...TITLE_B_DEFAULTS, ...props }} />;
export const Shot09: React.FC = OutroScene;
export const Shot10: React.FC = SourcesScene;
