# CLAUDE.md - 프로젝트 컨텍스트

## 프로젝트 개요

상업용 건물 임대 관리 및 계약서 자동 생성 시스템. Google Apps Script(GAS) 기반으로 Google Sheets에서 임차인/업체 데이터를 관리하고, Google Docs 계약서를 자동 생성하며, 이메일 발송 및 전자서명을 수집한다.

## 기술 환경

- **언어**: Google Apps Script (JavaScript, V8 런타임)
- **개발도구**: clasp CLI (로컬 개발 → GAS 배포)
- **런타임**: Google Apps Script 서버 (별도 서버 없음)
- **배포 (코드 업로드)**: `npm run push` (clasp push --force)
- **배포 (웹앱 반영)**: `npx clasp deploy -i <deploymentId>` (기존 배포 업데이트)
- **.clasp.json rootDir**: `src` (src/ 내부 파일만 배포됨)
- **appsscript.json**: `src/appsscript.json`에 위치 (rootDir 안에 있어야 함)

## 핵심 아키텍처

### 파일별 역할

| 파일 | 역할 | 의존 |
|------|------|------|
| Code.gs | 진입점. onOpen()으로 커스텀 메뉴 등록, 사이드바/다이얼로그 열기 | SheetHelpers, Config |
| Config.gs | 설정 시트 CRUD. getConfig()로 설정값 객체 반환 | SheetHelpers (getSpreadsheet) |
| SheetHelpers.gs | 데이터 접근 계층. 행 데이터 읽기, 컬럼 매핑, 상태 업데이트. getSpreadsheet() 정의 | 없음 (최하위 모듈) |
| ContractGenerator.gs | Docs 템플릿 복사 → 플레이스홀더 치환 → 계약서 생성, 임대인 서명 자동 삽입 | Config, SheetHelpers |
| EmailService.gs | GmailApp으로 이메일 발송 (계약요청 + 최종계약서), SMS 텍스트 생성 | Config, SheetHelpers, SignatureService |
| SignatureService.gs | 서명 토큰 생성, 서명/신분증 이미지 → Drive 저장, Docs에 서명/신분증 삽입 | Config, SheetHelpers |
| WebApp.gs | doGet(e) 웹앱 핸들러. 토큰 검증 후 서명 페이지 서빙 | SignatureService, SheetHelpers |
| html/Sidebar.html | 사이드바 UI. google.script.run으로 서버 함수 호출 | - |
| html/SignaturePage.html | 서명 캔버스 + 신분증 업로드 UI. 웹앱 모드로 동작 (isWebApp 플래그) | - |

### 함수 호출 관계

```
onOpen() → 메뉴 등록
openSidebar() → Sidebar.html 서빙
  Sidebar.html → getSelectedRowSummary() → 행 정보 표시
  Sidebar.html → generateContractForSelectedRow() → 계약서 생성 (임대인 서명 자동 삽입)
  Sidebar.html → sendContractEmail(rowNumber) → 계약요청 이메일 발송 (첨부파일 포함)
  Sidebar.html → sendCompletionEmail(rowNumber) → 최종계약서 이메일 발송 (임대인 확인 후)

doGet(e) → 토큰 검증 → SignaturePage.html 서빙 (웹앱)
  SignaturePage.html → processSignature(token, dataUrl, idCardDataUrl) → 서명+신분증 처리
```

### 계약 상태 흐름

```
작성중 → [계약서 생성] → 작성중
       → [이메일 발송] → 서명대기
       → [임차인 서명+신분증] → 서명완료
       → [임대인 확인 → 최종계약서 발송] → 완료
```

- **서명완료**: 임차인 서명 완료 후 임대인 확인 대기 상태
- **완료**: 임대인이 확인 후 최종계약서 이메일 발송 완료

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
AG:이메일_발송 AH:이메일_발송일 AI:완료이메일_발송일 AJ:서명_토큰
AK:임대인_서명 AL:임차인_서명 AM:계약_상태
```

### 시스템 컬럼 (SYSTEM_COLUMNS)

AD~AM 컬럼은 시스템이 자동 관리. 플레이스홀더 치환 시 건너뜀.

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
template_doc_id      → config.templateDocId
output_folder_id     → config.outputFolderId
signature_folder_id  → config.signatureFolderId
id_card_folder_id    → config.idCardFolderId       (신분증 저장 폴더)
web_app_url          → config.webAppUrl
sender_name          → config.senderName
sender_email         → config.senderEmail
company_name         → config.companyName
landlord_name        → config.landlordName          (임대인 이름)
landlord_phone       → config.landlordPhone         (임대인 연락처)
landlord_email       → config.landlordEmail         (임대인 이메일)
sms_template         → config.smsTemplate           (SMS 문자 템플릿)
attachment_file_ids  → config.attachmentFileIds      (이메일 첨부파일 Drive 파일 ID, 쉼표 구분)
```

## clasp 명령어 (최신 버전)

