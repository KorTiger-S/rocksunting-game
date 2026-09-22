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
js/                   게임 전체 로직 (여러 파일, 아래 "js/ 파일 구성" 참고)
assets/faces/*.jpg    캐릭터 표정 12종
backend/schema.sql    Supabase(PostgreSQL) 테이블 + 로그인/저장/랭킹 함수
scripts/              시즌 마감 + 랭킹 보고서 생성 (GitHub Actions가 실행)
.github/workflows/   시즌 자동 마감 워크플로우
dev/                  개발 도구 (빌드, 백엔드 테스트)
dist/                 빌드 결과 (단일 HTML 파일)
```

## js/ 파일 구성
전부 `<script src="js/...">`로 불러오는 **일반 스크립트**예요(ES 모듈 아님). 서로 전역 스코프를 공유해서 한 파일처럼 동작하지만, 그래서 **`index.html`의 `<!-- BUILD:JS:START -->`~`<!-- BUILD:JS:END -->` 사이에 적힌 순서를 반드시 지켜야 해요** (뒤 파일이 앞 파일에서 정의한 함수/변수를 그대로 써요). `dev/build.js`도 이 순서를 그대로 읽어서 `dist/rocksunting-single.html`을 만들어요.

| 파일 | 내용 |
|---|---|
| `util.js` | 화면 크기 상수, `APP_VERSION`, 캐릭터 표정 이미지(`IMGDATA`), `$`/`clamp`/`rand`/`fmt` 같은 공용 헬퍼 |
| `save.js` | localStorage 저장/불러오기, 시즌 정보 |
| `cloud.js` | Supabase 클라우드 동기화 (`api()`, `cloudPush` 등) |
| `login.js` | 로그인/게스트/로그아웃, 업데이트 내역(`RELEASE_NOTES`) 팝업 |
| `rank.js` | 랭킹 화면, `toast()` |
| `audio.js` | 효과음(`SFX`)·배경음악(`BGMT`) — Web Audio로 그때그때 합성 |
| `input.js` | 키보드/마우스/터치패드 입력, `mode`(현재 화면 상태) |
| `render.js` | 캔버스 그리기 공용 헬퍼, 캐릭터(`kid`, `bigHead`) |
| `kick-data.js` | 프리킥 위치·난이도·강화 항목 데이터 (`SPOTS`, `DIFF`, `UPS` 등) |
| `kick.js` | 프리킥 미니게임 전체 — 물리, 컷신, 매치 흐름, 필드 렌더링 |
| `hub.js` | 허브 화면(내기/알바/강화), 병원, 라털 선생님 대출 |
| `splash.js` | 시작 화면(등교 애니메이션) |
| `duel.js` | 1:1 페널티킥 대결 |
| `main.js` | 메인 루프(`frame()`)와 최초 실행(부트스트랩) — **항상 맨 마지막에 로드돼야 해요** |

## 자주 고치는 곳
| 무엇을 | 어디를 |
|---|---|
| 킥 위치 10곳, 페널티킥 | `SPOTS`, `PEN` (`js/kick-data.js`) |
| 킥 순서별 난이도(골키퍼 속도/반응/예측) | `DIFF`, `buildKicks()` (`js/kick-data.js`) |
| 파워 게이지 초록 구간 | `sweetHalf()` (`js/kick.js`) |
| 친구 대사(컷신) | `INTRO_A`, `INTRO_B`, `WIN_CUTS`, `LOSE_CUTS` (`js/kick.js`) |
| 킥 결과별 말풍선 대사 | `REACT`, `KEEPER` (`js/kick.js`) |
| 허브의 교실 수다 | `CHAT` (`js/kick.js`) |
| 병문안 대사 / 병원비 | `VISIT`, `hospitalize()` (`js/hub.js`) |
| 라털 선생님 대출액(1만 원)·대사·트림 | `LOAN`, `RATAL_LINES`, `BURPS`, `maybeLoan()` (`js/hub.js`) |
| 효과음(종류·크기·새 소리 추가) | `SFX`, `tone()`, `noise()` (`js/audio.js`), 버튼별 소리는 `BTN_SFX` (`js/hub.js`) |
| 배경음악(곡 악보·장면별 곡·볼륨) | `BGMT`(악보), `wantBgm()`(장면→곡), `MUSIC.gain`(음악 볼륨) — 모두 `js/audio.js` |
| 알바 수입, 피로도 기준 | `dayAction()` (알바 +600원, 피로 3회 입원) (`js/hub.js`) |
| 근력·체력·컨디션·기분, 쇠질하기/난지바베큐/에너지드링크/디델리 가격 | `GYM_COST`/`BBQ_COST`/`DRINK_COST`/`TTEOK_COST`, `gymAction`/`bbqAction`/`buyDrink`/`buyTteok` (`js/hub.js`), 매일 감소·컨디션 굴리기는 `dayStats()`/`rollCondition()`, 컨디션→난이도는 `applyCondition()` (`js/kick.js`) |
| 강화 항목/가격 | `UPS`, `UPMAX` (`js/kick-data.js`) |
| 1:1 대결 화면/애니메이션 | `DU`, `duRender()`, `duDraw()` (`js/duel.js`) |
| 1:1 대결 판정(오차·골키퍼 반경)·시간 제한 | `rk_duel_shot`, `rk_duel_settle` (backend/schema.sql) |
| 1:1 대결 판돈 상한(5,000원)·정산 | `DU_BETMAX` (`js/duel.js`), `rk_duel_create`, `rk_duel_pay`, `rk_duel_settle` (backend/schema.sql) |
| 판돈 한도(3,000원) | `betMax()` (`js/hub.js`) |
| 클라우드(Supabase) 주소/키 | `CLOUD_DEFAULT` (`js/cloud.js`) |
| 캐릭터 이미지 추가 | `IMGDATA`(`js/util.js`)에 경로 등록 후 `assets/faces/`에 파일 추가 |

`window.__dbg`(`js/main.js`)는 테스트용 후크예요. 배포할 때는 지워도 돼요.

## 1:1 페널티킥 대결 (v1.1.0~, 판돈은 v1.2.0~)
로그인한 두 사람이 방 코드로 만나 번갈아 5번씩 차고 막는 대결이에요. 피파 온라인처럼 **슈터는 조준 + 파워 게이지, 골키퍼는 다이브 방향**을 골라요. 판돈을 걸고 할 수도 있어요. (승패는 랭킹의 "승리" 기록에 반영되지 않고, 판돈만 소지금에 반영돼요)
- **진행**: 방 만들기 → 4자리 코드를 친구에게 전달 → 친구가 "참가하기"에 입력. 두 사람의 선택은 동시에 정해지고, 서버가 둘 다 받은 뒤에 판정해요. 상대가 무엇을 골랐는지는 판정 전까지 알 수 없어요.
- **슈터**: 마우스(또는 방향키)로 골대 안을 조준 → 클릭/Space로 확정 → 파워 게이지가 **초록 구간**일 때 다시 클릭/Space. 골대 밖을 노리면 빗나가요.
- **골키퍼**: 6칸(위/아래 × 왼쪽/가운데/오른쪽) 중 다이브할 곳을 클릭하거나 숫자키 1~6.
- **판정** (`rk_duel_shot`)
  - 파워가 초록 구간(0.8)에서 벗어날수록 공이 조준에서 흔들려요. 너무 세거나 약하면 빗나가거나 골포스트/크로스바(POST)를 맞혀요.
  - 골키퍼는 다이브한 칸 중심에서 일정 반경 안의 공을 막아요. 슛이 약할수록 반경이 넓어져요.
  - 5킥씩 차서 동점이면 서든데스. 남은 킥으로 따라잡을 수 없으면 일찍 끝나요.
- **판돈**: 방장이 0~5,000원(100원 단위)을 정해요. 방을 만들 때, 참가할 때 각자의 소지금에서 **미리 빠지고**, 이긴 사람이 판돈 2배를 가져가요. 참가자는 들어가기 전에 방장과 판돈을 확인하고, 소지금이 모자라면 참가할 수 없어요.
  - 대결 중에 나가거나 90초 넘게 자리를 비우면 **몰수패**(상대가 판돈을 모두 가져가요).
  - 아무도 안 들어온 방을 닫거나 15분 뒤 만료되면, 둘 다 사라진 경우에는 **판돈을 돌려줘요**.
  - 정산은 서버가 딱 한 번만 해요(`rk_duels.settled`). 시즌이 바뀌어 소지금이 초기화된 뒤에는 옛 시즌의 판돈을 정산하지 않아요.
  - 서버가 `rk_users.money`를 직접 바꾸고 갱신 시각을 올려서, 예전 소지금을 들고 있는 기기가 덮어쓰지 못해요.
- **시간**: 킥마다 25초 안에 못 고르면 무작위로 정해져요. 90초 넘게 응답이 없으면 몰수패, 대기방은 15분 뒤 닫혀요.
- **배포할 때**: 새 테이블/함수(`rk_duels`, `rk_duel_*`)가 필요해서 **`backend/schema.sql`을 Supabase SQL Editor에서 다시 실행**해야 해요. (여러 번 실행해도 안전해요. 이전에 칸 선택 방식으로 실행했더라도 그대로 덮어써요.)

## 버전 규칙
`v메이저.마이너.패치` 형식이고 **v1.0.0에서 시작**해요. 버전은 스플래시 화면 하단과 도움말에 보여요.

| 자리 | 올리는 때 | 예 |
|---|---|---|
| 메이저 (첫 번째) | 시즌이 바뀌면서 **새 게임이 추가**됐을 때 | 시즌2에 새 게임 추가 → v2.0.0 |
| 마이너 (두 번째) | **기능이 바뀌거나 굵직한 수정**을 했을 때 | 랭킹 화면 개편 → v1.1.0 |
| 패치 (세 번째) | **자잘한 버그 수정** | 표시 오류 수정 → v1.1.1 |

- 메이저를 올리면 마이너·패치는 0으로, 마이너를 올리면 패치는 0으로 되돌려요.
- 같은 게임이 다음 달 시즌으로 이어지기만 할 때(시즌 번호만 바뀔 때)는 메이저를 올리지 않아요. 새 게임이 들어올 때만 올려요.
- **버전을 올릴 때 바꿀 곳** (셋을 같게 맞춰요. `node dev/build.js`가 다르면 경고해요)
  1. `js/util.js`의 `APP_VERSION`
  2. `package.json`의 `version` (그리고 `package-lock.json`의 version)
  3. `js/login.js`의 `RELEASE_NOTES`에 그 버전의 업데이트 내역 추가 — 새 버전 첫 로그인 때 팝업으로 한 번 보여줘요. (마이너 이상은 꼭 적고, 패치는 안 적어도 돼요. 내역이 없으면 팝업이 안 떠요.)
## 단일 HTML 파일로 만들기 (공유/배포용)
```
node dev/build.js
```
`dist/rocksunting-single.html` 하나로 합쳐져요(이미지 포함). 이 파일 하나만 GitHub Pages, Netlify Drop 등에 올리면 끝이에요.

클라우드 주소를 넣어서 만들려면:
```
node dev/build.js "https://프로젝트ID.supabase.co" "anon-public-key"
```

## 클라우드 연동 — Supabase (선택)
로그인(ID + 숫자 4자리 비밀번호), 저장, 랭킹을 모든 플레이어가 함께 쓰려면 필요해요. 없으면 이 브라우저에만 저장돼요.
1. https://supabase.com 에서 새 프로젝트 만들기
2. SQL Editor에 `backend/schema.sql` 전체를 붙여넣고 Run (여러 번 실행해도 안전해요)
3. Project Settings → API 에서 **Project URL**과 **anon(public) key** 복사
4. 게임 로그인 화면의 ⚙ 클라우드 연결 설정에 두 값을 넣고 "저장 + 연결 테스트". 모든 플레이어가 자동으로 연결되게 하려면 위처럼 `build.js`에 두 값을 넘겨서 빌드하거나 `js/cloud.js`의 `CLOUD_DEFAULT`에 넣기
   - 임시 테스트: `index.html?api=프로젝트URL&key=anon키`

`service_role`(비밀) 키는 절대 넣지 마세요. 브라우저에는 anon 키만 공개돼요.

보안 구조: 테이블은 RLS로 잠겨 있어서 브라우저가 직접 읽거나 쓸 수 없고, `rk_load`/`rk_save`/`rk_score`/`rk_top` 함수로만 접근해요. 비밀번호는 bcrypt 해시로 저장하고, 같은 ID로 5번 틀리면 5분간 잠겨요.
랭킹 확인: 게임의 🏆 랭킹 버튼, 또는 Supabase의 Table Editor에서 `rk_users`(ID별 데이터), `rk_matches`(경기 기록).
무료 플랜은 1주일 정도 아무도 접속하지 않으면 프로젝트가 일시정지돼요. 대시보드에서 Restore하면 돼요.

> claude.ai 안에 게시된 페이지에서는 외부 연결이 막혀 있어서 클라우드 저장이 안 돼요.
> 별도 주소(GitHub Pages 등)에 올린 뒤에 사용하세요.

## 시즌제 (매달 1시즌)
- 시즌1 = 2026년 9월 · 프리킥 축구. 마감일이 지나면 **랭킹 보고서가 저장되고 모든 플레이어의 기록(소지금·전적·강화)이 초기화**돼요. 계정(ID/비밀번호)은 그대로예요.
- 게임 헤더에 `🏁 시즌1 · 9/30까지 (D-9)`처럼 남은 기간이 보여요.
- 마감은 GitHub Actions(`.github/workflows/season-close.yml`)가 **매일 00:10(한국 시간)** 에 확인해서, 마감일이 지났을 때만 실행해요.
  1. `rk_close_season` 함수가 랭킹을 `rk_seasons` 테이블에 스냅샷으로 저장 → 전원 초기화 → 다음 시즌 시작
  2. 보고서(`reports/<시즌>_season<번호>_<게임>.md` + `.csv`)를 이 저장소의 **`reports` 브랜치**에 commit
  3. 같은 내용을 **Issue**로 올려서 메일로 알려줘요
- 다음 시즌은 자동으로 이어져요(시즌2 = 다음 달 1일까지). 다른 게임이 생기면 `rk_config`의 `game`/`game_name`을 바꾸면 돼요.
- 마감 뒤 예전 화면에서 늦게 저장하거나 이 기기에 지난 시즌 기록이 남아 있어도, 서버가 시즌이 다르면 저장을 거부하고 초기화된 기록을 내려줘서 되살아나지 않아요.

### 처음 한 번 설정 (운영자)
게임 안에는 운영자 기능이 없어요. 시즌 관리는 **Supabase 대시보드**와 **GitHub**에서만 해요. (이 두 계정을 2단계 인증으로 보호하세요.)
1. Supabase SQL Editor에서 `backend/schema.sql`을 다시 Run (시즌 테이블 추가, 여러 번 실행해도 안전)
2. GitHub에 자동 마감용 비밀 키 등록: Supabase → Project Settings → API Keys의 **Secret key**(`sb_secret_...`)를 복사해서
   ```
   gh secret set SUPABASE_SERVICE_KEY
   ```
   (프롬프트에 붙여넣기. 이 키는 저장소나 채팅에 절대 올리지 마세요.)
3. 저장소 Actions 탭 → **Season close** → Run workflow 로 한 번 시험해 보세요. 마감일 전이면 "아직 시즌이 끝나지 않았어요"만 나오고 아무 것도 바뀌지 않아요.

### 시즌 마감일 바꾸기
Supabase SQL Editor에서 실행해요. (게임에서는 호출할 수 없어요.)
```sql
select public.rk_set_season_end('2026-09-30');   -- 이 날 밤 12시(한국 시간)까지 진행, 다음 날 0시에 마감
select public.rk_season_json();                  -- 지금 시즌 정보 확인
```
오늘보다 이전 날짜는 거부돼요. 바꾼 마감일은 게임 헤더의 `D-N`에도 바로 반영돼요.

### 보고서 다시 만들기
이미 마감된 시즌의 보고서는 Actions → Season close → Run workflow의 `report_key`에 시즌 키(예: `2026-09`)를 넣어요.
## 백엔드 로컬 테스트 (계정 없이)
```
npm install
npm run test:backend     schema.sql 로직 테스트 (PGlite: Node 안에서 도는 PostgreSQL)
```
비밀번호 검증, 5회 실패 잠금, 값 범위 보정, 랭킹 정렬, anon 권한 제한, 시즌 마감·초기화·보고서 생성까지 확인해요.
## 저장 데이터 구조
브라우저 localStorage
- `rk:u:<id소문자>` : 해당 ID의 전체 저장 데이터
- `rk:last` : 마지막으로 로그인한 ID
- `rk:cloud` : 설정 화면에서 넣은 Supabase URL/key (JSON)

## 알려진 한계
- 비밀번호는 숫자 4자리라 약해요. 5회 실패 잠금이 있지만, 남이 일부러 틀려서 특정 ID를 5분간 잠글 수는 있어요.
- 값 조작 방지는 서버의 범위 보정 정도만 있어요. 진짜 경쟁용 랭킹이라면 서버에서 경기를 검증해야 해요.
- 아직 만들지 않은 것: 식당 달리기 등 나머지 퀘스트 5종, 100만 원 달성 엔딩(비트코인 애니메이션과 60년 뒤 쿠키 영상)

## 개발 팁
- 코드 편집기: VS Code + Live Server 확장을 쓰면 저장할 때마다 자동 새로고침돼요.
- Claude Code를 쓰면 이 폴더를 열어 두고 "식당 달리기 퀘스트를 같은 방식으로 추가해줘"처럼 이어서 개발하기 좋아요.
