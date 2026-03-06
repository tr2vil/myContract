/**
 * SheetHelpers.gs - 스프레드시트 데이터 접근 유틸리티
 *
 * 계약목록 시트에서 행 데이터를 읽고, 상태를 업데이트하는 헬퍼 함수 모음
 */

// 계약목록 시트의 컬럼 헤더 정의
var CONTRACT_HEADERS = [
  '순번', '상주', '사업자', '지점명', '층', '호수', '평수',
  '상호', '사업자등록번호', '업체거주지',
  '이름', '연락처', '비고', '비고(게시판)', '긴급연락처', '이메일',
  '입금일', '계약일', '시작일', '종료일', '계약만료일', '최초계약일',
  '공급가액', '보증금', '계산서', '계산서별도',
  '상호2', '사업자등록번호2', '이름2',
  '계약서_생성', '계약서_문서ID', '계약서_링크',
  '이메일_발송', '이메일_발송일', '서명_토큰',
  '임대인_서명', '임차인_서명', '계약_상태', '완료이메일_발송일'
];

// 금액 컬럼 목록 (콤마 포맷 적용 대상)
var CURRENCY_COLUMNS = ['공급가액', '보증금'];

// 시스템 관리 컬럼 (플레이스홀더 치환 제외)
var SYSTEM_COLUMNS = [
  '계약서_생성', '계약서_문서ID', '계약서_링크',
  '이메일_발송', '이메일_발송일', '서명_토큰',
  '임대인_서명', '임차인_서명', '계약_상태', '완료이메일_발송일'
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

  var config = getConfig();
  var unitInfo = '';
  if (data['층'] || data['호수']) {
    unitInfo = (data['층'] ? data['층'] + '층' : '') + (data['호수'] ? ' ' + data['호수'] + '호' : '');
    unitInfo = unitInfo.trim();
  }

  return {
    rowNumber: row,
    businessName: data['상호'] || '(미입력)',
    tenantName: data['이름'] || '(미입력)',
    propertyAddress: data['지점명'] || '(미입력)',
    unitNumber: unitInfo,
    deposit: data['보증금'] || '0',
    supplyAmount: data['공급가액'] || '0',
    tenantEmail: data['이메일'] || '',
    contractDate: data['계약일'] || '(미입력)',
    contractGenerated: data['계약서_생성'] === 'true',
    contractDocId: data['계약서_문서ID'] || '',
    emailSent: data['이메일_발송'] === 'true',
    landlordSigned: data['임대인_서명'] === 'true',
    tenantSigned: data['임차인_서명'] === 'true',
    status: data['계약_상태'] || '작성중'
  };
}

/**
 * 특정 행의 계약_상태를 경량 조회 (폴링용)
 * @param {number} rowNumber - 행 번호
 * @returns {string} 계약_상태 값
 */
