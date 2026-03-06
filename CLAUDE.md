# CLAUDE.md - 프로젝트 컨텍스트

## 프로젝트 개요

상업용 건물 임대 관리 및 계약서 자동 생성 시스템. Google Apps Script(GAS) 기반으로 Google Sheets에서 임차인/업체 데이터를 관리하고, Google Docs 계약서를 자동 생성하며, 이메일 발송 및 전자서명을 수집한다.

## 기술 환경

- **언어**: Google Apps Script (JavaScript, V8 런타임)
- **개발도구**: clasp CLI (로컬 개발 → GAS 배포)
- **런타임**: Google Apps Script 서버 (별도 서버 없음)
- **배포**: `npm run push` (clasp push --force)
- **.clasp.json rootDir**: `src` (src/ 내부 파일만 배포됨)
- **appsscript.json**: `src/appsscript.json`에 위치 (rootDir 안에 있어야 함)

## 핵심 아키텍처

### 파일별 역할

| 파일 | 역할 | 의존 |
|------|------|------|
| Code.gs | 진입점. onOpen()으로 커스텀 메뉴 등록, 사이드바/다이얼로그 열기 | SheetHelpers, Config |
| Config.gs | 설정 시트 CRUD. getConfig()로 설정값 객체 반환 | SheetHelpers (getSpreadsheet) |
| SheetHelpers.gs | 데이터 접근 계층. 행 데이터 읽기, 컬럼 매핑, 상태 업데이트. getSpreadsheet() 정의 | 없음 (최하위 모듈) |
| ContractGenerator.gs | Docs 템플릿 복사 → 플레이스홀더 치환 → 계약서 생성 | Config, SheetHelpers |
| EmailService.gs | GmailApp으로 임차인에게 HTML 이메일 발송 | Config, SheetHelpers, SignatureService |
| SignatureService.gs | 서명 토큰 생성, base64 이미지 → Drive 저장, Docs에 서명 이미지 삽입 | Config, SheetHelpers |
| WebApp.gs | doGet(e) 웹앱 핸들러. 토큰 검증 후 서명 페이지 서빙 | SignatureService, SheetHelpers |
| html/Sidebar.html | 사이드바 UI. google.script.run으로 서버 함수 호출 | - |
| html/SignaturePage.html | 서명 캔버스 UI. 웹앱/다이얼로그 겸용 (isWebApp 플래그로 분기) | - |

### 함수 호출 관계

```
onOpen() → 메뉴 등록
openSidebar() → Sidebar.html 서빙
  Sidebar.html → getSelectedRowSummary() → 행 정보 표시
  Sidebar.html → generateContractForSelectedRow() → 계약서 생성
  Sidebar.html → sendContractEmail(rowNumber) → 이메일 발송
  Sidebar.html → openLandlordSignatureDialog() → 서명 다이얼로그

doGet(e) → 토큰 검증 → SignaturePage.html 서빙 (웹앱)
  SignaturePage.html → processSignature(token, dataUrl) → 임차인 서명 처리
  SignaturePage.html → processLandlordSignature(dataUrl) → 임대인 서명 처리 (다이얼로그)
```

### 웹앱 vs 스프레드시트 컨텍스트

**핵심 문제**: 웹앱(doGet)에서는 `SpreadsheetApp.getActiveSpreadsheet()`가 null 반환.

**해결**: `getSpreadsheet()` 함수 (SheetHelpers.gs)
- 스프레드시트 내 실행: `getActiveSpreadsheet()` 반환
- 웹앱 실행: `PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')`로 ID를 읽어 `openById()` 사용
- SPREADSHEET_ID는 `initSettingsSheet()` (시트 초기 설정) 실행 시 자동 저장됨

**주의**: `getActiveSpreadsheet()`를 직접 사용하면 웹앱에서 에러 발생. 반드시 `getSpreadsheet()` 또는 `getContractSheet()`를 거쳐야 함.

## 스프레드시트 컬럼 구조

### 계약목록 시트 헤더 (CONTRACT_HEADERS 배열, SheetHelpers.gs)

```
A:순번 B:상주 C:사업자 D:지점명 E:층 F:호수 G:평수
H:상호 I:사업자등록번호 J:업체거주지
K:이름 L:연락처 M:비고 N:비고(게시판) O:긴급연락처 P:이메일
Q:입금일 R:계약일 S:시작일 T:종료일 U:계약만료일 V:최초계약일
W:공급가액 X:보증금 Y:계산서 Z:계산서별도
AA:상호2 AB:사업자등록번호2 AC:이름2
AD:계약서_생성 AE:계약서_문서ID AF:계약서_링크
AG:이메일_발송 AH:이메일_발송일 AI:서명_토큰
AJ:임대인_서명 AK:임차인_서명 AL:계약_상태
```

