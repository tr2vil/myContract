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
  var response = ui.alert(
    '시트 초기 설정',
    '계약목록 시트와 설정 시트를 생성합니다.\n기존 시트가 있으면 건너뜁니다.\n\n계속하시겠습니까?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  initContractSheet();
  initSettingsSheet();

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
