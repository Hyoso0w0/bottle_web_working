# Developer Build 실행 가이드

## 방법 1: EAS Build로 원격 빌드 (권장)

### 1단계: 개발 빌드 생성
```bash
# Android 개발 빌드 생성
npx eas-cli build --profile development --platform android

# 또는 iOS 개발 빌드 생성
npx eas-cli build --profile development --platform ios
```

### 2단계: 빌드 완료 후 APK 다운로드
- 빌드가 완료되면 EAS 대시보드에서 APK 다운로드 링크 제공
- 또는 터미널에 표시된 다운로드 링크 사용

### 3단계: 기기에 설치
```bash
# Android: USB로 연결 후
adb install path/to/your-app.apk

# 또는 기기에서 직접 다운로드하여 설치
```

### 4단계: Metro Bundler 실행
```bash
npx expo start --dev-client
```

### 5단계: 앱 연결
- 앱 실행 후 QR 코드 스캔
- 또는 앱에서 "Enter URL manually" 선택 후 터미널에 표시된 URL 입력

---

## 방법 2: 로컬에서 빌드 (더 빠름, 네이티브 코드 수정 시 유용)

### 1단계: 네이티브 프로젝트 생성 (한 번만)
```bash
npx expo prebuild
```

### 2단계: Android 개발 빌드 실행
```bash
npx expo run:android
```

이 명령어는:
- 네이티브 프로젝트를 빌드
- 에뮬레이터 또는 연결된 기기에 자동 설치
- Metro bundler 자동 시작

### 3단계: 앱 실행
- 에뮬레이터가 자동으로 실행되거나
- USB로 연결된 기기에 자동 설치됨

---

## 문제 해결

### "No apps connected" 오류
1. Metro bundler가 실행 중인지 확인
2. 같은 Wi-Fi 네트워크에 연결되어 있는지 확인
3. Tunnel 모드 사용:
   ```bash
   npx expo start --dev-client --tunnel
   ```

### USB 연결 (Android)
```bash
# USB로 기기 연결 후
adb reverse tcp:8081 tcp:8081
# 앱에서 exp://localhost:8081 입력
```

### 기존 빌드가 있는 경우
- 이미 개발 빌드가 설치되어 있다면:
  1. `npx expo start --dev-client` 실행
  2. 앱에서 QR 코드 스캔 또는 URL 입력

---

## 코드 수정 시 반영 여부

### ✅ 자동 반영 (Hot Reload)
다음 항목들은 **코드 저장 시 자동으로 반영**됩니다:
- **JavaScript/TypeScript 코드** (`.js`, `.jsx`, `.ts`, `.tsx`)
  - 예: `App.js`, `HomeScreen.js`, `NotificationsScreen.js` 등
- **스타일 변경** (`StyleSheet`, CSS 등)
- **상태 관리 로직**
- **컴포넌트 구조 변경**

**동작 방식:**
- 파일 저장 시 자동으로 앱이 새로고침됨 (Fast Refresh)
- 앱을 다시 빌드할 필요 없음
- Metro bundler가 실행 중이어야 함

### ❌ 다시 빌드 필요
다음 항목들은 **새로운 빌드가 필요**합니다:
- **네이티브 모듈 추가/변경**
  - 예: 새로운 `expo-*` 패키지 추가 (`expo-notifications`, `expo-camera` 등)
- **app.json 설정 변경**
  - 예: `permissions`, `plugins`, `package` 등
- **네이티브 코드 수정** (Android/iOS)
- **의존성 추가** (`package.json`에 새 패키지 추가 후)

**재빌드 방법:**
```bash
# 방법 1: 로컬 빌드 (빠름)
npx expo run:android

# 방법 2: EAS Build (원격)
npx eas-cli build --profile development --platform android
```

### 📝 예시
```javascript
// ✅ 자동 반영: App.js 수정
export default function App() {
  return <Text>Hello World</Text>; // 저장하면 바로 반영
}

// ✅ 자동 반영: 스타일 변경
const styles = StyleSheet.create({
  container: { backgroundColor: 'red' } // 저장하면 바로 반영
});

// ❌ 재빌드 필요: package.json에 새 패키지 추가
{
  "dependencies": {
    "expo-camera": "~15.0.0" // 추가 후 재빌드 필요
  }
}
```

### 💡 팁
- 대부분의 개발 작업은 **자동 반영**됩니다
- 네이티브 모듈을 추가할 때만 재빌드하면 됩니다
- 개발 중에는 Metro bundler를 계속 실행해두세요

