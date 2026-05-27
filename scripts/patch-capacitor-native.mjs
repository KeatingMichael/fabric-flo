#!/usr/bin/env node
/** Adds camera permission strings after `npx cap add` / `cap sync`. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cameraReason =
  "Fabric Flo uses the camera to scan QR codes on fabric and bag labels. Video is not recorded or uploaded.";

const plistPath = join(root, "ios", "App", "App", "Info.plist");
if (existsSync(plistPath)) {
  let xml = readFileSync(plistPath, "utf8");
  if (!xml.includes("NSCameraUsageDescription")) {
    xml = xml.replace(
      "</dict>",
      `  <key>NSCameraUsageDescription</key>\n  <string>${cameraReason}</string>\n</dict>`
    );
    writeFileSync(plistPath, xml);
    console.log("Patched iOS Info.plist (camera)");
  }
}

const manifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (existsSync(manifestPath)) {
  let xml = readFileSync(manifestPath, "utf8");
  if (!xml.includes("android.permission.CAMERA")) {
    xml = xml.replace(
      "<manifest",
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"'
    );
    if (!xml.includes('xmlns:android')) {
      /* already has xmlns from cap */
    }
    xml = xml.replace(
      "<application",
      '  <uses-permission android:name="android.permission.CAMERA" />\n  <uses-permission android:name="android.permission.INTERNET" />\n\n  <application'
    );
    writeFileSync(manifestPath, xml);
    console.log("Patched AndroidManifest.xml (camera + internet)");
  }
}
