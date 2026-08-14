# 매칭 결과 메일 발송 설정 (초보용)

> **중요:** Render 무료 서버는 **Gmail SMTP(587/465)를 막는 경우가 많습니다.**  
> 그래서 **Resend(방법 A)** 를 권장합니다. HTTPS라서 Render에서 잘 됩니다.

## 방법 A. Resend (권장 · 쉬움)

### 1) 가입 & API 키
1. https://resend.com 접속 → 가입 (GitHub/Google로 가능)
2. 대시보드 → **API Keys** → **Create API Key**
3. 이름: `wall-dam` → 만들기 → 키 복사 (`re_...`)

### 2) Render에 넣기
1. https://dashboard.render.com → `wall-dam-api` 서비스
2. **Environment**
3. 추가:

| Key | Value |
|-----|--------|
| `RESEND_API_KEY` | `re_...` (복사한 키) |
| `EMAIL_FROM` | `월담 <onboarding@resend.dev>` |

4. **Save and deploy**

### 3) 테스트 제한 (무료)
- `onboarding@resend.dev` 로 보내면, **처음엔 Resend 가입 이메일 주소로만** 수신이 될 수 있습니다.
- 여러 사람에게 보내려면 Resend에서 **도메인 인증**이 필요합니다.
- 우선 본인 구글 메일로 “예” 눌러 수신되는지만 확인하세요.

### 4) 확인
1. 사이트 강력 새로고침
2. 구글 로그인 → 채팅 → AI 매칭 → **예**
3. 본인 메일함(스팸 포함) 확인

---

## 방법 B. Gmail SMTP (비권장)

Render에서 타임아웃/502가 자주 납니다. 꼭 쓰려면:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=본인gmail`
- `SMTP_PASS=앱비밀번호`
- `EMAIL_FROM=본인gmail`

안 되면 **방법 A(Resend)** 로 바꾸세요. SMTP 변수는 지워도 됩니다.
