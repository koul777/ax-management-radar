import {
  AxRadarPromo,
  BRAND_DEFAULTS,
  CAPTIONS,
  PromoCaption,
  SFX,
  SHOTS,
  Shot01,
  Shot02,
  Shot03,
  Shot04,
  Shot05,
  Shot06,
  Shot07,
  Shot08,
  Shot09,
  Shot10,
  TITLE_A_DEFAULTS,
  TITLE_B_DEFAULTS,
  TOTAL,
} from "./AxRadarPromo";

// These are per-card arrays consumed directly by the workbench inspector.
// Keep every value serializable and every key aligned with the component prop.
const brandSchema = [
  { type: "text" as const, key: "title", label: "브랜드명", default: BRAND_DEFAULTS.title },
  { type: "text" as const, key: "subtitle", label: "영문 부제", default: BRAND_DEFAULTS.subtitle },
  { type: "color" as const, key: "ink", label: "본문 색상", default: BRAND_DEFAULTS.ink },
  { type: "slider" as const, key: "titleSize", label: "브랜드명 크기", default: BRAND_DEFAULTS.titleSize, min: 56, max: 130, step: 1, unit: "px" },
];

const titleSchema = (defaults: typeof TITLE_A_DEFAULTS) => [
  { type: "textarea" as const, key: "text", label: "제목 (줄바꿈 가능)", default: defaults.text },
  { type: "number" as const, key: "accentAt", label: "강조 줄 번호", default: defaults.accentAt, min: 0, max: 1, step: 1 },
  { type: "slider" as const, key: "fontSize", label: "제목 크기", default: defaults.fontSize, min: 56, max: 110, step: 1, unit: "px" },
  { type: "color" as const, key: "accent", label: "강조 색상", default: defaults.accent },
];

const captionSchema = (defaults: (typeof CAPTIONS)[number]["props"]) => {
  const detail = "detail" in defaults ? defaults.detail ?? "" : "";
  return [
    { type: "textarea" as const, key: "text", label: "캡션", default: defaults.text },
    { type: "textarea" as const, key: "detail", label: "보조 설명", default: detail },
    { type: "color" as const, key: "accent", label: "강조 색상", default: defaults.accent },
    { type: "slider" as const, key: "fontSize", label: "캡션 크기", default: defaults.fontSize, min: 56, max: 84, step: 1, unit: "px" },
    { type: "slider" as const, key: "detailSize", label: "보조 설명 크기", default: defaults.detailSize, min: 32, max: 48, step: 1, unit: "px" },
  ];
};

const fixedProps = {};

export const WORKBENCH = {
  name: "AX Management Radar promo",
  fps: 30,
  width: 1920,
  height: 1080,
  total: TOTAL,
  background: "#eef1f4",
  original: AxRadarPromo,
  // Generic clip controls (start, duration, x/y, opacity, scale, speed) are
  // provided by the workbench for every unit; fixed scenes add no fake props.
  shots: [
    { id: "shot-01", cardId: "shot-01", label: "브랜드 오프닝", from: SHOTS.brand.from, duration: SHOTS.brand.duration, component: Shot01, props: BRAND_DEFAULTS, schema: brandSchema },
    { id: "shot-02", cardId: "shot-02", label: "조직관리 질문", from: SHOTS.question.from, duration: SHOTS.question.duration, component: Shot02, props: fixedProps, schema: [] },
    { id: "shot-03", cardId: "shot-03", label: "공공·민간 브리지", from: SHOTS.bridgeA.from, duration: SHOTS.bridgeA.duration, component: Shot03, props: TITLE_A_DEFAULTS, schema: titleSchema(TITLE_A_DEFAULTS) },
    { id: "shot-04", cardId: "shot-04", label: "연도 탐색", from: SHOTS.year.from, duration: SHOTS.year.duration, component: Shot04, props: fixedProps, schema: [] },
    { id: "shot-05", cardId: "shot-05", label: "민간 규모", from: SHOTS.size.from, duration: SHOTS.size.duration, component: Shot05, props: fixedProps, schema: [] },
    { id: "shot-06", cardId: "shot-06", label: "KIPA 2023", from: SHOTS.kipa.from, duration: SHOTS.kipa.duration, component: Shot06, props: fixedProps, schema: [] },
    { id: "shot-07", cardId: "shot-07", label: "근거·모형", from: SHOTS.research.from, duration: SHOTS.research.duration, component: Shot07, props: fixedProps, schema: [] },
    { id: "shot-08", cardId: "shot-08", label: "질문 브리지", from: SHOTS.bridgeB.from, duration: SHOTS.bridgeB.duration, component: Shot08, props: TITLE_B_DEFAULTS, schema: titleSchema(TITLE_B_DEFAULTS) },
    { id: "shot-09", cardId: "shot-09", label: "브랜드 아웃트로", from: SHOTS.outro.from, duration: SHOTS.outro.duration, component: Shot09, props: fixedProps, schema: [] },
    { id: "shot-10", cardId: "shot-10", label: "출처·범위", from: SHOTS.sources.from, duration: SHOTS.sources.duration, component: Shot10, props: fixedProps, schema: [] },
  ],
  captions: CAPTIONS.map((caption) => ({
    id: caption.id,
    cardId: caption.id,
    label: `캡션: ${caption.id}`,
    from: caption.from,
    duration: caption.duration,
    component: PromoCaption,
    props: caption.props,
    schema: captionSchema(caption.props),
  })),
  sfx: SFX.map((sfx, index) => ({ ...sfx, duration: 120, label: `SFX ${index + 1}` })),
  bgm: [{ from: 0, duration: TOTAL, src: "audio/bgm/cat-walk.mp3", volume: 0.12, label: "Cat Walk · Arulo" }],
  order: ["captions"] as const,
} as const;
