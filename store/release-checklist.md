# Hex Snake Store Release Checklist

更新日期：2026-05-20

## 已完成

- [x] Web / PWA release check 通過。
- [x] Mobile build 使用同一份遊戲核心與 `dist`。
- [x] Capacitor Android / iOS 專案已建立。
- [x] Android debug APK 可產出。
- [x] Android release AAB 可產出。
- [x] Mobile platform adapter 測試覆蓋 lifecycle、返回鍵、Haptics 與 Preferences mirror。
- [x] 商店描述草稿已建立。
- [x] 隱私政策草稿已建立。

## Android 待辦

- [ ] Android 實機安裝 debug APK。
- [ ] 實機確認 Android 返回鍵、背景暫停 / 恢復、震動與音效 unlock。
- [ ] 設定正式 signing keystore 或 Play App Signing 流程。
- [ ] 產出可上傳 Google Play 的 signed release AAB。
- [ ] 建立 Google Play internal testing。
- [ ] 完成 Google Play 內容分級、資料安全與商店截圖。

## iOS 待辦

- [ ] 在 macOS / Xcode 環境執行 iOS build。
- [ ] 設定 Apple signing / provisioning。
- [ ] 建立 TestFlight build。
- [ ] 實機確認安全區、瀏海、背景恢復、音效 unlock 與觸控操作。
- [ ] 完成 App Store 截圖、年齡分級與隱私欄位。

## 發布前總檢

- [x] `npm run release:check`
- [x] `npm run android:build:debug`
- [x] `npm run android:bundle:release`
- [x] `npm run store:check`
- [ ] 實機長時間遊玩與低階 Android 效能觀察。

備註：2026-05-20 本機總檢通過；debug APK 位於 `android/app/build/outputs/apk/debug/app-debug.apk`，release AAB 位於 `android/app/build/outputs/bundle/release/app-release.aab`。release signingConfig 尚未設定，仍需完成正式簽章後才能上傳 Play Store。
