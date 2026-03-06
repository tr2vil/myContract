# myContract - 상업용 건물 임대 관리 시스템

Google Sheets + Google Docs + Google Apps Script 기반의 임대 계약서 자동 생성, 이메일 발송, 전자서명 수집 시스템.

## 주요 기능

- **계약서 자동 생성**: 스프레드시트 데이터로 Google Docs 임대차계약서를 자동 생성
- **미리보기**: 생성된 계약서를 Google Docs에서 바로 확인/수정
- **이메일 발송**: 임차인에게 계약서 검토 및 서명 요청 이메일 자동 발송
- **전자서명**: HTML5 Canvas 기반 웹 서명 (마우스/터치 지원, 모바일 대응)
- **상태 관리**: 작성중 → 검토중 → 서명대기 → 완료 흐름 자동 추적

## 기술 스택

- **Google Apps Script** (V8 런타임)
- **Google Sheets** - 계약 데이터 관리 (DB 역할)
- **Google Docs** - 계약서 문서 생성
- **Google Drive** - 문서/서명 이미지 저장
- **Gmail** - 이메일 발송
- **clasp** - 로컬 개발 및 배포
- **HTML5 Canvas** - 전자서명 UI

## 프로젝트 구조

```
myContract/
├── .clasp.json              # clasp 설정 (scriptId, rootDir)
├── .claspignore             # 배포 제외 파일
├── package.json             # npm 스크립트 (push, pull, deploy 등)
├── src/
│   ├── appsscript.json      # GAS 매니페스트 (OAuth 스코프, 웹앱 설정)
│   ├── Code.gs              # 진입점: onOpen(), 커스텀 메뉴, 사이드바
│   ├── Config.gs            # 설정 시트 읽기/쓰기, 초기 생성
│   ├── SheetHelpers.gs      # 행 데이터 읽기, 컬럼 매핑, 유틸리티
│   ├── ContractGenerator.gs # 템플릿 복사 → 플레이스홀더 치환 → Docs 생성
│   ├── EmailService.gs      # HTML 이메일 작성 및 GmailApp 발송
│   ├── SignatureService.gs  # 토큰 생성, 서명 이미지 저장/문서 삽입
│   ├── WebApp.gs            # doGet() 서명 웹앱 핸들러
│   └── html/
│       ├── Sidebar.html     # 사이드바 UI (액션 버튼 + 상태 표시)
│       └── SignaturePage.html # Canvas 서명 페이지 (웹앱/다이얼로그 겸용)
└── docs/
    └── TEMPLATE_SETUP.md    # 설정 가이드
```

## 스프레드시트 구조

### 계약목록 시트 (메인)

| 그룹 | 컬럼 | 설명 |
|------|------|------|
| 기본 (A~C) | 순번, 상주, 사업자 | 일련번호, 상주여부, 사업자유형 |
| 위치 (D~G) | 지점명, 층, 호수, 평수 | 부동산 위치 정보 |
| 업체 (H~J) | 상호, 사업자등록번호, 업체거주지 | 업체 사업자 정보 |
| 연락처 (K~P) | 이름, 연락처, 비고, 비고(게시판), 긴급연락처, 이메일 | 담당자 연락 정보 |
| 계약 (Q~V) | 입금일, 계약일, 시작일, 종료일, 계약만료일, 최초계약일 | 계약 기간 정보 |
| 금액 (W~Z) | 공급가액, 보증금, 계산서, 계산서별도 | 금액 및 세금계산서 |
| 보조 (AA~AC) | 상호2, 사업자등록번호2, 이름2 | 보조 사업자 정보 |
| 상태 (AD~AL) | 계약서_생성, 문서ID, 링크, 이메일_발송, 서명_토큰, 서명상태, 계약_상태 | 시스템 관리 (자동) |

### 설정 시트

