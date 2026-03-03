/**
 * SheetHelpers.gs - 스프레드시트 데이터 접근 유틸리티
 *
 * 계약목록 시트에서 행 데이터를 읽고, 상태를 업데이트하는 헬퍼 함수 모음
 */

// 계약목록 시트의 컬럼 헤더 정의
var CONTRACT_HEADERS = [
  '번호', '계약일자',
  '임대인_이름', '임대인_주민번호', '임대인_주소', '임대인_전화', '임대인_이메일',
  '임차인_이름', '임차인_주민번호', '임차인_주소', '임차인_전화', '임차인_이메일',
  '소재지', '건물유형', '면적_m2', '동_호수',
  '보증금', '월세', '관리비',
  '계약금', '중도금', '잔금',
  '계약금_지급일', '중도금_지급일', '잔금_지급일',
  '임대기간_시작', '임대기간_종료',
  '특약사항',
  '계약서_생성', '계약서_문서ID', '계약서_링크',
  '이메일_발송', '이메일_발송일', '서명_토큰',
  '임대인_서명', '임차인_서명', '계약_상태'
];

// 금액 컬럼 목록 (콤마 포맷 적용 대상)
var CURRENCY_COLUMNS = ['보증금', '월세', '관리비', '계약금', '중도금', '잔금'];

// 시스템 관리 컬럼 (플레이스홀더 치환 제외)
var SYSTEM_COLUMNS = [
  '계약서_생성', '계약서_문서ID', '계약서_링크',
  '이메일_발송', '이메일_발송일', '서명_토큰',
  '임대인_서명', '임차인_서명', '계약_상태'
];

/**
 * 스프레드시트 객체를 가져온다 (웹앱 컨텍스트 대응)
 * 스프레드시트 내에서 실행 시 getActiveSpreadsheet() 사용,
 * 웹앱에서 실행 시 저장된 스프레드시트 ID로 열기
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  // 웹앱 컨텍스트: 저장된 스프레드시트 ID로 열기
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!ssId) {
    throw new Error('스프레드시트 ID가 설정되지 않았습니다. 스프레드시트에서 "계약 관리 > 시트 초기 설정"을 실행해주세요.');
  }
  return SpreadsheetApp.openById(ssId);
}

/**
 * 계약목록 시트를 가져온다
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getContractSheet() {
  var sheet = getSpreadsheet().getSheetByName('계약목록');
  if (!sheet) {
    throw new Error('계약목록 시트를 찾을 수 없습니다.');
  }
  return sheet;
}

/**
 * 컬럼 헤더명 → 1-based 컬럼 인덱스 맵을 반환
 * @returns {Object} { 헤더명: 컬럼번호, ... }
 */
function getColumnIndices() {
  var sheet = getContractSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var indices = {};
  headers.forEach(function(h, i) {
    if (h) indices[String(h).trim()] = i + 1;
  });
  return indices;
}

/**
 * 특정 행의 데이터를 { 컬럼헤더: 값 } 맵으로 반환
 * 날짜와 금액은 한국어 포맷으로 변환
 * @param {number} rowNumber - 1-based 행 번호
 * @returns {Object} { 컬럼헤더: 문자열값, ... }
 */
function getRowData(rowNumber) {
  var sheet = getContractSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];

  var data = {};
  headers.forEach(function(header, i) {
    if (!header) return;
    var key = String(header).trim();
    var val = values[i];

    // 날짜 포맷
    if (val instanceof Date) {
      val = Utilities.formatDate(val, 'Asia/Seoul', 'yyyy년 MM월 dd일');
    }

    // 금액 포맷 (숫자 → 콤마 구분)
    if (CURRENCY_COLUMNS.indexOf(key) !== -1 && typeof val === 'number') {
      val = formatCurrency(val);
    }

    data[key] = (val !== null && val !== undefined && val !== '') ? String(val) : '';
  });

  return data;
}

/**
 * 현재 선택된 행 번호를 반환
 * @returns {number} 1-based 행 번호
 */
function getSelectedRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();

  if (row < 2) {
    throw new Error('데이터 행을 선택해주세요. (2행 이상)');
  }

  return row;
}

/**
 * 선택된 행의 요약 정보를 반환 (사이드바 표시용)
 * @returns {Object} 행 요약 정보
 */
function getSelectedRowSummary() {
  var row = getSelectedRow();
  var data = getRowData(row);

  return {
    rowNumber: row,
    landlordName: data['임대인_이름'] || '(미입력)',
    tenantName: data['임차인_이름'] || '(미입력)',
    propertyAddress: data['소재지'] || '(미입력)',
    unitNumber: data['동_호수'] || '',
    deposit: data['보증금'] || '0',
    monthlyRent: data['월세'] || '0',
    contractDate: data['계약일자'] || '(미입력)',
    contractGenerated: data['계약서_생성'] === 'true',
    contractDocId: data['계약서_문서ID'] || '',
    emailSent: data['이메일_발송'] === 'true',
    landlordSigned: data['임대인_서명'] === 'true',
    tenantSigned: data['임차인_서명'] === 'true',
    status: data['계약_상태'] || '작성중'
  };
}

/**
 * 특정 행의 상태 컬럼을 업데이트
 * @param {number} rowNumber - 행 번호
 * @param {string} columnName - 컬럼 헤더명
 * @param {*} value - 설정할 값
 */
function updateCellValue(rowNumber, columnName, value) {
  var sheet = getContractSheet();
  var cols = getColumnIndices();
  var colIndex = cols[columnName];
  if (!colIndex) {
    throw new Error('컬럼을 찾을 수 없습니다: ' + columnName);
  }
  sheet.getRange(rowNumber, colIndex).setValue(value);
}

/**
 * 숫자를 한국 원화 형식의 문자열로 변환
 * @param {number} amount - 금액
 * @returns {string} 콤마 구분 문자열
 */
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 계약목록 시트 초기 구조를 생성 (최초 1회 실행)
 */
function initContractSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('계약목록');

  if (!sheet) {
    sheet = ss.insertSheet('계약목록');
  }

  // 헤더 설정
  sheet.getRange(1, 1, 1, CONTRACT_HEADERS.length).setValues([CONTRACT_HEADERS]);
  sheet.getRange(1, 1, 1, CONTRACT_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setWrap(true);

  // 체크박스 컬럼 설정
  var checkboxCols = ['계약서_생성', '이메일_발송', '임대인_서명', '임차인_서명'];
  var cols = {};
  CONTRACT_HEADERS.forEach(function(h, i) { cols[h] = i + 1; });

  checkboxCols.forEach(function(colName) {
    sheet.getRange(2, cols[colName], 100, 1).insertCheckboxes();
  });

  // 건물유형 드롭다운
  var buildingTypes = SpreadsheetApp.newDataValidation()
    .requireValueInList(['아파트', '오피스텔', '빌라', '단독주택', '상가', '사무실'], true)
    .build();
  sheet.getRange(2, cols['건물유형'], 100, 1).setDataValidation(buildingTypes);

  // 계약_상태 드롭다운
  var statusOptions = SpreadsheetApp.newDataValidation()
    .requireValueInList(['작성중', '검토중', '서명대기', '완료'], true)
    .build();
  sheet.getRange(2, cols['계약_상태'], 100, 1).setDataValidation(statusOptions);

  // 열 너비 조정
  sheet.setColumnWidth(cols['번호'], 50);
  sheet.setColumnWidth(cols['특약사항'], 300);
  sheet.setColumnWidth(cols['소재지'], 250);

  // 1행 고정
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('계약목록 시트가 생성되었습니다.');
}
