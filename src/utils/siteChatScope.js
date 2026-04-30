import { useApp } from '../context/AppContext';

/**
 * Robust string ID extractor for MongoDB objects or strings.
 */
function strId(x) {
    if (x == null) return '';
    if (typeof x === 'string') return x.trim();
    if (typeof x === 'object') {
        const i = x._id || x.id;
        if (i) return String(i).trim();
        if (x.fullName) return String(x.fullName).trim();
        if (x.name) return String(x.name).trim();
        return '';
    }
    return String(x).trim();
}

/**
 * Checks if a project is officially managed by a user (PM role).
 */
export function isUserPmOfProject(project, user) {
    if (!project || !user) return false;
    
    const uid = strId(user);
    if (!uid) return false;

    // Check pmId field (could be object or string)
    const rawPm = project.pmId;
    if (rawPm) {
        const id = strId(rawPm);
        if (id && id === uid) return true;
    }
    
    // Fallback: Check projectManager field (could be name or ID)
    const pm = project.projectManager || project.manager;
    if (pm && typeof pm === 'object') {
        if (strId(pm) === uid) return true;
    }
    if (pm && typeof pm === 'string') {
        const uname = (user.fullName || user.name || '').toLowerCase();
        if (pm.toLowerCase() === uname) return true;
    }

    return false;
}

/**
 * Gets a Set of all project IDs where the user is the PM.
 */
export function getManagedProjectIdsForPm(projects, user) {
    const set = new Set();
    if (user?.role !== 'PM' && user?.role !== 'ADMIN' && user?.role !== 'COMPANY_OWNER') return set;
    
    (projects || []).forEach((p) => {
        if (isUserPmOfProject(p, user)) {
            set.add(strId(p));
        }
    });
    return set;
}

/**
 * Collects unique User IDs from project records.
 */
function collectUserIdsFromProjectRecord(project) {
    const out = new Set();
    const add = (v) => {
        if (v == null) return;
        if (Array.isArray(v)) {
            v.forEach((x) => add(x));
            return;
        }
        const id = strId(v);
        if (id) out.add(id);
    };

    add(project.assignedTo);
    add(project.teamMembers);
    add(project.stakeholders);
    add(project.projectManagerId);
    add(project.pmId);
    
    return out;
}

/**
 * Collects unique User IDs assigned to jobs or tasks within specific projects.
 */
function collectAssigneeUserIdsOnProjects(jobs, tasks, projectIdSet) {
    const out = new Set();
    const add = (v) => {
        if (v == null) return;
        if (Array.isArray(v)) {
            v.forEach((x) => add(x));
            return;
        }
        const id = strId(v);
        if (id) out.add(id);
    };

    (jobs || []).forEach((j) => {
        // Robust project ID resolution
        const pid = strId(j.projectId?._id || j.projectId || j.project || j.rootProjectId);
        if (!pid || !projectIdSet.has(pid)) return;
        
        add(j.assignedTo);
        add(j.leadWorkerId); // Check leadWorkerId as well
        add(j.workerId);
        add(j.foremanId);
        add(j.subcontractorId);
    });
    (tasks || []).forEach((t) => {
        const pid = strId(t.projectId?._id || t.projectId || t.project || t.rootProjectId);
        if (!pid || !projectIdSet.has(pid)) return;
        
        add(t.assignedTo);
        add(t.workerId);
        add(t.foremanId);
    });
    return out;
}

/**
 * Collects everyone who is a stakeholder on managed projects.
 */
function collectStakeholderUserIdsOnManagedProjects(projects, managedProjectIds) {
    const out = new Set();
    (projects || []).forEach((p) => {
        if (managedProjectIds.has(strId(p))) {
            collectUserIdsFromProjectRecord(p).forEach((id) => out.add(id));
        }
    });
    return out;
}

/**
 * Main Direct-Message scoping logic for PMs.
 */
