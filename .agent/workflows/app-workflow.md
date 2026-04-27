---
description: Comprehensive SaaS Construction Management Workflow
---

# Construction SaaS Application Workflow

This document outlines the complete user journey and operational flow within the **BuildMaster Pro** application.

## 1. Onboarding & Authentication
1. **Launch App**: User opens the Expo application.
2. **Identity Verification**:
   - Registered users log in with their email/password.
   - New companies navigate to **Register Company** to create a multi-tenant workspace.
3. **Workspace Setup**: Owners upload company logos and define the initial subscription plan.

## 2. Executive Dashboard (The Nerve Center)
1. **Daily Overview**: Upon login, users see real-time stats (Active Projects, Open Issues).
2. **Attendance (Clock In/Out)**: Field staff use the primary clock button to log attendance with GPS verification (UI placeholder).
3. **Activity Feed**: Review latest updates from the team (e.g., "Mike uploaded a new drawing").

## 3. Project Lifecycle Management
1. **Project List**: Browse all commercial projects via the **Projects** tab.
2. **Progress Tracking**: View completion percentages and status badges (In Progress, Completed).
3. **Deep Dive (Project Details)**: Selecting a project opens a 6-tab control center:
   - **Overview**: Billing (Estimates/Invoices), Purchase Orders, and Team assignments.
   - **Schedule**: Execution timeline and task status.
   - **Photos**: Site progress imagery with timestamps and GPS tags.
   - **Drawings**: Version-controlled PDF access for site plans.
   - **Issues**: Reporting and resolving site criticalities.
   - **Chat**: Dedicated project-specific team communication.

## 4. Field Operations & Documentation
1. **Field Upload**: Use the central **Upload** tab for rapid data entry.
2. **Contextual Linking**: Capture photos on-site and link them immediately to a specific **Project** and **Task**.
3. **Offline Sync**: The app indicates "Offline Mode" for remote sites, ensuring data is saved locally and synced when back in range.

## 5. Resource & Profile Management
1. **My Tasks**: A dedicated view for individual assignments.
2. **Profile & Settings**: Manage personal info, notification preferences, and subscription/billing details.
3. **Company Admin**: Owners view company-wide settings and role-based access.

---
// turbo-all
## Automation Commands (For Maintenance)
1. **Start Development**: `npx expo start`
2. **Check Dependencies**: `npx expo install --check`
3. **Clear Cache**: `npx expo start -c`
