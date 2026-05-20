#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android");
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const artifactTypes = new Set(["apk", "bundle"]);
const variants = new Set(["debug", "release"]);
const signingEnv = {
  storeFile: "HEX_SNAKE_ANDROID_KEYSTORE_FILE",
  storePassword: "HEX_SNAKE_ANDROID_KEYSTORE_PASSWORD",
  keyAlias: "HEX_SNAKE_ANDROID_KEY_ALIAS",
  keyPassword: "HEX_SNAKE_ANDROID_KEY_PASSWORD"
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function existingPath(...candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || "";
}

function parseArgs(args) {
  const options = {
    type: "apk",
    variant: "debug",
    requireSigning: false
  };

  for (const arg of args) {
    if (arg.startsWith("--type=")) {
      options.type = arg.slice("--type=".length).toLowerCase();
    } else if (arg.startsWith("--variant=")) {
      options.variant = arg.slice("--variant=".length).toLowerCase();
    } else if (arg === "--require-signing") {
      options.requireSigning = true;
    } else if (artifactTypes.has(arg.toLowerCase())) {
      options.type = arg.toLowerCase();
    } else if (variants.has(arg.toLowerCase())) {
      options.variant = arg.toLowerCase();
    } else {
      fail(`Unknown Android build option: ${arg}`);
    }
  }

  if (!artifactTypes.has(options.type)) fail(`Unsupported artifact type: ${options.type}`);
  if (!variants.has(options.variant)) fail(`Unsupported build variant: ${options.variant}`);
  return options;
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

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function gradleTask({ type, variant }) {
  return `${type === "bundle" ? "bundle" : "assemble"}${capitalize(variant)}`;
}

function artifactExtension(type) {
  return type === "bundle" ? ".aab" : ".apk";
}

function artifactOutputDir({ type, variant }) {
  const bucket = type === "bundle" ? "bundle" : "apk";
  return path.join(androidDir, "app", "build", "outputs", bucket, variant);
}

function newestArtifact(options) {
  const outputDir = artifactOutputDir(options);
  const extension = artifactExtension(options.type);
  if (!fs.existsSync(outputDir)) return "";

  return fs.readdirSync(outputDir)
    .filter(fileName => fileName.endsWith(extension))
    .map(fileName => path.join(outputDir, fileName))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] || "";
}

function parseProperties(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#") && line.includes("="))
    .reduce((props, line) => {
      const index = line.indexOf("=");
      props[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      return props;
    }, {});
}

function resolveSigningStoreFile(storeFile) {
  if (!storeFile) return "";
  return path.isAbsolute(storeFile) ? storeFile : path.join(androidDir, storeFile);
}

function releaseSigningStatus() {
  const propertiesPath = path.join(androidDir, "signing.properties");
  const props = fs.existsSync(propertiesPath)
    ? parseProperties(fs.readFileSync(propertiesPath, "utf8"))
    : {};

  Object.entries(signingEnv).forEach(([key, envName]) => {
    if (process.env[envName]) props[key] = process.env[envName];
  });

  const missing = Object.keys(signingEnv).filter(key => !props[key]);
  const storeFile = resolveSigningStoreFile(props.storeFile);
  const missingStoreFile = props.storeFile && !fs.existsSync(storeFile);
  return {
    ready: missing.length === 0 && !missingStoreFile,
    missing,
    missingStoreFile,
    propertiesPath,
    storeFile
  };
}

function releaseSigningProblem(signingStatus) {
  return [
    signingStatus.missing.length ? `missing ${signingStatus.missing.join(", ")}` : "",
    signingStatus.missingStoreFile ? `keystore not found: ${signingStatus.storeFile}` : ""
  ].filter(Boolean).join("; ");
}

function buildLabel({ type, variant }) {
  const artifactName = type === "bundle" ? "AAB" : "APK";
  return `${variant} ${artifactName}`;
}

function runGradle(task, env) {
  const gradleCommand = process.platform === "win32" ? "cmd.exe" : path.join(androidDir, "gradlew");
  const gradleArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "gradlew.bat", task]
    : [task];
  const result = spawnSync(gradleCommand, gradleArgs, {
    cwd: androidDir,
    env,
    stdio: "inherit",
    shell: false
  });

  if (result.error) fail(`Failed to start Gradle: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
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

  const task = gradleTask(options);
  console.log(`Building Hex Snake Android ${buildLabel(options)} ${packageInfo.version || ""}`.trim());
  console.log(`Gradle task=${task}`);
  console.log(`JAVA_HOME=${javaHome}`);
  console.log(`ANDROID_HOME=${androidSdk}`);

  if (options.variant === "release" && options.requireSigning) {
    const signingStatus = releaseSigningStatus();
    if (!signingStatus.ready) {
      const details = releaseSigningProblem(signingStatus);
      fail(`Release signing is required but not ready${details ? ` (${details})` : ""}. Copy android/signing.properties.example to android/signing.properties or set HEX_SNAKE_ANDROID_* environment variables.`);
    }
  }

  runGradle(task, env);

  const artifactPath = newestArtifact(options);
  if (!artifactPath) {
    fail(`Gradle finished but no ${artifactExtension(options.type)} artifact was found in ${path.relative(root, artifactOutputDir(options))}.`);
  }

  const artifactBytes = fs.statSync(artifactPath).size;
  console.log(`Android ${buildLabel(options)}: ${path.relative(root, artifactPath)} (${formatMb(artifactBytes)})`);

  if (options.variant === "release") {
    const signingStatus = releaseSigningStatus();
    if (signingStatus.ready) {
      console.log(`Release signingConfig is active: ${path.relative(root, signingStatus.storeFile)}`);
    } else {
      if (options.requireSigning) {
        const details = releaseSigningProblem(signingStatus);
        fail(`Release signing is required but not ready${details ? ` (${details})` : ""}. Copy android/signing.properties.example to android/signing.properties or set HEX_SNAKE_ANDROID_* environment variables.`);
      }
      console.warn("Release signingConfig is not configured yet. Configure signing before Play Store upload.");
      console.warn("Use `npm run android:bundle:signed` to require signing credentials for a Play-ready AAB.");
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
