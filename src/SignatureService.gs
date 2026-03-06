/**
 * SignatureService.gs - 서명 처리 모듈
 *
 * UUID 토큰 생성, 서명 이미지 처리(base64 → Drive 저장),
 * Google Docs 문서에 서명 이미지 삽입
 */

/**
 * 계약 행에 대한 고유 서명 토큰 생성
 * @param {number} rowNumber - 행 번호
 * @returns {string} UUID 토큰
 */
function generateSignatureToken(rowNumber) {
  var token = Utilities.getUuid();
  updateCellValue(rowNumber, '서명_토큰', token);
  return token;
}

/**
 * 토큰으로 해당 계약 행 정보를 검색
 * @param {string} token - 서명 토큰
 * @returns {Object|null} 행 정보 또는 null
 */
function findRowByToken(token) {
  if (!token) return null;

  var sheet = getContractSheet();
  var cols = getColumnIndices();
  var tokenCol = cols['서명_토큰'];

  if (!tokenCol) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var data = sheet.getRange(2, tokenCol, lastRow - 1, 1).getValues();

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === token) {
      var rowNumber = i + 2;
      var rowData = getRowData(rowNumber);

      var unitInfo = '';
      if (rowData['층'] || rowData['호수']) {
        unitInfo = (rowData['층'] ? rowData['층'] + '층' : '') + (rowData['호수'] ? ' ' + rowData['호수'] + '호' : '');
        unitInfo = unitInfo.trim();
      }

      return {
        rowNumber: rowNumber,
        tenantName: rowData['이름'],
        propertyAddress: rowData['지점명'],
        unitNumber: unitInfo,
        docId: rowData['계약서_문서ID'],
        landlordSigned: rowData['임대인_서명'] === 'true',
        tenantSigned: rowData['임차인_서명'] === 'true'
      };
    }
  }
  return null;
}

/**
 * 웹앱에서 서명이 제출되었을 때 호출
 * @param {string} token - 서명 토큰
 * @param {string} dataUrl - base64 인코딩된 PNG 이미지 (data:image/png;base64,...)
 * @returns {Object} 처리 결과
 */
function processSignature(token, dataUrl) {
  // 1. 토큰 검증
  var rowInfo = findRowByToken(token);
  if (!rowInfo) {
    throw new Error('유효하지 않은 서명 링크입니다.');
  }
  if (rowInfo.tenantSigned) {
    throw new Error('이미 서명이 완료된 계약서입니다.');
  }
  if (!rowInfo.docId) {
    throw new Error('계약서 문서를 찾을 수 없습니다.');
  }

  // 2. 서명 이미지 저장
  var signatureFileId = saveSignatureImage(dataUrl, rowInfo.tenantName, '임차인');

  // 3. 계약서 문서에 서명 삽입
  insertSignatureIntoDoc(rowInfo.docId, signatureFileId, '임차인');

  // 4. 스프레드시트 상태 업데이트
  updateCellValue(rowInfo.rowNumber, '임차인_서명', true);

  // 양측 모두 서명 완료 시 상태 변경
  if (rowInfo.landlordSigned) {
    updateCellValue(rowInfo.rowNumber, '계약_상태', '완료');
  }

  return { success: true };
}

/**
 * 임대인 서명 처리 (사이드바에서 호출)
 * @param {string} dataUrl - base64 인코딩된 PNG 이미지
 * @returns {Object} 처리 결과
 */
function processLandlordSignature(dataUrl) {
  var rowNumber = getSelectedRow();
  var rowData = getRowData(rowNumber);

  if (!rowData['계약서_문서ID']) {
    throw new Error('계약서가 아직 생성되지 않았습니다.');
  }
  if (rowData['임대인_서명'] === 'true') {
    throw new Error('이미 서명이 완료되었습니다.');
  }

  // 서명 이미지 저장
  var config = getConfig();
  var landlordName = config.landlordName || '임대인';
  var signatureFileId = saveSignatureImage(dataUrl, landlordName, '임대인');

  // 계약서에 서명 삽입
  insertSignatureIntoDoc(rowData['계약서_문서ID'], signatureFileId, '임대인');

  // 상태 업데이트
  updateCellValue(rowNumber, '임대인_서명', true);

  // 양측 모두 서명 완료 확인
  if (rowData['임차인_서명'] === 'true') {
    updateCellValue(rowNumber, '계약_상태', '완료');
  }

  return { success: true };
}

/**
 * base64 이미지를 Google Drive에 저장
 * @param {string} dataUrl - data:image/png;base64,... 형식
 * @param {string} signerName - 서명자 이름
 * @param {string} party - '임대인' 또는 '임차인'
 * @returns {string} 저장된 파일 ID
 */
function saveSignatureImage(dataUrl, signerName, party) {
  var config = getConfig();
  if (!config.signatureFolderId) {
    throw new Error('설정 시트에 signature_folder_id가 입력되지 않았습니다.');
  }

  var base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  var decoded = Utilities.base64Decode(base64Data);
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  var fileName = '서명_' + party + '_' + signerName + '_' + timestamp + '.png';

  var blob = Utilities.newBlob(decoded, 'image/png', fileName);
  var folder = DriveApp.getFolderById(config.signatureFolderId);
  var file = folder.createFile(blob);

  return file.getId();
}

/**
 * 서명 이미지를 계약서 문서에 삽입
 * @param {string} docId - Google Docs 문서 ID
 * @param {string} imageFileId - Drive 서명 이미지 파일 ID
 * @param {string} party - '임대인' 또는 '임차인'
 */
function insertSignatureIntoDoc(docId, imageFileId, party) {
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  var placeholder = party === '임대인' ? '\\[임대인 서명란\\]' : '\\[임차인 서명란\\]';
  var searchResult = body.findText(placeholder);

  if (searchResult) {
    var element = searchResult.getElement();
    var parent = element.getParent();

    // 플레이스홀더 텍스트 제거
    var plainPlaceholder = party === '임대인' ? '[임대인 서명란]' : '[임차인 서명란]';
    body.replaceText(placeholder, '');

    // 서명 이미지 삽입
    var imageBlob = DriveApp.getFileById(imageFileId).getBlob();

    if (parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var paragraph = parent.asParagraph();
      var inlineImage = paragraph.appendInlineImage(imageBlob);
      inlineImage.setWidth(150);
      inlineImage.setHeight(60);
    }
  }

  doc.saveAndClose();
}

/**
 * 임대인 서명 다이얼로그 열기
 */
function openLandlordSignatureDialog() {
  var html = HtmlService.createHtmlOutputFromFile('html/SignaturePage')
    .setWidth(520)
    .setHeight(450);

  // 다이얼로그 모드에서는 토큰 대신 직접 호출
  SpreadsheetApp.getUi().showModalDialog(html, '임대인 서명');
}
