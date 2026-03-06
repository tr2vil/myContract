/**
 * ContractGenerator.gs - 계약서 생성 모듈
 *
 * Google Docs 템플릿을 복사하고, 플레이스홀더를 스프레드시트 데이터로 치환하여
 * 개별 계약서 문서를 생성한다.
 */

/**
 * 선택된 행의 계약서를 생성
 * @returns {Object} { docId, docUrl, fileName }
 */
function generateContractForSelectedRow() {
  var rowNumber = getSelectedRow();
  return generateContract(rowNumber);
}

/**
 * 지정된 행의 계약서를 생성
 * @param {number} rowNumber - 1-based 행 번호
 * @returns {Object} { docId, docUrl, fileName }
 */
function generateContract(rowNumber) {
  // 1. 설정 읽기
  var config = getConfig();
  if (!config.templateDocId) {
    throw new Error('설정 시트에 template_doc_id가 입력되지 않았습니다.');
  }
  if (!config.outputFolderId) {
    throw new Error('설정 시트에 output_folder_id가 입력되지 않았습니다.');
  }

  // 2. 행 데이터 읽기
  var rowData = getRowData(rowNumber);

  if (!rowData['이름']) {
    throw new Error('이름은 필수 입력 항목입니다.');
  }

  // 3. 템플릿 복사
  var templateFile = DriveApp.getFileById(config.templateDocId);
  var folder = DriveApp.getFolderById(config.outputFolderId);

  var dateStr = rowData['계약일'] || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var contractName = '계약서_' + (rowData['상호'] || '') + '_' + rowData['이름'] + '_' + dateStr;

  var copiedFile = templateFile.makeCopy(contractName, folder);
  var docId = copiedFile.getId();

  // 4. 금액 한글 변환 플레이스홀더 추가
  CURRENCY_COLUMNS.forEach(function(col) {
    var rawVal = rowData[col];
    if (rawVal) {
      var numVal = parseInt(String(rawVal).replace(/,/g, ''), 10);
      if (!isNaN(numVal)) {
        rowData[col + '_한글'] = numberToKorean(numVal);
      }
    }
  });

  // 날짜에서 일(dd) 추출 플레이스홀더
  var dateColumns = ['시작일', '종료일', '계약일', '입금일'];
  dateColumns.forEach(function(col) {
    if (rowData[col]) {
      var dayMatch = rowData[col].match(/(\d+)일/);
      if (dayMatch) {
        var day = parseInt(dayMatch[1], 10);
        rowData[col + '_일'] = (day < 10 ? '0' : '') + day;
      }
    }
  });

  // 5. 플레이스홀더 치환
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  var keys = Object.keys(rowData);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    // 시스템 관리 컬럼은 건너뛰기
    if (SYSTEM_COLUMNS.indexOf(key) !== -1 || key === '순번') {
      continue;
    }

    var placeholder = '{{' + key + '}}';
    var value = rowData[key] || '';
    body.replaceText(escapeRegex(placeholder), value);
  }

  doc.saveAndClose();

  // 5. 임차인에게 뷰어 권한 부여
  var tenantEmail = rowData['이메일'];
  if (tenantEmail) {
    copiedFile.addViewer(tenantEmail);
  }

  // 6. 상태 업데이트
  updateCellValue(rowNumber, '계약서_생성', true);
  updateCellValue(rowNumber, '계약서_문서ID', docId);
  updateCellValue(rowNumber, '계약_상태', '검토중');

  // 하이퍼링크 수식 설정
  var sheet = getContractSheet();
  var cols = getColumnIndices();
  var docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
  sheet.getRange(rowNumber, cols['계약서_링크'])
    .setFormula('=HYPERLINK("' + docUrl + '", "열기")');

  return {
    docId: docId,
    docUrl: docUrl,
    fileName: contractName
  };
}

/**
 * 이미 생성된 계약서를 다시 생성 (덮어쓰기)
 * @param {number} rowNumber - 행 번호
 * @returns {Object} { docId, docUrl, fileName }
 */
function regenerateContract(rowNumber) {
  var rowData = getRowData(rowNumber);
  var existingDocId = rowData['계약서_문서ID'];

  // 기존 문서 삭제 (휴지통으로)
  if (existingDocId) {
    try {
      DriveApp.getFileById(existingDocId).setTrashed(true);
    } catch (e) {
      // 이미 삭제된 경우 무시
    }
  }

  return generateContract(rowNumber);
}

/**
 * 정규표현식 특수문자 이스케이프
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
