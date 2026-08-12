# Google 로그인 설정

로그인 화면에서 **구글 계정으로 로그인**을 쓰려면 OAuth Client ID가 필요합니다.  
**계정 없이 사용**(아무 아이디·비밀번호)은 Client ID 없이도 그대로 동작합니다.

## 1. Google Cloud에서 Client ID 만들기

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택/생성  
2. **API 및 서비스** → **사용자 인증 정보** → **OAuth 동의 화면** 설정 (외부 / 앱 이름 등)  
3. **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID** → 애플리케이션 유형 **웹 애플리케이션**  
4. **승인된 JavaScript 원본**에 추가:
   - `http://localhost:5173`
   - `https://3414401.github.io`
5. 만든 **클라이언트 ID** (`….apps.googleusercontent.com`) 복사

## 2. 앱에 Client ID 넣기 (둘 중 하나)

### A. `public/config.json` (간단)

```json
{
  "apiUrl": "https://wall-dam.onrender.com",
  "googleClientId": "여기에-클라이언트-ID.apps.googleusercontent.com"
}
```

커밋 후 push 하면 GitHub Pages에 반영됩니다.

### B. GitHub Actions 시크릿

레포 → **Settings** → **Secrets and variables** → **Actions**

- Name: `VITE_GOOGLE_CLIENT_ID`
- Value: 클라이언트 ID

다음 Pages 배포부터 빌드에 포함됩니다.

## 3. 확인

1. https://3414401.github.io/wall-dam/ 접속  
2. **Google로 로그인** 버튼이 보이면 성공  
3. 계정 없이 사용 폼도 그대로 동작하는지 확인  