| 항목 | 설명 |
|------|------|
| template_doc_id | Google Docs 계약서 템플릿 문서 ID |
| output_folder_id | 생성된 계약서 저장 Drive 폴더 ID |
| signature_folder_id | 서명 이미지 저장 Drive 폴더 ID |
| web_app_url | 서명 웹앱 배포 URL |
| sender_name | 이메일 발신자 이름 |
| sender_email | 발신 이메일 주소 (참고용) |
| company_name | 회사명 (선택) |
| landlord_name | 임대인(갑) 이름 |
| landlord_phone | 임대인 연락처 |
| landlord_email | 임대인 이메일 |

## 설치 및 설정

### 사전 요구사항

- Node.js 설치
- Google 계정
- clasp CLI: `npm install -g @google/clasp`

### 1단계: clasp 로그인 및 연결

```bash
clasp login
```

### 2단계: 스프레드시트 생성 및 스크립트 연결

1. Google Sheets에서 새 스프레드시트 생성
2. **확장 프로그램 → Apps Script** 클릭
3. Apps Script 에디터에서 **프로젝트 설정(톱니바퀴)** → **스크립트 ID** 복사
4. `.clasp.json`의 `scriptId`를 복사한 ID로 변경

### 3단계: 코드 배포

```bash
npm run push
```

### 4단계: 스프레드시트 초기 설정

1. 스프레드시트를 새로고침(F5)
2. 상단 메뉴에서 **계약 관리 → 시트 초기 설정** 클릭
3. 권한 승인 화면이 나타나면: **고급 → Go to myContract → 허용**
4. `계약목록`, `설정` 시트가 자동 생성됨

### 5단계: Google Docs 템플릿 및 Drive 폴더 준비

1. Google Docs에서 새 문서 생성 → `docs/TEMPLATE_SETUP.md`의 템플릿 내용 붙여넣기
2. Google Drive에 폴더 2개 생성: `계약서`, `서명이미지`
3. `설정` 시트에 각 ID 입력:
   - `template_doc_id`: 문서 URL에서 `/d/`와 `/edit` 사이의 문자열
   - `output_folder_id`: 계약서 폴더 URL에서 `/folders/` 뒤의 문자열
   - `signature_folder_id`: 서명이미지 폴더 URL에서 `/folders/` 뒤의 문자열

### 6단계: 서명 웹앱 배포

1. Apps Script 에디터에서 **배포 → 새 배포**
2. 유형: **웹 앱**
3. 실행 사용자: **나**, 액세스: **모든 사용자**
4. 배포 URL을 `설정` 시트의 `web_app_url`에 입력

## 사용 방법

### 워크플로우

```
데이터 입력 → 계약서 생성 (임대인 서명 자동) → 미리보기/검토 → 이메일 발송 → 임차인 서명 → 완료
```

1. `계약목록` 시트에 계약 데이터 입력
2. 해당 행 선택 → **계약 관리 → 선택한 행 작업 (사이드바)**
3. 사이드바에서:
   - **계약서 생성** → Google Docs 자동 생성 (임대인 서명 자동 삽입)
   - **미리보기** → 생성된 문서를 Google Docs에서 확인
   - **이메일 발송** → 임차인에게 검토+서명 링크 이메일 전송
4. 임차인이 이메일 수신 → 계약서 검토 → 서명 링크 클릭 → 서명 제출
5. 임차인 서명 완료 시 상태 → **완료**

## 개발

### npm 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run push` | 코드를 Apps Script에 업로드 |
| `npm run pull` | Apps Script에서 코드 다운로드 |
| `npm run open` | Apps Script 에디터 열기 |
| `npm run open:web` | 배포된 웹앱 열기 |
| `npm run deploy` | 새 배포 생성 |
| `npm run deployments` | 배포 목록 확인 |
| `npm run logs` | 실행 로그 확인 |

### Claude Code 배포 스킬

> **Claude Code 사용 시 아래 슬래시 커맨드로 배포를 간편하게 실행할 수 있습니다.**

| 스킬 | 설명 | 예시 |
|------|------|------|
| **`/deploy [설명]`** | push + 웹앱 프로덕션 배포 | `/deploy 서명 로직 수정` |
| **`/push`** | push만 (스프레드시트 기능 반영) | `/push` |