### 시스템 컬럼 (SYSTEM_COLUMNS)

AD~AL 컬럼은 시스템이 자동 관리. 플레이스홀더 치환 시 건너뜀.

### 금액 컬럼 (CURRENCY_COLUMNS)

공급가액, 보증금 → getRowData()에서 자동 콤마 포맷.

### 특수 컬럼

- 계산서: 드롭다운 (세금|현금|어플|카드)
- 계산서별도: 체크박스

### 임대인 정보

임대인(갑) 정보는 스프레드시트 컬럼이 아닌 **설정 시트**에서 관리 (landlord_name, landlord_phone, landlord_email).

## Google Docs 템플릿 규칙

- 플레이스홀더: `{{컬럼헤더명}}` (예: `{{상호}}`, `{{이름}}`, `{{보증금}}`)
- 서명란: `[임대인 서명란]`, `[임차인 서명란]` → 서명 이미지로 대체
- 컬럼 헤더명과 플레이스홀더명이 동일해야 자동 매핑됨
- `body.replaceText()`는 정규식 기반이므로 `escapeRegex()`로 특수문자 이스케이프

## 설정 시트 키

Config.gs의 `getConfig()`가 반환하는 속성명과 설정 시트의 키 매핑:

```
template_doc_id    → config.templateDocId
output_folder_id   → config.outputFolderId
signature_folder_id → config.signatureFolderId
web_app_url        → config.webAppUrl
sender_name        → config.senderName
sender_email       → config.senderEmail
company_name       → config.companyName
landlord_name      → config.landlordName    (임대인 이름)
landlord_phone     → config.landlordPhone   (임대인 연락처)
landlord_email     → config.landlordEmail   (임대인 이메일)
```

## clasp 명령어 (최신 버전)

구 명령어가 변경됨:
- `clasp open` → `clasp open-script`
- `clasp deploy` → `clasp create-deployment`
- `clasp logs` → `clasp tail-logs`
- `clasp deployments` → `clasp list-deployments`

## 서명 페이지 (SignaturePage.html) 이중 모드

하나의 HTML 파일이 두 가지 컨텍스트에서 사용됨:

1. **웹앱 모드** (임차인 서명): `doGet()`에서 `createTemplateFromFile()`로 서빙. 템플릿 변수(`<?= token ?>` 등) 주입. `isWebApp = true`.
2. **다이얼로그 모드** (임대인 서명): `createHtmlOutputFromFile()`로 서빙. 템플릿 변수 없음 → try/catch로 fallback. `isWebApp = false`.

웹앱 모드에서는 `processSignature(token, dataUrl)` 호출, 다이얼로그 모드에서는 `processLandlordSignature(dataUrl)` 호출.

## 코드 수정 시 주의사항

1. **getActiveSpreadsheet() 직접 사용 금지** → 반드시 `getSpreadsheet()` 사용 (웹앱 호환)
2. **push 후 웹앱 반영**: 서버 함수(.gs)는 push만으로 반영되지만, 웹앱 HTML은 **새 배포 필요** (`npm run deploy`)
3. **OAuth 스코프 추가 시**: `src/appsscript.json`의 `oauthScopes`에 추가 후 push → 사용자가 재승인 필요
4. **컬럼 추가/변경 시**: SheetHelpers.gs의 `CONTRACT_HEADERS` 배열도 동기화 필요
5. **템플릿 플레이스홀더**: 새 컬럼 추가 시 Google Docs 템플릿에도 `{{새컬럼}}` 추가 필요
6. **GAS 제한**: 실행 시간 6분, 일일 트리거 한도 있음. 대량 처리 시 배치 분할 고려.

## 알려진 이슈 및 해결 내역

- **clasp push "Insufficient Permission"**: Google Apps Script API 활성화 + clasp login 재실행으로 해결
- **appsscript.json not found**: rootDir("src") 안에 위치해야 함
- **Ui.showSidebar 권한 오류**: `script.container.ui` 스코프 추가로 해결
- **웹앱에서 "계약목록 시트를 찾을 수 없습니다"**: `getSpreadsheet()` fallback 추가, initSettingsSheet()에서 SPREADSHEET_ID 저장으로 해결
