# 영구 명단 엑셀 (500명) — 한 파일만 올려 두기

## 핵심

- **조장은 엑셀을 올리지 않습니다.**
- **관리자(당신)** 가 GitHub에 **파일 1개**만 올려 두면,
  모든 **코드 배포·조 참여·AI 조 배치**가 그 명단을 씁니다.

---

## 1. PC에서 roster.xlsx 수정 후 GitHub에 올리기

### A. 파일 위치 (PC)

엑셀로 연 파일:

```
C:\Users\조은서\.cursor\projects\empty-window\team-wall-app\data\roster.xlsx
```

- **A열** = 학생 선택 화면에 **보이는 이름** (검색도 A열 기준)
- **1행** = 열 제목 (A1, B1, …)
- **2행~** = 학생 데이터

엑셀에서 수정 → **저장(Ctrl+S)**

---

### B. CMD에서 GitHub에 업로드 (push)

CMD를 열고 **한 줄씩** Enter:

```
cd C:\Users\조은서\.cursor\projects\empty-window\team-wall-app
```

```
git add data/roster.xlsx
```

```
git commit -m "명단 roster.xlsx 업데이트"
```

```
git pull origin main
```

(Vim이 뜨면: `Esc` → `:wq` → Enter)

```
git push
```

---

### C. 반영 확인 (1~2분 후)

브라우저:

```
https://wall-dam.onrender.com/api/health
```

```json
"roster": true,
"rosterRows": 500
```

`rosterRows` 숫자가 바뀌었으면 새 파일을 읽은 것입니다.

---

### D. GitHub 웹에서만 올리기 (PC에 프로젝트 없을 때)

1. 브라우저:

```
https://github.com/3414401/wall-dam/upload/main/data
```

2. `roster.xlsx` 파일 드래그
3. **Commit changes**
4. 위 health 주소로 `rosterRows` 확인

---

## 2. GitHub에 올릴 위치 (요약)

브라우저에서 파일 업로드:

```
https://github.com/3414401/wall-dam/upload/main/data
```

올릴 파일 이름 (**둘 중 하나**):

| 파일名 | 설명 |
|--------|------|
| **roster.xlsx** | 엑셀 (추천) |
| **roster.csv** | CSV |

최종 경로 예:

```
https://github.com/3414401/wall-dam/blob/main/data/roster.xlsx
```

PC에서 수정 후 push 해도 됩니다:

```
C:\Users\조은서\.cursor\projects\empty-window\team-wall-app\data\roster.xlsx
```

---

## 2. 엑셀 형식

- **1행 = 열 이름** (필수)
- 2행부터 학생 (최대 2000행)
- **A열(첫 번째 열)** = 학생 선택 목록에 **보이는 글자** (B열 이후는 선택 화면에 안 보임, 설문·AI에는 사용)
- 이름 열을 A열에 두세요 (예: A1=`이름`, A2~=학생 이름)

예:

| 이름 | 학번 | 학과 | 통학거리 | MBTI | 메모 |
|------|------|------|----------|------|------|

---

## 3. 잘 올라갔는지 확인

브라우저 주소창:

```
https://wall-dam.onrender.com/api/health
```

```json
"roster": true,
"rosterRows": 500
```

`roster: false` → `data/roster.xlsx` 경로·파일명 확인

---

## 4. 사용 흐름

### 관리자 (당신)

1. `data/roster.xlsx` 를 GitHub에 올림 (또는 갱신)
2. 명단 바꿀 때마다 **같은 파일만** 덮어쓰기 → Commit

### 조장

1. 설문조사 설정 → 기준 입력 → **코드 배포**만 함
2. 학생에게 코드 전달

### 학생

1. 조 참여하기 → 코드
2. **이름·학번 검색** → 본인 **한 행** 선택
3. 엑셀 항목 확인 + 5개 기준 슬라이더 → 제출

### AI

- 선택한 **행의 모든 열** + 설문 점수 → 조 배치·동질성 분석

---

## 5. 명단 수정 후

- GitHub에 새 파일 Commit → **약 1~2분** 후 Render가 새 명단 읽음
- Render **재배포 불필요**
- 이미 제출한 설문은 **제출 당시 행 내용**이 저장됨 (이후 엑셀 수정과 무관)

---

## 6. 참고 자료와 구분

| 파일 | 용도 |
|------|------|
| **data/roster.xlsx** | 500명 **명단** (학생이 행 선택) |
| data/ai-reference.md | AI용 **글** 규칙 |
| data/ai-reference.xlsx | AI용 **추가 표** (선택) |
