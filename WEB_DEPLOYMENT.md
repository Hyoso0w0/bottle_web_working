# 웹 배포 가이드

이 앱을 웹페이지로 배포하는 방법입니다.

## 🚀 빠른 시작

### 개발 모드로 웹 실행
```bash
npm run web
```
또는
```bash
npx expo start --web
```

브라우저에서 `http://localhost:8081` (또는 표시된 포트)로 접속하면 됩니다.

## 📦 정적 웹사이트 빌드

### 1. 웹 빌드 생성
```bash
npm run build:web
```
또는
```bash
npx expo export:web
```

이 명령어는 `web-build` 폴더에 정적 웹사이트 파일들을 생성합니다.

### 2. 로컬에서 빌드된 파일 테스트
```bash
npm run serve:web
```
또는
```bash
npx serve web-build
```

## 🌐 웹 호스팅 배포

### Netlify 배포
1. Netlify에 가입/로그인
2. "Add new site" → "Deploy manually"
3. `web-build` 폴더를 드래그 앤 드롭
4. 배포 완료!

### Vercel 배포
```bash
# Vercel CLI 설치 (한 번만)
npm i -g vercel

# 배포
cd web-build
vercel
```

### GitHub Pages 배포
1. `web-build` 폴더의 내용을 `gh-pages` 브랜치에 푸시
2. GitHub 저장소 설정에서 Pages 활성화
3. `gh-pages` 브랜치 선택

### Firebase Hosting 배포
```bash
# Firebase CLI 설치 (한 번만)
npm i -g firebase-tools

# Firebase 프로젝트 초기화
firebase init hosting

# 배포
firebase deploy --only hosting
```

## 📱 웹 앱 특징

- **반응형 디자인**: 모바일과 데스크톱 모두 지원
- **모바일 앱 스타일**: 데스크톱에서도 모바일 앱처럼 보임 (최대 너비 414px)
- **PWA 지원**: 앱처럼 설치 가능 (준비됨)
- **오프라인 지원**: 정적 파일로 빌드되어 빠른 로딩

## ⚠️ 웹에서 제한된 기능

다음 기능들은 웹에서 완전히 작동하지 않을 수 있습니다:

- **푸시 알림**: 웹에서는 브라우저 알림 API를 사용해야 함
- **네이티브 모듈**: 일부 네이티브 전용 기능은 웹에서 사용 불가

## 🔧 문제 해결

### 빌드 오류 발생 시
```bash
# 캐시 클리어 후 재빌드
npx expo export:web --clear
```

### 웹에서 스타일이 깨질 때
- `web/index.html`의 CSS가 올바르게 적용되었는지 확인
- 브라우저 개발자 도구에서 콘솔 오류 확인

### Firebase 인증이 작동하지 않을 때
- Firebase 콘솔에서 웹 도메인을 승인된 도메인에 추가
- `firebase.js`의 설정 확인

## 📝 참고사항

- 웹 빌드는 정적 파일이므로 서버 사이드 렌더링이 필요 없습니다
- 모든 라우팅은 클라이언트 사이드에서 처리됩니다
- Firebase는 클라이언트 사이드에서 작동하므로 별도 설정 불필요