### 코드 수정 후 반영 (수동)

**스프레드시트 기능** (사이드바, 메뉴 등)만 수정한 경우:
```bash
npm run push        # 코드 업로드 (HEAD 업데이트)
# 스프레드시트 새로고침(F5) 후 테스트
```

**웹앱** (서명 페이지, 서명 처리 함수 등)을 수정한 경우:
```bash
npm run push                                          # 코드 업로드
npx clasp deploy -i <deploymentId> -d "변경 설명"      # 기존 배포 업데이트
```

> **중요**: `clasp push`는 HEAD 코드만 업데이트합니다. 웹앱은 **배포된 버전**을 실행하므로, 웹앱 관련 코드(.gs 서버 함수 포함)를 수정했다면 반드시 `deploy`까지 실행해야 반영됩니다.

배포 ID 확인:
```bash
npm run deployments   # 배포 목록 확인
```

## 아키텍처

### 핵심 흐름

```
[사이드바 UI] → google.script.run → [서버 함수]
                                         ├── getConfig()         ← 설정 시트
                                         ├── getRowData()        ← 계약목록 시트
                                         ├── generateContract()  → Google Docs API
                                         ├── sendContractEmail() → Gmail API
                                         └── processSignature()  → Drive API + Docs API

[서명 웹앱] → doGet(e) → 토큰 검증 → SignaturePage.html
                                         └── processSignature() → 서명 저장/삽입
```

### 웹앱 컨텍스트 처리

웹앱(`doGet`)에서는 `SpreadsheetApp.getActiveSpreadsheet()`가 null을 반환하므로,
`getSpreadsheet()` 함수에서 `PropertiesService`에 저장된 스프레드시트 ID로 fallback:

```
스프레드시트 내 실행 → getActiveSpreadsheet() 사용
웹앱 실행            → PropertiesService에서 SPREADSHEET_ID 읽어 openById() 사용
```

스프레드시트 ID는 **계약 관리 → 시트 초기 설정** 실행 시 자동 저장됨.

### 서명 보안

- UUID 토큰 기반 접근 제어 (계약당 고유 토큰)
- 1회 서명 후 중복 제출 차단
- 서명 페이지에 최소 정보만 노출 (이름, 소재지)
- HTTPS 기본 제공 (Google 인프라)

### Google Docs 플레이스홀더

템플릿에서 `{{컬럼헤더}}` 형식의 플레이스홀더를 사용.
스프레드시트의 컬럼 헤더명과 동일하므로 별도 매핑 불필요:

```
{{상호}}    → 스프레드시트 "상호" 컬럼의 값으로 치환
{{이름}}    → 스프레드시트 "이름" 컬럼의 값으로 치환
{{보증금}}  → 금액은 콤마 포맷 적용 (예: 50,000,000)
{{계약일}}  → 날짜는 "yyyy년 MM월 dd일" 포맷 적용
```

서명란은 특수 플레이스홀더:
```
[임대인 서명란] → 임대인 서명 이미지로 대체
[임차인 서명란] → 임차인 서명 이미지로 대체
```

## OAuth 스코프

| 스코프 | 용도 |
|--------|------|
| spreadsheets | 스프레드시트 읽기/쓰기 |
| documents | Google Docs 문서 생성/편집 |
| drive | Drive 파일/폴더 관리 |
| gmail.send | 이메일 발송 |
| script.send_mail | 메일 발송 보조 |
| script.external_request | 외부 요청 |
| script.container.ui | 사이드바/다이얼로그 UI |

## 제한사항

- Google Apps Script 실행 시간 제한: 6분/회
- Gmail 일일 발송 한도: 무료 계정 100통, Workspace 1,500통
- 전자서명은 법적 공인인증이 아닌 간편 서명 방식
- 하나의 스프레드시트에 스크립트가 바인딩됨 (해당 스프레드시트에서만 메뉴 표시)
