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
backend/schema.sql    Supabase(PostgreSQL) 테이블 + 로그인/저장/랭킹 함수
scripts/              시즌 마감 + 랭킹 보고서 생성 (GitHub Actions가 실행)
.github/workflows/   시즌 자동 마감 워크플로우
dev/                  개발 도구 (빌드, 백엔드 테스트)
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
| 클라우드(Supabase) 주소/키 | `CLOUD_DEFAULT` |
| 캐릭터 이미지 추가 | `IMGDATA`에 경로 등록 후 `assets/faces/`에 파일 추가 |

`window.__dbg`는 테스트용 후크예요. 배포할 때는 지워도 돼요.

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
4. 게임 로그인 화면의 ⚙ 클라우드 연결 설정에 두 값을 넣고 "저장 + 연결 테스트". 모든 플레이어가 자동으로 연결되게 하려면 위처럼 `build.js`에 두 값을 넘겨서 빌드하거나 `js/game.js`의 `CLOUD_DEFAULT`에 넣기
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
1. Supabase SQL Editor에서 `backend/schema.sql`을 다시 Run (시즌 테이블 추가, 여러 번 실행해도 안전)
2. 내 계정을 **운영자**로 지정 (게임에서 한 번 가입한 뒤, ID는 소문자로):
   ```sql
   update public.rk_users set is_admin = true where id = '내아이디';
   ```
   이 계정으로 로그인하면 왼쪽 패널에 **⚙ 시즌 관리**가 보이고, 시즌 **마감일**을 바꿀 수 있어요. (서버가 운영자 여부를 다시 확인해요)
3. GitHub에 자동 마감용 비밀 키 등록: Supabase → Project Settings → API Keys의 **Secret key**(`sb_secret_...`)를 복사해서
   ```
   gh secret set SUPABASE_SERVICE_KEY
   ```
   (프롬프트에 붙여넣기. 이 키는 저장소나 채팅에 절대 올리지 마세요.)
4. 저장소 Actions 탭 → **Season close** → Run workflow 로 한 번 시험해 보세요. 마감일 전이면 "아직 시즌이 끝나지 않았어요"만 나오고 아무 것도 바뀌지 않아요.
5. 이미 마감된 시즌의 보고서를 다시 만들려면 Run workflow의 `report_key`에 시즌 키(예: `2026-09`)를 넣어요.
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