export function getAllowedDmPeerIdsForPm(projects, jobs, tasks, user) {
    if (user?.role !== 'PM') return null;
    
    const uid = strId(user);
    const uname = (user?.fullName || user?.name || '').toLowerCase();
    
    // 1. Get projects where PM is explicitly assigned
    const managed = getManagedProjectIdsForPm(projects, user);
    
    // 2. Dynamic discovery: Include projects where PM has assigned jobs
    (jobs || []).forEach(j => {
        const jpm = (j.projectManager || '').toLowerCase();
        const jpmId = strId(j.projectManagerId || j.pmId);
        if ((jpm && jpm === uname) || (jpmId && jpmId === uid)) {
            const pid = strId(j.projectId?._id || j.projectId || j.project);
            if (pid) managed.add(pid);
        }
    });

    if (managed.size === 0) return new Set();

    // 3. Collect everyone assigned to these projects
    const fromWork = collectAssigneeUserIdsOnProjects(jobs, tasks, managed);
    const fromProjects = collectStakeholderUserIdsOnManagedProjects(projects, managed);
    
    return new Set([...fromWork, ...fromProjects]);
}

/**
 * Internal staff direct-message peers (Worker, Subcontractor, Foreman).
 * They only see other internal members based on strict role-based site rules.
 */
export function getAllowedDmPeerIdsForInternalStaff(projects, jobs, tasks, user, teamMembers) {
    const role = user?.role;
    if (['PM', 'ADMIN', 'COMPANY_OWNER'].includes(role)) return null;

    const uid = strId(user);
    if (!uid) return new Set();

    const myProjects = new Set();
    const checkAssignment = (v) => {
        if (!v) return false;
        if (Array.isArray(v)) return v.some(x => strId(x) === uid);
        return strId(v) === uid;
    };

    (jobs || []).forEach(j => {
        if (checkAssignment(j.assignedTo)) {
            const pid = strId(j.projectId?._id || j.projectId || j.project);
            if (pid) myProjects.add(pid);
        }
    });
    (tasks || []).forEach(t => {
        if (checkAssignment(t.assignedTo)) {
            const pid = strId(t.projectId?._id || t.projectId || t.project);
            if (pid) myProjects.add(pid);
        }
    });

    const peerIds = new Set();
    const known = new Map((teamMembers || []).map((m) => [strId(m), m]));
    const myRole = user?.role;

    const addIfAllowed = (uId) => {
        const sid = strId(uId);
        if (!sid || sid === uid) return;
        const m = known.get(sid);
        if (!m) {
            // Default to allowing potential PMs
            peerIds.add(sid);
            return;
        }

        const targetRole = m.role;
        if (myRole === 'FOREMAN' || myRole === 'SUBCONTRACTOR') {
            // Foreman/Subcontractor: see PMs and Workers
            if (['PM', 'ADMIN', 'COMPANY_OWNER', 'WORKER'].includes(targetRole)) peerIds.add(sid);
        } else if (myRole === 'WORKER') {
            // Worker: see PMs
            if (['PM', 'ADMIN', 'COMPANY_OWNER'].includes(targetRole)) peerIds.add(sid);
        }
    };

    (jobs || []).forEach(j => {
        if (myProjects.has(strId(j.projectId?._id || j.projectId || j.project))) {
            addIfAllowed(j.assignedTo);
            addIfAllowed(j.workerId);
            addIfAllowed(j.leadWorkerId);
            addIfAllowed(j.foremanId);
        }
    });
    (tasks || []).forEach(t => {
        if (myProjects.has(strId(t.projectId?._id || t.projectId || t.project))) {
            addIfAllowed(t.assignedTo);
            addIfAllowed(t.workerId);
            addIfAllowed(t.foremanId);
        }
    });
    (projects || []).forEach(p => {
        if (myProjects.has(strId(p))) {
            addIfAllowed(p.pmId);
            addIfAllowed(p.projectManagerId);
            if (p.projectManager && typeof p.projectManager === 'object') addIfAllowed(p.projectManager);
        }
    });

    return { projectIds: myProjects, peerIds: peerIds };
}

/**
 * PM direct-message peers for a single managed project.
 */
export function getDmPeerIdsForPmScopedToProject(projects, jobs, tasks, user, projectId) {
    if (user?.role !== 'PM') return null;
    const key = strId(projectId);
    const one = new Set([key]);

    const fromWork = collectAssigneeUserIdsOnProjects(jobs, tasks, one);
    const fromProjects = collectStakeholderUserIdsOnManagedProjects(projects, one);
    
    return new Set([...fromWork, ...fromProjects]);
}
