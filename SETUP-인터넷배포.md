# 인터넷에서 완전히 쓰기 (GitHub Pages + API + GitHub 저장)

목표: **https://3414401.github.io/wall-dam/** 에서도 코드 배포·설문·조 배치가 동작

구성:
- **화면** → GitHub Pages (`wall-dam` 레포)
- **API** → Render.com 무료 서버
- **데이터** → 같은 GitHub 레포 `data/sessions/` 폴더에 JSON 저장

예상 시간: **20~30분** (한 번만 하면 됨)

---

## 0. 준비물

- GitHub 계정 (`3414401`)
- 레포 `wall-dam` (코드 push 완료)
- [Render.com](https://render.com) 가입 (GitHub로 로그인 가능)

---

## 1단계: GitHub 토큰 만들기 (데이터 저장용)

API가 설문 결과를 GitHub에 저장하려면 **토큰**이 필요합니다.

1. GitHub → 우측 상단 프로필 → **Settings**
2. 왼쪽 맨 아래 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)**
4. Note: `wall-dam-api`
5. Expiration: 90 days 또는 No expiration
6. 권한 체크: **`repo`** (전체) — private 레포면 필수, public이면 `public_repo`만으로도 가능
7. **Generate token** → 나온 `ghp_...` 문자열을 **메모장에 복사** (다시 안 보임)

---

## 2단계: Render에 API 서버 올리기

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. **Connect GitHub** → 레포 **`wall-dam`** 선택
3. 설정:

| 항목 | 값 |
|------|-----|
| Name | `wall-dam-api` (아무 이름 가능) |
| Region | Singapore (가까운 곳) |
| Branch | `main` |
| Runtime | **Node** |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

4. **Environment Variables** (Advanced) 추가:

| Key | Value |
|-----|--------|
| `GITHUB_OWNER` | `3414401` |
| `GITHUB_REPO` | `wall-dam` |
| `GITHUB_TOKEN` | 1단계에서 복사한 `ghp_...` |
| `GITHUB_DATA_PATH` | `data/sessions` |

5. **Create Web Service** → 배포 완료까지 5~10분 대기
6. 상단 URL 복사 (예: `https://wall-dam-api.onrender.com`)

### 동작 확인

브라우저에서 열기:

`https://wall-dam-api.onrender.com/api/health`

다음처럼 보이면 성공:

```json
{"ok":true,"storage":"github"}
```

`storage`가 `"local"`이면 환경 변수가 잘못된 것 → 4번 Environment 다시 확인.

> 무료 Render는 **15분 미사용 시 잠듦**. 첫 요청 시 30초~1분 걸릴 수 있음.

---

## 3단계: GitHub Pages에 API 주소 연결

프로젝트 파일 **`public/config.json`** 을 수정합니다.

```json
{
  "apiUrl": "https://wall-dam-api.onrender.com"
}
```

`https://wall-dam-api.onrender.com` 을 **2단계에서 복사한 본인 URL**로 바꾸세요. 끝에 `/` 없이.

### GitHub에 올리기

CMD:

```text
cd C:\Users\조은서\.cursor\projects\empty-window\team-wall-app
git add public/config.json
git commit -m "API 주소 연결"
git push
```

---

## 4단계: GitHub Pages 설정 확인

1. https://github.com/3414401/wall-dam → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. **Actions** 탭에서 최근 배포가 ✓ 초록색인지 확인

---

## 5단계: 최종 테스트

1. **https://3414401.github.io/wall-dam/** 접속
2. 로그인 → 담을 넘는 조짜기 → 설문조사 → 코드 배포 → **성공**
3. GitHub 레포에서 `data/sessions/123456.json` 파일이 생겼는지 확인

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| 코드 배포 실패 | `config.json`의 `apiUrl` 확인, Render health URL 확인 |
| Render 느림 | 무료 티어 cold start — 1분 후 재시도 |
| storage: local | Render 환경 변수 `GITHUB_*` 3개 재설정 |
| CORS 오류 | API URL이 `https://` 인지, Render 서비스가 Live인지 |
| push마다 배포 너무 많음 | 설문 저장은 `data/sessions/`만 변경 — workflow가 무시함 |

---

## 로컬 개발 (그대로)

```text
cd team-wall-app
npm run dev
```

`config.json`의 `apiUrl`이 비어 있어도 localhost는 vite proxy로 3001에 연결됩니다.

---

## 체크리스트

- [ ] GitHub PAT 생성 (`repo` 권한)
- [ ] Render Web Service 배포 + 환경 변수 4개
- [ ] `/api/health` → `"storage":"github"`
- [ ] `public/config.json`에 Render URL
- [ ] `git push` 후 Pages 배포 완료
- [ ] github.io에서 코드 배포 테스트
