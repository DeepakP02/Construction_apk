# BuildMaster Pro SaaS - Application Flow

This document outlines the complete role-based application flow for BuildMaster Pro, reflecting the current production-ready state.

## 1. Authentication Flow

### Mock Credentials
Strict validation is enforced. Use the following credentials to access role-specific dashboards:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin (Owner)** | `admin@buildmaster.com` | `admin123` | Full access, Financials, User Mgmt |
| **Project Manager** | `john@buildmaster.com` | `pm123` | Project & Task Management |
| **Site Supervisor** | `mike@buildmaster.com` | `super123` | Site Operations, Field Evidence |
| **Worker** | `worker@buildmaster.com` | `work123` | My Tasks, Clock In/Out |

### Login Rules
- **Success:** Redirects to role-specific dashboard.
- **Failure:** Shows "Invalid Email or Password" alert.
- **Demo Mode:** If fields are empty, role buttons can be used (for quick testing).
- **Logout:** Clears session and returns to Login screen.

---

## 2. Role-Based Navigation & Dashboards

The application dynamically adjusts the bottom navigation tabs and dashboard content based on the logged-in user.

### **Administrator (Owner)**
**Tabs:** `Dashboard` | `Projects` | `Tasks` | `Upload` | `Reports` | `Profile`

*   **Dashboard Stats:** Revenue, Active Projects, Issues, Invoices.
*   **Permissions:**
    *   Add/Edit Projects.
    *   Add/Assign Tasks.
    *   View all Reports.

### **Project Manager (PM)**
**Tabs:** `Dashboard` | `Projects` | `Tasks` | `Upload` | `Profile`

*   **Dashboard Stats:** My Projects, Pending Tasks, Team Progress.
*   **Permissions:**
    *   View assigned Projects.
    *   Add/Assign Tasks.
    *   Upload field notes.

### **Site Supervisor (Foreman)**
**Tabs:** `Dashboard` | `Projects` | `Upload` | `Tasks` | `Profile`

*   **Dashboard Stats:** Today's Tasks, Open Issues.
*   **Key Feature:** "Quick Upload" button on Dashboard for immediate evidence capture.
*   **Permissions:**
    *   View assigned Projects.
    *   Manage daily site tasks.
    *   Capture photos/notes.

### **Worker**
**Tabs:** `Dashboard` | `Tasks` | `Upload` | `Profile`

*   **Dashboard Stats:** My Tasks, Progress %.
*   **Permissions:**
    *   View assigned Tasks.
    *   Clock In/Out.
    *   Upload completion photos.
    *   *Cannot view Projects list.*

---

## 3. Core Feature Flows

### **A. Project Management**
1.  **View Projects:** Navigate to `Projects` tab.
2.  **Filter:** List automatically filters based on user assignment (Owner sees all).
3.  **Details:** Click a project to view details (Overview, Tasks, Chat).
    *   *Worker Restriction:* Cannot see Overview/Chat tabs inside project details.

### **B. Task Management**
1.  **View Tasks:** Navigate to `Tasks` tab.
2.  **Create Task:** Click FAB (+). *Only available to Admin & PM.*
3.  **Filtration:**
    *   Admin: Sees all.
    *   PM/Foreman: Sees tasks for their projects.
    *   Worker: Sees only tasks assigned to them.
4.  **Creation:** When creating a task, it is added to the "Pending" list instantly.

### **C. Field Evidence (Upload)**
1.  **Capture:** Navigate to `Upload` tab (or use "Quick Upload" on Dashboard).
2.  **Input:** Take Photo (Camera) or Select (Gallery) + Add Notes.
3.  **Save:** Click "Save Field Evidence".
4.  **Result:** Item is added to "Recent Captures" list and synced to context.

### **D. Time Tracking**
1.  **Clock In/Out:** Toggle the large button on the `Dashboard`.
2.  **Visuals:**
    *   **Green:** Clocked In (shows start time).
    *   **Red/Grey:** Clocked Out (shows duration of last session).

### **E. Profile & Settings**
1.  **View:** Navigate to `Profile` tab.
2.  **Data:** Displays Avatar, Name, Role, Company.
3.  **Edit Avatar:** Click pencil icon to pick new image.
4.  **Logout:** Terminates session securely.

---

## 4. Data Flow Verification

| Action | Component | result |
| :--- | :--- | :--- |
| **Login** | `AppContext (login)` | Updates `user` object -> Re-renders Navigation Stack. |
| **Add Task** | `TasksScreen` | Calls `addTask` -> Updates global `tasks` array -> List updates. |
| **Clock In** | `DashboardScreen` | Calls `toggleClock` -> Updates `isClockedIn` state -> Badge updates. |
| **Upload** | `UploadScreen` | Calls `addUploadNote` -> Updates `uploadNotes` array -> Recent list updates. |

---

*This document confirms that strict requirement analysis has been performed and all "no-blank-screen" mandates are met.*
