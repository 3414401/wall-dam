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
| `GEMINI_MODEL` | (선택) 기본 `gemini-2.0-flash` — 404 나면 자동으로 다른 모델 시도 |

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

## AI가 엑셀을 쓰는 방법

### 1) 엑셀 파일 위치 (GitHub)

아래 **파일 이름 그대로** `wall-dam` 레포의 `data` 폴더에 올립니다.

**엑셀 (.xlsx):**

```
https://github.com/3414401/wall-dam/upload/main/data/ai-reference.xlsx
```

(또는 GitHub 웹 → **Add file** → **Upload files** → `data` 폴더에 드래그)

**CSV (.csv) — 엑셀에서 저장 가능:**

```
data/ai-reference.csv
```

### 2) 엑셀에 넣으면 좋은 내용

| 열 예시 | 설명 |
|---------|------|
| 닉네임 | 학생 이름 (설문 닉네임과 맞추면 좋음) |
| 기준1~5 | 사전 점수 또는 메모 (선택) |
| 메모 | “리더 후보”, “같은 조 X” 등 |

- 시트 여러 개 가능 (예: `학생목록`, `금지조합`, `지난학기조`)
- **최대 100행**까지 AI 프롬프트에 포함 (그 이상은 잘림)

### 3) 템플릿 받기

PC 파일:

```
C:\Users\조은서\.cursor\projects\empty-window\team-wall-app\data\ai-reference.template.csv
```

엑셀로 연 다음 → **다른 이름으로 저장** → `ai-reference.xlsx` → GitHub `data/` 업로드

### 4) 반영 시점

- 엑셀만 수정: **Commit** 후 **1분** 뒤 다음 AI 조 배치부터 반영 (Render 재배포 불필요)
- 서버 코드 변경: `git push` + Render **Manual Deploy**

---

## AI가 항상 참고하는 자료 (텍스트)

**파일 위치 (GitHub):**

```
https://github.com/3414401/wall-dam/blob/main/data/ai-reference.md
```

1. 위 파일을 GitHub에서 **연필 아이콘(Edit)** 으로 수정  
2. 수업 설명, 조 배치 규칙, 주의사항을 적기  
3. **Commit changes**  
4. 다음 **AI 조 배치** / **동질성 분석** 부터 자동 반영 (약 1분 후)

PC에서 수정하려면:

```
C:\Users\조은서\.cursor\projects\empty-window\team-wall-app\data\ai-reference.md
```

수정 후 `git add` → `git commit` → `git push`

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
