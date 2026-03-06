---
name: deploy
description: GAS 코드를 push하고 웹앱 배포를 업데이트합니다. Use when user wants to deploy code changes.
disable-model-invocation: true
allowed-tools: Bash
argument-hint: [배포 설명]
---

# GAS 배포

코드를 Apps Script에 push하고, 웹앱 프로덕션 배포를 업데이트합니다.

## 배포 설명

$ARGUMENTS

## 단계

1. `npm run push` 실행 (clasp push --force)
2. push 성공 시, 웹앱 배포 업데이트 실행:
   ```
   npx clasp deploy -i AKfycbwVVuSZTFV7Hm5ujKKvxm5YTfBBZgzdLh-PGtRQ5Fah9zm3Op7rr5PUQLGvrD1Unfq- -d "배포 설명"
   ```
   - 배포 설명은 `$ARGUMENTS`를 사용. 인자가 없으면 현재 날짜(yyyy-MM-dd)로 대체.
3. 완료 후 결과를 사용자에게 알려줌.

## 주의사항

- push 실패 시 deploy를 진행하지 않는다.
- 배포 ID는 고정값: `AKfycbwVVuSZTFV7Hm5ujKKvxm5YTfBBZgzdLh-PGtRQ5Fah9zm3Op7rr5PUQLGvrD1Unfq-`