구 명령어가 변경됨:
- `clasp open` → `clasp open-script`
- `clasp deploy` → `clasp create-deployment`
- `clasp logs` → `clasp tail-logs`
- `clasp deployments` → `clasp list-deployments`

## 서명 페이지 (SignaturePage.html)

웹앱 모드로 임차인 서명 수집에 사용. `doGet()`에서 `createTemplateFromFile()`로 서빙하며 템플릿 변수(`<?= token ?>` 등) 주입.

서명 페이지 기능:
- HTML5 Canvas 기반 서명/도장 그리기 (마우스/터치 지원)
- **신분증 사본 업로드 (필수)**: 이미지 파일 선택 → FileReader로 base64 변환
- `processSignature(token, dataUrl, idCardDataUrl)` 호출로 서명+신분증 동시 제출

임대인 서명은 계약서 생성 시 자동 삽입되므로 별도 서명 UI 불필요.

## 이메일 기능

### 계약요청 이메일 (sendContractEmail)
- 계약서 검토 링크 + 전자서명 링크 포함
- `attachment_file_ids` 설정의 파일을 첨부 (예: 전대동의서.pdf)
- 상태를 '서명대기'로 변경

### 최종계약서 이메일 (sendCompletionEmail)
- 임대인이 서명/신분증 확인 후 수동 발송
- 완료된 계약서 확인 링크 포함
- 상태를 '완료'로 변경

### 이메일 footer
```
공유오피스 MOO 두정역점
대표 | {sender_name}
{landlord_phone}
```

### SMS 템플릿 플레이스홀더
```
{{이름}}, {{지점명}}, {{상호}}, {{층}}, {{호수}}, {{보증금}}, {{공급가액}}
{{서명링크}} → 전자서명 웹앱 URL
{{계약서_링크}} → Google Docs 계약서 URL
```

## ★ Claude Code 배포 스킬 (필수 사용)

코드 수정 후 배포 시 **반드시 프로젝트 스킬을 사용**할 것. 직접 clasp 명령어를 실행하지 않는다.

| 스킬 | 용도 | 사용 시점 |
|------|------|-----------|
| **`/deploy [설명]`** | push + 웹앱 배포 업데이트 | 웹앱 관련 코드 수정 시 (서명, WebApp.gs 등) |
| **`/push`** | push만 (HEAD 업데이트) | 스프레드시트 기능만 수정 시 (사이드바, 메뉴 등) |

스킬 정의 파일: `.claude/skills/deploy/SKILL.md`, `.claude/skills/push/SKILL.md`

## 코드 수정 시 주의사항

1. **getActiveSpreadsheet() 직접 사용 금지** → 반드시 `getSpreadsheet()` 사용 (웹앱 호환)
2. **push vs deploy (웹앱 배포 주의)**:
   - `npm run push` (clasp push): HEAD 코드만 업데이트. **스프레드시트 내 기능**(사이드바, 메뉴, 다이얼로그)은 즉시 반영됨.
   - **웹앱은 배포된 버전(version)을 사용**하므로, push만으로는 웹앱에 반영되지 않음. .gs 서버 함수 변경도 마찬가지.
   - 웹앱 반영: `npx clasp deploy -i <deploymentId> -d "설명"` 으로 기존 배포를 업데이트해야 함.
   - 배포 ID 확인: `npm run deployments` (clasp list-deployments)
   - **요약**: 스프레드시트 기능만 수정 → push만. 웹앱(서명 등) 관련 수정 → push + deploy 필수.
3. **OAuth 스코프 추가 시**: `src/appsscript.json`의 `oauthScopes`에 추가 후 push → 사용자가 재승인 필요
4. **컬럼 추가/변경 시**: SheetHelpers.gs의 `CONTRACT_HEADERS` 배열도 동기화 필요
5. **템플릿 플레이스홀더**: 새 컬럼 추가 시 Google Docs 템플릿에도 `{{새컬럼}}` 추가 필요
6. **GAS 제한**: 실행 시간 6분, 일일 트리거 한도 있음. 대량 처리 시 배치 분할 고려.

## 알려진 이슈 및 해결 내역

- **clasp push "Insufficient Permission"**: Google Apps Script API 활성화 + clasp login 재실행으로 해결
- **appsscript.json not found**: rootDir("src") 안에 위치해야 함
- **Ui.showSidebar 권한 오류**: `script.container.ui` 스코프 추가로 해결
- **웹앱에서 "계약목록 시트를 찾을 수 없습니다"**: `getSpreadsheet()` fallback 추가, initSettingsSheet()에서 SPREADSHEET_ID 저장으로 해결
- **웹앱 코드 변경이 반영되지 않음**: `clasp push`는 HEAD만 업데이트. 웹앱은 배포된 버전을 실행하므로 `npx clasp deploy -i <deploymentId>`로 배포 업데이트 필요
- **계약_상태 드롭다운**: '서명완료' 상태가 추가됨. 시트 초기화 시 드롭다운 옵션에 포함 필요
