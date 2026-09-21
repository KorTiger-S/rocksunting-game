# 롹순팅 키우기 (프리킥 내기)

머대부속 고등학교에서 친구들과 벌이는 프리킥 5킥 내기 게임이에요.
HTML/CSS/JavaScript만으로 만들어져서 **설치할 것 없이** 브라우저로 열면 돌아가요.

## 바로 실행하기
- **가장 간단**: `index.html`을 더블클릭해서 브라우저(크롬 권장)로 열기
- **로컬 서버로 열기** (Node.js가 있다면): 이 폴더에서 `npm run serve` → 표시되는 주소로 접속
- **파이썬이 있다면**: `python3 -m http.server 8000` → http://localhost:8000

> 처음 열면 ID 입력 화면이 나와요. 로그인 정보는 브라우저(localStorage)에 저장돼요.

## 폴더 구조
```
index.html            화면 뼈대 (허브, 로그인, 랭킹, 게임 캔버스)
css/style.css         스타일
js/game.js            게임 전체 로직 (한 파일)
assets/faces/*.jpg    캐릭터 표정 12종
backend/Code.gs       구글 스프레드시트 연동용 Apps Script
dev/                  개발 도구 (빌드, 백엔드 모의 서버/테스트)
dist/                 빌드 결과 (단일 HTML 파일)
```

## 자주 고치는 곳 (js/game.js)
| 무엇을 | 어디를 |
|---|---|
| 킥 위치 10곳, 페널티킥 | `SPOTS`, `PEN` |
| 킥 순서별 난이도(골키퍼 속도/반응/예측) | `DIFF`, `buildKicks()` |
| 파워 게이지 초록 구간 | `sweetHalf()` |
| 친구 대사(컷신) | `INTRO_A`, `INTRO_B`, `WIN_CUTS`, `LOSE_CUTS` |
| 킥 결과별 말풍선 대사 | `REACT`, `KEEPER` |
| 허브의 교실 수다 | `CHAT` |
| 병문안 대사 / 병원비 | `VISIT`, `hospitalize()` |
| 알바 수입, 피로도 기준 | `dayAction()` (알바 +600원, 피로 3회 입원) |
| 강화 항목/가격 | `UPS`, `UPMAX` |
| 판돈 한도(3,000원) | `betMax()` |
| 클라우드(스프레드시트) 주소 | `CLOUD_DEFAULT` |
| 캐릭터 이미지 추가 | `IMGDATA`에 경로 등록 후 `assets/faces/`에 파일 추가 |

`window.__dbg`는 테스트용 후크예요. 배포할 때는 지워도 돼요.

## 단일 HTML 파일로 만들기 (공유/배포용)
```
node dev/build.js
```
`dist/rocksunting-single.html` 하나로 합쳐져요(이미지 포함). 이 파일 하나만 GitHub Pages, Netlify Drop 등에 올리면 끝이에요.

클라우드 주소를 넣어서 만들려면:
```
node dev/build.js "https://script.google.com/macros/s/…/exec"
```

## 스프레드시트 연동 (선택)
1. 새 구글 스프레드시트 → 확장 프로그램 → Apps Script → `backend/Code.gs` 붙여넣기
2. 배포 → 새 배포 → 웹 앱 (실행: 나 / 액세스: 모든 사용자) → `…/exec` 주소 복사
3. `js/game.js`의 `const CLOUD_DEFAULT='';`에 주소를 넣거나, 위처럼 `build.js`에 주소를 넘겨서 빌드
4. 임시로 테스트할 때는 `index.html?api=웹앱주소` 로 열거나, 로그인 화면의 ⚙ 설정에 붙여넣기

코드를 고친 뒤에는 Apps Script에서 **새 버전으로 다시 배포**해야 반영돼요.
시트에는 `Users`(ID별 데이터), `Matches`(경기 기록)가 자동으로 만들어져요. `data` 열은 직접 고치지 마세요.

> claude.ai 안에 게시된 페이지에서는 외부 연결이 막혀 있어서 클라우드 저장이 안 돼요.
> 별도 주소(GitHub Pages 등)에 올린 뒤에 사용하세요.

## 백엔드 로컬 테스트 (구글 계정 없이)
```
npm run test:backend     Code.gs 로직 테스트 (17개 항목)
npm run mock             http://localhost:8787/exec 에 모의 Apps Script 서버 실행
```
모의 서버를 켠 뒤 `index.html?api=http://localhost:8787/exec` 로 열면 클라우드 저장/불러오기/랭킹을 로컬에서 시험해 볼 수 있어요.
(모의 서버는 메모리에만 저장하므로 끄면 데이터가 사라져요.)

## 저장 데이터 구조
브라우저 localStorage
- `rk:u:<id소문자>` : 해당 ID의 전체 저장 데이터
- `rk:last` : 마지막으로 로그인한 ID
- `rk:cloud` : 설정 화면에서 넣은 웹앱 URL

## 알려진 한계
- 비밀번호가 없는 ID 로그인이라, 다른 사람의 ID를 입력하면 그 기록으로 들어갈 수 있어요.
- 값 조작 방지는 서버의 범위 보정 정도만 있어요. 진짜 경쟁용 랭킹이라면 서버에서 경기를 검증해야 해요.
- 아직 만들지 않은 것: 식당 달리기 등 나머지 퀘스트 5종, 100만 원 달성 엔딩(비트코인 애니메이션과 60년 뒤 쿠키 영상)

## 개발 팁
- 코드 편집기: VS Code + Live Server 확장을 쓰면 저장할 때마다 자동 새로고침돼요.
- Claude Code를 쓰면 이 폴더를 열어 두고 "식당 달리기 퀘스트를 같은 방식으로 추가해줘"처럼 이어서 개발하기 좋아요.
