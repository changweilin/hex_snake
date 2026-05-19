#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function existingPath(...candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || "";
}

function androidSdkCandidates() {
  return [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    "C:\\tmp\\android-sdk",
    "C:\\Users\\user\\AppData\\Local\\Android\\Sdk",
    "C:\\Program Files (x86)\\Android\\android-sdk"
  ].filter(Boolean);
}

function hasAndroidPlatform(sdkPath, apiLevel) {
  return fs.existsSync(path.join(sdkPath, "platforms", `android-${apiLevel}`));
}

function resolveAndroidSdk() {
  const candidates = androidSdkCandidates();
  return candidates.find(candidate => fs.existsSync(candidate) && hasAndroidPlatform(candidate, 36))
    || candidates.find(candidate => fs.existsSync(candidate))
    || "";
}

function resolveJavaHome() {
  return existingPath(
    process.env.JAVA_HOME,
    "C:\\Program Files\\Android\\Android Studio\\jbr"
  );
}

function localPropertiesValue(filePath) {
  return filePath.replace(/\\/g, "\\\\");
}

function writeLocalProperties(sdkPath) {
  fs.writeFileSync(
    path.join(androidDir, "local.properties"),
    `sdk.dir=${localPropertiesValue(sdkPath)}\n`,
    "utf8"
  );
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function assertAndroidProject() {
  if (!fs.existsSync(androidDir)) fail("android/ is missing. Run `npx cap add android` first.");
  if (!fs.existsSync(path.join(androidDir, "gradlew.bat"))) fail("android/gradlew.bat is missing.");
}

function main() {
  assertAndroidProject();

  const javaHome = resolveJavaHome();
  if (!javaHome) fail("JAVA_HOME is not set and Android Studio JBR was not found.");

  const androidSdk = resolveAndroidSdk();
  if (!androidSdk) fail("ANDROID_HOME is not set and no Android SDK was found.");
  if (!hasAndroidPlatform(androidSdk, 36)) {
    fail(`Android SDK Platform 36 is missing in ${androidSdk}. Install it with sdkmanager before building.`);
  }

  writeLocalProperties(androidSdk);

  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk
  };

  console.log(`Building Hex Snake Android debug APK ${packageInfo.version || ""}`.trim());
  console.log(`JAVA_HOME=${javaHome}`);
  console.log(`ANDROID_HOME=${androidSdk}`);

  const gradleCommand = process.platform === "win32" ? "cmd.exe" : path.join(androidDir, "gradlew");
  const gradleArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "gradlew.bat", "assembleDebug"]
    : ["assembleDebug"];
  const result = spawnSync(gradleCommand, gradleArgs, {
    cwd: androidDir,
    env,
    stdio: "inherit",
    shell: false
  });

  if (result.error) fail(`Failed to start Gradle: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);

  const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  if (!fs.existsSync(apkPath)) fail("Gradle finished but app-debug.apk was not found.");
  const apkBytes = fs.statSync(apkPath).size;
  console.log(`Android debug APK: ${path.relative(root, apkPath)} (${formatMb(apkBytes)})`);
}

main();
