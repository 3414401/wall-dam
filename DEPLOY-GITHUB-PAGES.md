# GitHub Pages 배포 가이드

## 중요: GitHub Pages는 “화면만” 올라갑니다

| 올라가는 것 | 안 올라가는 것 |
|-------------|----------------|
| React 화면 (로그인, 버튼, 디자인) | Express API (`server/`) — 설문 저장·조 배치 |

조짜기 **설문·저장**까지 인터넷에서 쓰려면 API를 **Render** 등에 따로 올리고, GitHub에 API 주소를 등록해야 합니다. (아래 2단계)

로그인 화면만 보여 주는 테스트는 **1단계만**으로도 가능합니다.

---

## 1단계: GitHub Pages (프론트)

### 1. GitHub에 레포 만들기

- 예: `team-wall-app` (이름이 URL에 들어감)
- 로컬 프로젝트를 push

```powershell
cd C:\Users\조은서\.cursor\projects\empty-window\team-wall-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/본인아이디/team-wall-app.git
git push -u origin main
```

### 2. Pages 설정

GitHub 레포 → **Settings** → **Pages**

- **Source**: `GitHub Actions` 선택

### 3. 배포 확인

- **Actions** 탭에서 `Deploy to GitHub Pages` 워크플로가 초록색이면 성공
- 주소: `https://본인아이디.github.io/team-wall-app/`
  - 레포 이름이 다르면 `.../레포이름/` 으로 바뀜

### 4. 로컬에서 Pages와 똑같이 테스트 (선택)

```powershell
$env:VITE_BASE_PATH="/team-wall-app/"
npm run build
npm run preview
```

---

## 2단계: API 서버 (설문·조 배치용, 선택)

GitHub Pages만으로는 `server/`가 실행되지 않습니다.

### Render.com 예시 (무료 티어)

1. [render.com](https://render.com) 가입
2. **New → Web Service** → GitHub 레포 연결
3. 설정:
   - **Root Directory**: (비움, 루트)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `PORT` = `10000` (Render 기본)
4. 배포 후 URL 예: `https://team-wall-api.onrender.com`

### GitHub에 API 주소 등록

레포 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

- Name: `VITE_API_URL`
- Value: `https://team-wall-api.onrender.com` (끝에 `/` 없이)

다시 **Actions**에서 워크플로 **Re-run** 하면, 빌드된 사이트가 그 API를 호출합니다.

---

## 수정 후 다시 배포

1. `src/` 등 코드 수정
2. `git add .` → `git commit` → `git push`
3. Actions가 자동으로 다시 배포 (1~3분)

**CMD를 켜 둘 필요 없음** — GitHub가 호스팅합니다.

---

## 자주 묻는 것

**Q. `index.html`만 고치면 되나요?**  
A. 화면·기능은 `src/` 를 수정하세요. `index.html`은 제목 정도만.

**Q. 주소에 `#`가 붙어요 (`#/home`)**  
A. GitHub Pages에서 새로고침 오류를 막기 위해 `HashRouter`를 씁니다. 정상입니다.

**Q. API 없이 Pages만 올리면?**  
A. 화면은 보이지만, 코드 배포·설문 제출은 실패합니다. 2단계 API가 필요합니다.
