/**
 * EmailService.gs - 이메일 발송 모듈
 *
 * 임차인에게 계약서 검토 및 서명 요청 이메일을 발송한다.
 */

/**
 * 지정된 행의 임차인에게 계약서 이메일 발송
 * @param {number} rowNumber - 1-based 행 번호
 */
function sendContractEmail(rowNumber) {
  var config = getConfig();
  var rowData = getRowData(rowNumber);

  // 유효성 검증
  var docId = rowData['계약서_문서ID'];
  if (!docId) {
    throw new Error('계약서가 아직 생성되지 않았습니다. 먼저 계약서를 생성해주세요.');
  }

  var recipientEmail = rowData['이메일'];
  if (!recipientEmail) {
    throw new Error('이메일이 입력되지 않았습니다.');
  }

  // 서명 토큰 생성
  var token = generateSignatureToken(rowNumber);

  var recipientName = rowData['이름'];
  var senderName = config.senderName || config.landlordName;
  var docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';

  // 서명 링크 구성
  var signUrl = '';
  if (config.webAppUrl) {
    signUrl = config.webAppUrl + '?token=' + token;
  }

  var unitInfo = '';
  if (rowData['층'] || rowData['호수']) {
    unitInfo = (rowData['층'] ? rowData['층'] + '층' : '') + (rowData['호수'] ? ' ' + rowData['호수'] + '호' : '');
    unitInfo = unitInfo.trim();
  }

  var subject = '[계약서] ' + rowData['지점명'] + (unitInfo ? ' ' + unitInfo : '') + ' 계약서 검토 및 서명 요청';

  var htmlBody = buildEmailHtml({
    recipientName: recipientName,
    senderName: senderName,
    propertyAddress: rowData['지점명'],
    unitNumber: unitInfo,
    deposit: rowData['보증금'],
    supplyAmount: rowData['공급가액'],
    leaseStart: rowData['시작일'],
    leaseEnd: rowData['종료일'],
    docUrl: docUrl,
    signUrl: signUrl,
    landlordPhone: config.landlordPhone
  });

  // 첨부파일 준비
  var attachments = [];
  if (config.attachmentFileIds) {
    config.attachmentFileIds.split(',').forEach(function(id) {
      id = id.trim();
      if (id) {
        try {
          attachments.push(DriveApp.getFileById(id).getBlob());
        } catch (e) {
          Logger.log('첨부파일 로드 실패 (ID: ' + id + '): ' + e.message);
        }
      }
    });
  }

  // 이메일 발송
  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: senderName,
    attachments: attachments
  });

  // 상태 업데이트
  updateCellValue(rowNumber, '이메일_발송', true);
  updateCellValue(rowNumber, '이메일_발송일', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
  updateCellValue(rowNumber, '서명_토큰', token);
  updateCellValue(rowNumber, '계약_상태', '서명대기');
}

/**
 * 선택된 행의 SMS 문자 텍스트 생성
 * 설정 시트의 sms_template에서 플레이스홀더를 치환하여 반환
 * @param {number} rowNumber - 행 번호
 * @returns {string} SMS 텍스트
 */
function getSmsText(rowNumber) {
  var config = getConfig();
  var rowData = getRowData(rowNumber);

  var token = rowData['서명_토큰'];
  if (!token) {
    throw new Error('서명 토큰이 없습니다. 이메일을 먼저 발송해주세요.');
  }

  var signUrl = config.webAppUrl ? config.webAppUrl + '?token=' + token : '(서명 URL 미설정)';

  var template = config.smsTemplate;
  // 플레이스홀더 치환
  template = template.replace(/\{\{이름\}\}/g, rowData['이름'] || '');
  template = template.replace(/\{\{지점명\}\}/g, rowData['지점명'] || '');
  template = template.replace(/\{\{상호\}\}/g, rowData['상호'] || '');
  template = template.replace(/\{\{층\}\}/g, rowData['층'] || '');
  template = template.replace(/\{\{호수\}\}/g, rowData['호수'] || '');
  template = template.replace(/\{\{보증금\}\}/g, rowData['보증금'] || '');
  template = template.replace(/\{\{공급가액\}\}/g, rowData['공급가액'] || '');
  template = template.replace(/\{\{서명링크\}\}/g, signUrl);

  // 계약서 링크
  var docId = rowData['계약서_문서ID'];
  var contractLink = docId ? 'https://docs.google.com/document/d/' + docId + '/edit' : '(계약서 미생성)';
  template = template.replace(/\{\{계약서_링크\}\}/g, contractLink);

  // \n 문자열을 실제 줄바꿈으로 변환
  template = template.replace(/\\n/g, '\n');

  return template;
}

/**
 * 이메일 HTML 본문 생성
 * @param {Object} data - 이메일 데이터
 * @returns {string} HTML 문자열
 */
