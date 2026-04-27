# BuildMaster PRO — APK Build Guide

## ✅ All Code Changes Complete
The following has been fully updated:
- Login screen with correct roles (Company Owner, PM, Foreman, Worker, Subcontractor)
- Dark premium native UI (no web-view look)
- Role-based drawer navigation matching web system
- All modules with API integration

---

## 📱 Build APK — Step by Step

### Step 1: Login to Expo (one-time setup)
Open terminal in the `custruction_app` folder and run:
```
npx eas-cli login
```
Then enter your Expo account email + password.
> If you don't have an Expo account, go to: https://expo.dev/signup

### Step 2: Build the APK
```
npx eas-cli build --platform android --profile preview
```
This uploads code to Expo's cloud servers and builds a `.apk` file.
Build takes ~10-15 minutes.

### Step 3: Download the APK
When done, EAS will show a download link like:
```
✓ Build finished. Artifact URL: https://expo.dev/artifacts/eas/...apk
```
Download and install on any Android device.

---

## 🔧 App Configuration Summary
- **App Name**: BuildMaster PRO
- **Package**: com.buildmaster.pro
- **Version**: 2.1.0
- **Build Type**: APK (sideloadable, no Play Store required)

## 👥 Role-Based Access (Web-Aligned)
| Role | Menu Access |
|------|------------|
| COMPANY_OWNER | All menus (Dashboard, Projects, Jobs, Equipment, Daily Logs, RFI, Chat, POs, Invoices, Payroll, Reports, Settings) |
| PM | Dashboard, Projects, Jobs, Equipment, Daily Logs, RFI, Chat, POs, Invoices, Settings |
| FOREMAN | Dashboard, Projects, Jobs, Equipment, Daily Logs, RFI, Chat, Settings |
| SUBCONTRACTOR | Dashboard, Projects, Jobs, Equipment, Daily Logs, RFI, Chat, Settings |
| WORKER | Dashboard, Projects, Jobs, Daily Logs, Chat, Settings |
