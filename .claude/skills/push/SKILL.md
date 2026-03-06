---
name: push
description: GAS 코드를 Apps Script에 push합니다 (웹앱 배포 없이 HEAD만 업데이트). Use when user wants to push code only.
disable-model-invocation: true
allowed-tools: Bash
---

# GAS Push

코드를 Apps Script에 업로드합니다 (HEAD만 업데이트, 웹앱 배포 없음).

## 단계

1. `npm run push` 실행 (clasp push --force)
2. 결과를 사용자에게 알려줌.

## 참고

- 스프레드시트 기능(사이드바, 메뉴)은 push만으로 반영됨.
- 웹앱(서명 페이지 등) 변경 시에는 `/deploy` 명령어를 사용할 것.
