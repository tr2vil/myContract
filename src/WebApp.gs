/**
 * WebApp.gs - 서명 웹앱 핸들러
 *
 * doGet(e)로 외부 접근 가능한 서명 페이지를 제공한다.
 * 토큰 기반 접근 제어를 통해 보안을 유지한다.
 */

/**
 * 웹앱 GET 요청 핸들러
 * @param {Object} e - 이벤트 객체 (parameter에 token 포함)
 * @returns {HtmlOutput} 서명 페이지 또는 오류 페이지
 */
function doGet(e) {
  var token = e.parameter.token;

  // 토큰 없는 접근
  if (!token) {
    return createErrorPage('잘못된 접근입니다.', '유효한 서명 링크를 통해 접근해주세요.');
  }

  // 토큰 검증
  var rowInfo = findRowByToken(token);

  if (!rowInfo) {
    return createErrorPage(
      '유효하지 않은 링크입니다.',
      '링크가 만료되었거나 잘못된 링크입니다. 발송자에게 문의해주세요.'
    );
  }

  if (rowInfo.tenantSigned) {
    return createSuccessPage(rowInfo.tenantName);
  }

  // 서명 페이지 렌더링
  var template = HtmlService.createTemplateFromFile('html/SignaturePage');
  template.token = token;
  template.tenantName = rowInfo.tenantName || '';
  template.propertyAddress = (rowInfo.propertyAddress || '') +
    (rowInfo.unitNumber ? ' ' + rowInfo.unitNumber : '');
  template.isWebApp = true;

  return template.evaluate()
    .setTitle('계약서 전자서명')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 오류 페이지 생성
 * @param {string} title - 오류 제목
 * @param {string} message - 오류 메시지
 * @returns {HtmlOutput}
 */
function createErrorPage(title, message) {
  var html = '\
<!DOCTYPE html>\
<html><head><meta charset="utf-8">\
<meta name="viewport" content="width=device-width, initial-scale=1">\
<style>\
  body { font-family: "Malgun Gothic", sans-serif; display: flex; justify-content: center;\
         align-items: center; min-height: 100vh; background: #f5f5f5; margin: 0; }\
  .card { background: #fff; border-radius: 12px; padding: 40px; text-align: center;\
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }\
  h2 { color: #c62828; margin-bottom: 12px; }\
  p { color: #666; line-height: 1.6; }\
</style></head><body>\
<div class="card">\
  <h2>' + title + '</h2>\
  <p>' + message + '</p>\
</div>\
</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('오류')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 서명 완료 페이지 생성
 * @param {string} name - 서명자 이름
 * @returns {HtmlOutput}
 */
function createSuccessPage(name) {
  var html = '\
<!DOCTYPE html>\
<html><head><meta charset="utf-8">\
<meta name="viewport" content="width=device-width, initial-scale=1">\
<style>\
  body { font-family: "Malgun Gothic", sans-serif; display: flex; justify-content: center;\
         align-items: center; min-height: 100vh; background: #f5f5f5; margin: 0; }\
  .card { background: #fff; border-radius: 12px; padding: 40px; text-align: center;\
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }\
  .icon { font-size: 48px; margin-bottom: 16px; }\
  h2 { color: #2e7d32; margin-bottom: 12px; }\
  p { color: #666; line-height: 1.6; }\
</style></head><body>\
<div class="card">\
  <div class="icon">&#10004;</div>\
  <h2>서명이 완료되었습니다</h2>\
  <p>' + (name || '') + '님의 서명이 이미 처리되었습니다.<br>감사합니다.</p>\
</div>\
</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('서명 완료')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
