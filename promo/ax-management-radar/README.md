# AX Management Radar — 홍보영상 소스

실제 공개 대시보드를 캡처한 52.67초, 1920×1080, 30fps 영상입니다. BGM·효과음 버전과 효과음 전용 버전은 동일한 영상 스트림을 사용합니다. 화면의 그래프는 클릭 가능한 화면이 아니라 촬영한 화면입니다.

## 제작·검증 기록

- [기획과 디자인](PRODUCTION_BRIEF.md), [최종 분경](STORYBOARD.md)
- [독립 최종 검토](../FINAL_REVIEW.md#9-v2-재검토--현재-최종본): v2 필수 시각 수정 6건 해소, 두 영상의 전체 1,580프레임 동일성 및 전체 디코드 확인. 실제 청취는 미검증입니다.
- [음원 출처](audio-manifest.md), [고정 파일 지문](audio-sources.json), [제3자 코드 고지](THIRD_PARTY_NOTICES.md)

사용자 요청에 따라 `video-shotcraft`의 자율 제작 방식을 적용했습니다. 원본 샷의 운동 문법을 AX 화면의 글꼴·색·수치 가독성에 맞게 조정한 것이며, 모든 원본 샷을 그대로 복제했다고 주장하지 않습니다.

## 다시 렌더링하기

저장소에는 촬영한 공개 집계 PNG와 소스만 들어 있습니다. 음원 원본, 렌더 결과, 설치된 편집 작업대는 별도입니다. Node.js 22.13 이상, 한글 글꼴, Remotion 지원 브라우저가 필요합니다. 검증된 제작 환경은 Windows의 맑은 고딕이며 다른 환경의 픽셀 동일성은 보장하지 않습니다.

```sh
cd promo/ax-management-radar
npm ci
npm run audio:prepare
npm run typecheck
npm run render
npm run render:no-bgm
```

`audio:prepare`는 출처가 고정된 음원 5개를 원 제공처에서 내려받고 크기·SHA-256을 대조합니다. 기존 파일을 덮어쓰지 않으며 원본이 변경되면 중단합니다. 먼저 [음악](https://mixkit.co/license/#musicFree)·[효과음](https://mixkit.co/license/#sfxFree) 조건을 확인해야 합니다. `npm run audio:check`는 다운로드 없이 기존 파일만 검사합니다. 음원 원본의 별도 재배포를 허용하는 기능은 아닙니다.

위 렌더 결과는 각각 `out/render-bgm.mp4`, `out/render-sfx-only.mp4`입니다. 두 렌더의 영상 픽셀이 달라지는 것을 막으려면 한 영상 스트림을 두 파일에 복사합니다. PowerShell에서 실제 FFmpeg 실행 파일을 지정합니다.

```powershell
.\scripts\mux_audio_variants.ps1 -FfmpegPath 'C:\tools\ffmpeg\bin\ffmpeg.exe'
```

최종 출력은 `out/final/ax-management-radar.mp4`, `out/final/ax-management-radar-no-bgm.mp4`입니다. 재렌더 후에는 최종 파일을 다시 검수해야 하며 기존 검토가 자동 승계되지 않습니다. `npm run dev`로 Remotion Studio에서 확인할 수 있습니다.

## 시각 편집 작업대

`src/workbench.ts`가 동일한 `SHOTS`, `CAPTIONS`, `SFX`를 가져와 장면·자막·음향 트랙으로 나눕니다. 브랜드·전환 문구와 자막의 문구·색·크기를 편집할 수 있습니다. 모든 화면 내부 글자를 별도 입력란으로 노출한 것은 아닙니다. 시간·위치·레이어 편집은 각 클립에서 가능합니다.

이 작업 PC의 별도 로컬 작업대는 **http://localhost:5199/?import=project**에서 열립니다. 원본/분해본 15개 프레임 비교와 저장 프로젝트 24프레임 MP4 내보내기를 검증했습니다. 전체 길이의 작업대 내보내기 또는 다른 PC의 작업대 설치까지 검증한 것은 아닙니다. 공개 소스에는 Windows용으로 조정한 로컬 작업대 설치본 자체를 포함하지 않습니다. 별도 설치 시 [video-shotcraft 작업대 안내](https://github.com/Vincentwei1021/video-shotcraft/blob/main/references/workbench.md)를 참고하세요.

## 자료와 해석

WPS의 AI 직접 문항은 2023년에만 있습니다. 근로자 수 구간은 법정 중소·중견·대기업 구분이 아니며 공공 기준은 규모를 맞추지 않은 해당 연도 공공 전체입니다. KIPA 2023은 공공 내부 조사입니다. 계수·현황 차이를 인과효과로 해석하지 않습니다. 영상에 사용된 연구의 원문 미확인 범위도 화면에 표시합니다.

> 본 홍보영상의 한국행정연구원 자료 분석은 한국행정연구원에서 생산된 자료를 활용하였으며, 한국행정연구원 연구자료관리규칙에 의거 사용허가를 받았음.

기관별 전체 출처와 이용조건은 [대시보드 README](../../README.md)에 있습니다. 데이터 권리, 제작 도구의 Apache-2.0, Remotion 및 음원 이용조건은 서로 별개입니다.