function buildEmailHtml(data) {
  return '\
<!DOCTYPE html>\
<html>\
<body style="margin:0; padding:0; background:#f5f5f5;">\
<div style="font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif; max-width:600px; margin:0 auto; padding:20px;">\
  <div style="background:#fff; border-radius:12px; padding:30px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">\
    \
    <h2 style="color:#333; border-bottom:2px solid #4285f4; padding-bottom:12px; margin-top:0;">\
      계약서 검토 및 서명 요청\
    </h2>\
    \
    <p style="font-size:15px; line-height:1.6;">\
      ' + data.recipientName + '님 안녕하세요,<br>\
      ' + data.senderName + '님이 아래 계약서를 보내드립니다.\
    </p>\
    \
    <div style="background:#f8f9fa; padding:16px; border-radius:8px; margin:20px 0; border-left:4px solid #4285f4;">\
      <p style="margin:0 0 6px; font-weight:bold; color:#4285f4;">계약 정보</p>\
      <table style="width:100%; font-size:14px; line-height:1.8;">\
        <tr><td style="color:#666; width:80px;">위치</td><td>' + data.propertyAddress + (data.unitNumber ? ' ' + data.unitNumber : '') + '</td></tr>\
        <tr><td style="color:#666;">보증금</td><td>' + data.deposit + '원</td></tr>\
        <tr><td style="color:#666;">공급가액</td><td>' + data.supplyAmount + '원</td></tr>\
        <tr><td style="color:#666;">계약기간</td><td>' + data.leaseStart + ' ~ ' + data.leaseEnd + '</td></tr>\
      </table>\
    </div>\
    \
    <div style="margin:24px 0;">\
      <p style="font-size:14px; font-weight:bold; color:#333; margin-bottom:10px;">\
        1단계: 계약서를 검토해주세요\
      </p>\
      <a href="' + data.docUrl + '" \
         style="display:inline-block; background:#4285f4; color:#fff; \
                padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:bold;">\
        계약서 검토하기\
      </a>\
    </div>\
    ' + (data.signUrl ? '\
    <div style="margin:24px 0;">\
      <p style="font-size:14px; font-weight:bold; color:#333; margin-bottom:10px;">\
        2단계: 검토 완료 후 서명해주세요\
      </p>\
      <a href="' + data.signUrl + '" \
         style="display:inline-block; background:#34a853; color:#fff; \
                padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:bold;">\
        전자서명하기\
      </a>\
    </div>\
    ' : '') + '\
    \
    <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">\
    \
    <p style="color:#999; font-size:12px; line-height:1.6;">\
      본 메일은 시스템에 의해 자동 발송되었습니다.<br><br>\
      문의사항이 있으시면 아래 연락처로 편하게 연락 주세요.<br><br>\
      공유오피스 MOO 두정역점<br>\
      대표 | ' + data.senderName + '<br>\
      ' + (data.landlordPhone || '') + '\
    </p>\
  </div>\
</div>\
</body>\
</html>';
}

/**
 * 서명 완료 후 임차인에게 완료 안내 이메일 발송
 * @param {number} rowNumber - 행 번호
 */
function sendCompletionEmail(rowNumber) {
  var config = getConfig();
  var rowData = getRowData(rowNumber);

  var recipientEmail = rowData['이메일'];
  if (!recipientEmail) return;

  var recipientName = rowData['이름'];
  var senderName = config.senderName || config.landlordName;
  var docId = rowData['계약서_문서ID'];
  var docUrl = docId ? 'https://docs.google.com/document/d/' + docId + '/edit' : '';

  var unitInfo = '';
  if (rowData['층'] || rowData['호수']) {
    unitInfo = (rowData['층'] ? rowData['층'] + '층' : '') + (rowData['호수'] ? ' ' + rowData['호수'] + '호' : '');
    unitInfo = unitInfo.trim();
  }

  var subject = '[계약서] ' + rowData['지점명'] + (unitInfo ? ' ' + unitInfo : '') + ' 계약서 서명 완료';

  var htmlBody = buildCompletionEmailHtml({
    recipientName: recipientName,
    senderName: senderName,
    propertyAddress: rowData['지점명'],
    unitNumber: unitInfo,
    docUrl: docUrl,
    landlordPhone: config.landlordPhone
  });

  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: senderName
  });

  updateCellValue(rowNumber, '완료이메일_발송일', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'));
}

/**
 * 서명 완료 안내 이메일 HTML 생성
 */
function buildCompletionEmailHtml(data) {
  return '\
<!DOCTYPE html>\
<html>\
<body style="margin:0; padding:0; background:#f5f5f5;">\
<div style="font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif; max-width:600px; margin:0 auto; padding:20px;">\
  <div style="background:#fff; border-radius:12px; padding:30px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">\
    \
    <h2 style="color:#2e7d32; border-bottom:2px solid #4caf50; padding-bottom:12px; margin-top:0;">\
      계약서 서명이 완료되었습니다\
    </h2>\
    \
    <p style="font-size:15px; line-height:1.6;">\
      ' + data.recipientName + '님 안녕하세요,<br>\
      <strong>' + data.propertyAddress + (data.unitNumber ? ' ' + data.unitNumber : '') + '</strong> 계약서의\
      임대인·임차인 서명이 모두 완료되었습니다.\
    </p>\
    \
    <div style="background:#e8f5e9; padding:16px; border-radius:8px; margin:20px 0; text-align:center;">\
      <p style="margin:0; font-size:24px;">&#10004;</p>\
      <p style="margin:8px 0 0; font-weight:bold; color:#2e7d32; font-size:16px;">서명 완료</p>\
    </div>\
    ' + (data.docUrl ? '\
    <div style="margin:24px 0; text-align:center;">\
      <a href="' + data.docUrl + '" \
         style="display:inline-block; background:#4285f4; color:#fff; \
                padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:bold;">\
        완료된 계약서 확인하기\
      </a>\
    </div>\
    ' : '') + '\
    \
    <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">\
    \
    <p style="color:#999; font-size:12px; line-height:1.6;">\
      본 메일은 시스템에 의해 자동 발송되었습니다.<br><br>\
      문의사항이 있으시면 아래 연락처로 편하게 연락 주세요.<br><br>\
      공유오피스 MOO 두정역점<br>\
      대표 | ' + data.senderName + '<br>\
      ' + (data.landlordPhone || '') + '\
    </p>\
  </div>\
</div>\
</body>\
</html>';
}
