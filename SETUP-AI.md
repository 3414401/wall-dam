# AI 기능 설정 (조 배치 · 동질성 지수)

## 준비물

1. **Google AI Studio** 계정 (무료 한도 있음)  
   https://aistudio.google.com/apikey

2. **API 키** 발급 (예: `AIza...`)

3. **Render** 서비스 `wall-dam` Environment 변수 추가

---

## Render에 키 넣기

1. https://dashboard.render.com  
2. 서비스 **wall-dam** → **Environment**  
3. Add:

| Key | Value |
|-----|--------|
| `GEMINI_API_KEY` | (Google AI Studio에서 복사한 키) |

4. **Save Changes** → **Manual Deploy** → **Deploy latest commit**

---

## 동작 확인 (브라우저 주소창에 붙여넣기)

```
https://wall-dam.onrender.com/api/health
```

성공 예:

```json
{"ok":true,"storage":"github","ai":true}
```

`"ai":false` 이면 `GEMINI_API_KEY` 가 비어 있음.

---

## 사이트에서 쓰는 방법

### AI 조 배치

1. https://3414401.github.io/wall-dam/  
2. 담을 넘는 조짜기 → 조 만들기 → 설문·코드 배포  
3. 학생들이 조 참여하기로 설문 제출  
4. **조 배치하기** → **🤖 AI 조 배치** (30초~1분 대기)

### 동질성 지수 · 설문 요약

1. 메인 → **동질성 지수 계산하기**  
2. 같은 **6자리 코드** 입력 → **분석하기**

---

## 비용·주의

- Gemini 무료 한도 초과 시 과금될 수 있음 (AI Studio에서 한도 확인)  
- 설문 데이터가 Google 서버로 전송됨 → 수업·개인정보 규정 확인  
- AI 실패 시 **빠른 자동 배치**로 자동 대체됨
