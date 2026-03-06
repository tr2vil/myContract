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
 * @param {string} dataUrl - base64 인코딩된 서명/도장 이미지
 * @param {string} idCardDataUrl - base64 인코딩된 신분증 이미지
 * @returns {Object} 처리 결과
 */
function processSignature(token, dataUrl, idCardDataUrl) {
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

  // 4. 신분증 사본 저장 및 계약서 첨부
  if (idCardDataUrl) {
    var idCardFileId = saveIdCardImage(idCardDataUrl, rowInfo.tenantName);
    appendIdCardToDoc(rowInfo.docId, idCardFileId, rowInfo.tenantName);
  }

  // 5. 스프레드시트 상태 업데이트 (임대인 확인 대기)
  updateCellValue(rowInfo.rowNumber, '임차인_서명', true);
  updateCellValue(rowInfo.rowNumber, '계약_상태', '서명완료');

  return { success: true };
}


/**
 * 신분증 이미지를 Google Drive에 저장
 * @param {string} dataUrl - base64 인코딩된 이미지
 * @param {string} signerName - 서명자 이름
 * @returns {string} 저장된 파일 ID
 */
function saveIdCardImage(dataUrl, signerName) {
  var config = getConfig();
  if (!config.idCardFolderId) {
    throw new Error('설정 시트에 id_card_folder_id가 입력되지 않았습니다.');
  }

  var mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
  var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  var ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  var base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  var decoded = Utilities.base64Decode(base64Data);
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  var fileName = '신분증_' + signerName + '_' + timestamp + '.' + ext;

  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  var folder = DriveApp.getFolderById(config.idCardFolderId);
  var file = folder.createFile(blob);

  return file.getId();
}

/**
 * 신분증 이미지를 계약서 문서 최하단에 첨부
 * @param {string} docId - Google Docs 문서 ID
 * @param {string} imageFileId - Drive 신분증 이미지 파일 ID
 * @param {string} signerName - 서명자 이름
 */
function appendIdCardToDoc(docId, imageFileId, signerName) {
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  // 구분선
  body.appendHorizontalRule();

  // 제목
  var heading = body.appendParagraph('임차인 신분증 사본');
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
  heading.setBold(true);

  // 신분증 이미지 삽입
  var imgBlob = DriveApp.getFileById(imageFileId).getBlob();
  var para = body.appendParagraph('');
  var img = para.appendInlineImage(imgBlob);

  // 이미지 크기 조정 (가로 최대 400px, 비율 유지)
  var origW = img.getWidth();
  var origH = img.getHeight();
  var maxW = 400;
  if (origW > maxW && origW > 0 && origH > 0) {
    var scale = maxW / origW;
    img.setWidth(maxW);
    img.setHeight(Math.round(origH * scale));
  }

  doc.saveAndClose();
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

  var mimeMatch = dataUrl.match(/^data:(image\/\w+);base64,/);
  var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  var ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  var base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  var decoded = Utilities.base64Decode(base64Data);
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
  var fileName = '서명_' + party + '_' + signerName + '_' + timestamp + '.' + ext;

  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  var folder = DriveApp.getFolderById(config.signatureFolderId);
  var file = folder.createFile(blob);

  return file.getId();
}

/**
 * 서명 이미지를 계약서 문서의 모든 서명란에 삽입
 * 재귀 순회로 모든 위치를 수집 후, 역순으로 교체 (로그 포함)
 *
 * @param {string} docId - Google Docs 문서 ID
 * @param {string} imageFileId - Drive 서명 이미지 파일 ID
 * @param {string} party - '임대인' 또는 '임차인'
 */
function insertSignatureIntoDoc(docId, imageFileId, party) {
  var placeholder = party === '임대인' ? '[임대인 서명란]' : '[임차인 서명란]';

  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  // 재귀 순회로 모든 서명란 위치 수집
  var targets = [];
  function collect(el) {
    var type = el.getType();
    if (type === DocumentApp.ElementType.TABLE) {
      var table = el.asTable();
      for (var r = 0; r < table.getNumRows(); r++) {
        var row = table.getRow(r);
        for (var c = 0; c < row.getNumCells(); c++) {
          var cell = row.getCell(c);
          for (var p = 0; p < cell.getNumChildren(); p++) {
            collect(cell.getChild(p));
          }
        }
      }
    } else if (type === DocumentApp.ElementType.PARAGRAPH) {
      if (el.asParagraph().getText().indexOf(placeholder) !== -1) {
        targets.push(el.asParagraph());
      }
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      if (el.asListItem().getText().indexOf(placeholder) !== -1) {
        targets.push(el.asListItem());
      }
    }
  }
  for (var i = 0; i < body.getNumChildren(); i++) {
    collect(body.getChild(i));
  }

  // 역순으로 교체 (인덱스 변동 방지)
  for (var j = targets.length - 1; j >= 0; j--) {
    var para = targets[j];
    var text = para.getText();
    var idx = text.indexOf(placeholder);
    if (idx === -1) continue;

    para.editAsText().deleteText(idx, idx + placeholder.length - 1);

    var freshBlob = DriveApp.getFileById(imageFileId).getBlob();
    var img = para.insertInlineImage(0, freshBlob);
    var origW = img.getWidth();
    var origH = img.getHeight();
    var maxH = 80;
    if (origW > 0 && origH > 0) {
      var scale = maxH / origH;
      img.setWidth(Math.round(origW * scale));
      img.setHeight(maxH);
    } else {
      img.setWidth(80);
      img.setHeight(80);
    }
  }

  doc.saveAndClose();
}

