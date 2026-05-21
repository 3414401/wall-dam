# 담을 넘는 조짜기 (Team Wall App)

모바일 친화적 웹앱 — 5가지 능력치 설문 기반 팀 밸런스 조 배치

## 기능

- **로그인** → 메인 메뉴 (데모: 아무 아이디/비밀번호)
- **동질성 지수** / **랜덤 팀 프로젝트**: 준비 중 플레이스홀더
- **담을 넘는 조짜기**
  - 조 만들기 → 설문조사(5개 능력치 이름 + 6자리 코드 배포) / 조 배치하기
  - 조 참여하기 → 코드 입장 → 0~10 슬라이더 설문 제출
  - 조 결과보기

## 실행

```bash
cd team-wall-app
npm install
npm run dev
```

- 프론트: http://localhost:5173
- API: http://localhost:3001

## 데이터 저장

| 설정 | 저장 위치 |
|------|-----------|
| `.env`에 GitHub 변수 없음 | `server-data/{코드}.json` (로컬) |
| `GITHUB_TOKEN` 등 설정 | GitHub 레포 `data/sessions/{코드}.json` |

### GitHub 설정

1. 빈 레포 생성 (예: `team-wall-data`)
2. Fine-grained 또는 classic PAT — **Contents: Read and write**
3. `.env.example`을 `.env`로 복사 후 값 입력

## 조 배치 알고리즘

각 참가자의 5차원 점수 벡터를 합산했을 때, **조별 합계가 5개 축 모두에서 고르게** 되도록 그리디 밸런싱 (hobbada 능력치 모드의 다차원 확장).

## 인터넷에서 완전히 사용하기 (Pages + API)

**한 번만 설정하면** `github.io`에서도 코드 배포·설문·조 배치가 됩니다.

👉 **[SETUP-인터넷배포.md](./SETUP-인터넷배포.md)** （Render + GitHub 토큰 + `public/config.json`）

요약:
1. Render.com에 API (`npm start`) 배포
2. GitHub PAT → Render 환경 변수
3. `public/config.json`에 Render URL 입력 후 push

## GitHub Pages (화면만)

**[DEPLOY-GITHUB-PAGES.md](./DEPLOY-GITHUB-PAGES.md)** — Pages만 올릴 때

## 기술 스택

- React + Vite + TypeScript
- Express API (로컬 / Render 등)
- GitHub Contents API (선택)
