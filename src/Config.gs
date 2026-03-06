/**
 * Config.gs - 설정 시트에서 설정값을 읽고 관리하는 모듈
 *
 * 설정 시트 구조:
 *   A열: 설정 항목 (key)
 *   B열: 설정 값 (value)
 *   C열: 설명 (description, 참고용)
 */

/**
 * 설정 시트에서 모든 설정값을 읽어 객체로 반환
 * @returns {Object} 설정값 객체
 */
function getConfig() {
  var sheet = getSpreadsheet().getSheetByName('설정');
  if (!sheet) {
    throw new Error('설정 시트를 찾을 수 없습니다. "설정" 시트를 생성해주세요.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('설정 시트에 설정값이 없습니다.');
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var raw = {};
  data.forEach(function(row) {
    if (row[0]) {
      raw[String(row[0]).trim()] = row[1];
    }
  });

  return {
    templateDocId: raw['template_doc_id'] || '',
    outputFolderId: raw['output_folder_id'] || '',
    signatureFolderId: raw['signature_folder_id'] || '',
    webAppUrl: raw['web_app_url'] || '',
    senderName: raw['sender_name'] || '',
    senderEmail: raw['sender_email'] || '',
    companyName: raw['company_name'] || '',
    landlordName: raw['landlord_name'] || '',
    landlordPhone: raw['landlord_phone'] || '',
    landlordEmail: raw['landlord_email'] || '',
    smsTemplate: raw['sms_template'] || '[{{지점명}}] 임대차계약서 서명 요청\n{{이름}}님, 계약서 확인 및 서명을 부탁드립니다.\n{{서명링크}}'
  };
}

/**
 * 설정 시트에 특정 설정값을 업데이트
 * @param {string} key - 설정 항목 이름
 * @param {string} value - 설정값
 */
function updateConfig(key, value) {
  var sheet = getSpreadsheet().getSheetByName('설정');
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sheet.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
}

/**
 * 설정 시트 초기 구조를 생성 (최초 1회 실행)
 */
function initSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 웹앱에서 스프레드시트에 접근할 수 있도록 ID를 스크립트 속성에 저장
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  var sheet = ss.getSheetByName('설정');

  if (!sheet) {
    sheet = ss.insertSheet('설정');
  }

  // 헤더 설정
  var headers = [['설정 항목', '설정 값', '설명']];
  sheet.getRange(1, 1, 1, 3).setValues(headers);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');

  // 기본 설정 항목
  var settings = [
    ['template_doc_id', '', '계약서 템플릿 Google Docs 문서 ID'],
    ['output_folder_id', '', '생성된 계약서를 저장할 Google Drive 폴더 ID'],
    ['signature_folder_id', '', '서명 이미지를 저장할 Google Drive 폴더 ID'],
    ['web_app_url', '', '서명 웹앱 배포 URL (배포 후 입력)'],
    ['sender_name', '', '이메일 발신자 이름 (예: 홍길동)'],
    ['sender_email', '', '발신 이메일 주소 (참고용, 실제로는 로그인 계정 사용)'],
    ['company_name', '', '회사명 (선택사항)'],
    ['landlord_name', '', '임대인(갑) 이름'],
    ['landlord_phone', '', '임대인 연락처'],
    ['landlord_email', '', '임대인 이메일'],
    ['sms_template', '[{{지점명}}] 임대차계약서 서명 요청\n{{이름}}님, 계약서 확인 및 서명을 부탁드립니다.\n{{서명링크}}', 'SMS 문자 템플릿 ({{이름}}, {{지점명}}, {{서명링크}} 등 사용 가능)']
  ];
  sheet.getRange(2, 1, settings.length, 3).setValues(settings);

  // 열 너비 조정
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 300);

  SpreadsheetApp.getUi().alert('설정 시트가 생성되었습니다.\n각 항목의 설정 값을 입력해주세요.');
}