function checkSignatureStatus(rowNumber) {
  var sheet = getContractSheet();
  var cols = getColumnIndices();
  var colIndex = cols['계약_상태'];
  return sheet.getRange(rowNumber, colIndex).getValue() || '작성중';
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
 * 숫자를 한글 금액 표기로 변환
 * 예: 132000 → "십삼만이천", 50000000 → "오천만"
 * @param {number|string} num - 변환할 숫자
 * @returns {string} 한글 금액 문자열
 */
function numberToKorean(num) {
  if (typeof num === 'string') {
    num = parseInt(num.replace(/,/g, ''), 10);
  }
  if (isNaN(num) || num === 0) return '영';

  var digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  var units = ['', '십', '백', '천'];
  var bigUnits = ['', '만', '억', '조'];

  var result = '';
  var unitIndex = 0;

  while (num > 0) {
    var chunk = num % 10000;
    if (chunk > 0) {
      var chunkStr = '';
      var pos = 0;
      var temp = chunk;
      while (temp > 0) {
        var digit = temp % 10;
        if (digit > 0) {
          if (digit === 1 && pos > 0) {
            chunkStr = units[pos] + chunkStr;
          } else {
            chunkStr = digits[digit] + units[pos] + chunkStr;
          }
        }
        temp = Math.floor(temp / 10);
        pos++;
      }
      result = chunkStr + bigUnits[unitIndex] + result;
    }
    num = Math.floor(num / 10000);
    unitIndex++;
  }

  return result;
}

/**
 * 계약목록 시트 초기 구조를 생성 (최초 1회 실행)
 */
function initContractSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('계약목록');

  if (sheet) {
    // 기존 시트가 있으면 삭제 후 재생성 (서식 잔재 방지)
    ss.deleteSheet(sheet);
  }
  sheet = ss.insertSheet('계약목록');

  // 헤더 설정
  sheet.getRange(1, 1, 1, CONTRACT_HEADERS.length).setValues([CONTRACT_HEADERS]);

  // 데이터 컬럼 헤더 (파란색)
  var dataColCount = CONTRACT_HEADERS.length - SYSTEM_COLUMNS.length;
  sheet.getRange(1, 1, 1, dataColCount)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setWrap(true);

  // 시스템 컬럼 헤더 (회색)
  sheet.getRange(1, dataColCount + 1, 1, SYSTEM_COLUMNS.length)
    .setFontWeight('bold')
    .setBackground('#9e9e9e')
    .setFontColor('#ffffff')
    .setWrap(true);

  // 체크박스 컬럼 설정
  var checkboxCols = ['계산서별도', '계약서_생성', '이메일_발송', '임대인_서명', '임차인_서명'];
  var cols = {};
  CONTRACT_HEADERS.forEach(function(h, i) { cols[h] = i + 1; });

  checkboxCols.forEach(function(colName) {
    sheet.getRange(2, cols[colName], 100, 1).insertCheckboxes();
  });

  // 계산서 드롭다운
  var invoiceTypes = SpreadsheetApp.newDataValidation()
    .requireValueInList(['세금', '현금', '어플', '카드'], true)
    .build();
  sheet.getRange(2, cols['계산서'], 100, 1).setDataValidation(invoiceTypes);

  // 계약_상태 드롭다운
  var statusOptions = SpreadsheetApp.newDataValidation()
    .requireValueInList(['작성중', '검토중', '서명대기', '완료'], true)
    .build();
  sheet.getRange(2, cols['계약_상태'], 100, 1).setDataValidation(statusOptions);

  // 금액 컬럼 천단위 콤마 서식
  CURRENCY_COLUMNS.forEach(function(colName) {
    sheet.getRange(2, cols[colName], 100, 1).setNumberFormat('#,##0');
  });

  // 열 너비 조정
  sheet.setColumnWidth(cols['순번'], 50);
  sheet.setColumnWidth(cols['지점명'], 200);
  sheet.setColumnWidth(cols['상호'], 150);
  sheet.setColumnWidth(cols['업체거주지'], 200);
  sheet.setColumnWidth(cols['비고'], 200);
  sheet.setColumnWidth(cols['비고(게시판)'], 200);

  // 1행 고정
  sheet.setFrozenRows(1);

  // 헤더행 보호 (편집 시 경고 표시)
  var headerProtection = sheet.getRange(1, 1, 1, CONTRACT_HEADERS.length).protect();
  headerProtection.setDescription('헤더행 - 수정하지 마세요');
  headerProtection.setWarningOnly(true);

  // 시스템 컬럼 보호 (편집 시 경고 표시)
  var systemProtection = sheet.getRange(2, dataColCount + 1, sheet.getMaxRows() - 1, SYSTEM_COLUMNS.length).protect();
  systemProtection.setDescription('시스템 자동 관리 영역 - 수동 편집하지 마세요');
  systemProtection.setWarningOnly(true);

  SpreadsheetApp.getUi().alert('계약목록 시트가 생성되었습니다.');
}
