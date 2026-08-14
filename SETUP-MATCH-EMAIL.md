# 매칭 결과 메일 발송 설정

AI 다양성 매칭 후, 구글 로그인 사용자가 **예**를 누르면  
방에 접속·등록된 구글 계정 사용자들에게 팀 배치 결과와 팀원 이메일을 보냅니다.

Render API(`wall-dam.onrender.com`)에 **아래 중 하나**를 설정하세요.

## 방법 A. Resend (간단)

1. https://resend.com 가입 후 API Key 발급  
2. Render → Environment 추가  
   - `RESEND_API_KEY` = 발급받은 키  
   - `EMAIL_FROM` = `월담 <onboarding@resend.dev>` (테스트)  
     또는 본인 인증 도메인 주소  

## 방법 B. Gmail SMTP

1. Google 계정 → 2단계 인증 → **앱 비밀번호** 생성  
2. Render Environment:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = 본인 Gmail
   - `SMTP_PASS` = 앱 비밀번호
   - `EMAIL_FROM` = 본인 Gmail (선택)

설정 후 Render 서비스가 재시작되면 메일 발송이 가능해집니다.
