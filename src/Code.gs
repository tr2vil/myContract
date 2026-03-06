/**
 * Code.gs - 메인 진입점
 *
 * 스프레드시트 열 때 커스텀 메뉴를 추가하고,
 * 사이드바 및 설정 UI를 제공하는 핵심 모듈
 */

/**
 * 스프레드시트를 열 때 실행 - 커스텀 메뉴 추가
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('계약 관리')
    .addItem('선택한 행 작업 (사이드바)', 'openSidebar')
    .addSeparator()
    .addItem('시트 초기 설정', 'initializeSheets')
    .addItem('설정 열기', 'openSettingsSheet')
    .addToUi();
}

/**
 * 사이드바 열기
 */
function openSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('html/Sidebar')
    .setTitle('계약서 작업')
    .setWidth(350);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 설정 시트로 이동
 */
function openSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('설정');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('설정 시트가 없습니다. "시트 초기 설정"을 먼저 실행해주세요.');
    return;
  }
  ss.setActiveSheet(sheet);
}

/**
 * 시트 초기 설정 (계약목록 + 설정 시트 생성)
 */
function initializeSheets() {
  var ui = SpreadsheetApp.getUi();

  // 1차 경고
  var response = ui.alert(
    '⚠️ 시트 초기 설정 - 주의',
    '이 작업을 실행하면 계약목록 시트와 설정 시트가 삭제 후 재생성됩니다.\n\n'
    + '⚠️ 기존에 입력된 모든 계약 데이터가 영구 삭제됩니다.\n'
    + '⚠️ 설정 값도 모두 초기화됩니다.\n\n'
    + '정말 계속하시겠습니까?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  // 2차 최종 확인
  var finalConfirm = ui.prompt(
    '🚨 최종 확인',
    '되돌릴 수 없습니다. 계속하려면 "초기화" 를 입력하세요.',
    ui.ButtonSet.OK_CANCEL
  );
  if (finalConfirm.getSelectedButton() !== ui.Button.OK || finalConfirm.getResponseText().trim() !== '초기화') {
    ui.alert('초기 설정이 취소되었습니다.');
    return;
  }

  initContractSheet();
  initSettingsSheet();

  // 기본 시트(시트1 등) 삭제
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name !== '계약목록' && name !== '설정') {
      ss.deleteSheet(sheets[i]);
    }
  }

  // 탭 순서: 설정(1번) → 계약목록(2번)
  ss.setActiveSheet(ss.getSheetByName('설정'));
  ss.moveActiveSheet(1);
  ss.setActiveSheet(ss.getSheetByName('계약목록'));
  ss.moveActiveSheet(2);

  ui.alert('초기 설정이 완료되었습니다!\n\n다음 단계:\n1. 설정 시트에서 템플릿 문서 ID 등을 입력하세요.\n2. 계약목록 시트에서 계약 데이터를 입력하세요.');
}

/**
 * HTML 파일 인클루드 (CSS/JS 분리 시 사용)
 * @param {string} filename - 포함할 HTML 파일명
 * @returns {string} HTML 내용
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
