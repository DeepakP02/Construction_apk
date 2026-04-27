/**
 * Site Communications: scope for Project Manager role.
 * A PM only sees their managed projects, and DMs with users assigned on those projects (from jobs/tasks).
 */

function strId(x) {
    if (x == null) return '';
    if (typeof x === 'object') {
        const i = x._id || x.id;
        if (i) return String(i);
        if (x.fullName) return String(x.fullName);
        if (x.name) return String(x.name);
        return '';
    }
    return String(x);
}

/**
 * @returns {boolean} True if the user is the PM of this project (by pmId, embedded projectManager, or name).
 */
export function isUserPmOfProject(project, user) {
    if (!project || !user) return false;
    if (user.role !== 'PM') return false;
    const uid = strId(user);
    if (!uid) return false;

    const rawPm = project.pmId;
    if (rawPm) {
        const id = strId(rawPm);
        if (id && id === uid) return true;
    }
    if (project.projectManagerId) {
        if (strId(project.projectManagerId) === uid) return true;
    }
    const pm = project.projectManager || project.manager;
    if (pm && typeof pm === 'object') {
        if (strId(pm) === uid) return true;
    }
    
    const uName = user.fullName || user.name || '';
    if (uName && typeof pm === 'string' && pm.trim() && uName.trim() === pm.trim()) return true;
    if (uName && pm?.fullName && uName.trim() === String(pm.fullName).trim()) return true;

    return false;
}

/**
 * @returns {Set<string>|null} Project ids this PM manages; null if not PM (caller uses "no extra filter")
 */
export function getManagedProjectIdsForPm(projects, user) {
    if (user?.role !== 'PM') return null;
    const set = new Set();
    (projects || []).forEach((p) => {
        if (isUserPmOfProject(p, user)) {
            set.add(strId(p));
        }
    });
    return set;
}

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
        const pid = strId(j.projectId?._id || j.projectId || j.project);
        if (!pid || !projectIdSet.has(pid)) return;
        add(j.assignedTo);
    });
    (tasks || []).forEach((t) => {
        const pid = strId(t.projectId?._id || t.projectId || t.project);
        if (!pid || !projectIdSet.has(pid)) return;
        add(t.assignedTo);
    });
    return out;
}

/**
 * User ids present on the project document (stakeholders + optional team lists from API).
 * Includes people on the project even when they have no job/task yet.
 */
export function collectUserIdsFromProjectRecord(project) {
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

    if (!project) return out;

    add(project.pmId);
    add(project.clientId);
    add(project.foremanId);
    add(project.assignedTo);
    add(project.supervisorId);

    const listKeys = [
        'teamMembers', 'members', 'team', 'workers', 'assignedUsers', 'crew',
        'subcontractors', 'fieldStaff', 'siteTeam', 'assignedTeam',
    ];
    listKeys.forEach((key) => {
        const v = project[key];
        if (v == null) return;
        if (Array.isArray(v)) v.forEach((x) => add(x));
        else add(v);
    });

    return out;
}

function collectStakeholderUserIdsOnManagedProjects(projects, managed) {
    const out = new Set();
    (projects || []).forEach((p) => {
        const pid = strId(p);
        if (!pid || !managed.has(pid)) return;
        collectUserIdsFromProjectRecord(p).forEach((id) => out.add(id));
    });
    return out;
}

/**
 * User ids (workers/assignees) on the PM’s projects — allowed DM peers for that PM.
 * @returns {Set<string>|null} null = not PM (no filter)
 */
export function getAllowedDmPeerIdsForPm(projects, jobs, tasks, user) {
    if (user?.role !== 'PM') return null;
    const managed = getManagedProjectIdsForPm(projects, user);
    if (!managed || managed.size === 0) return new Set();
    const fromWork = collectAssigneeUserIdsOnProjects(jobs, tasks, managed);
    const fromProjects = collectStakeholderUserIdsOnManagedProjects(projects, managed);
    return new Set([...fromWork, ...fromProjects]);
}

/**
 * PM direct-message peers for a single managed project (stakeholders on that project + job/task assignees for that project).
 * @param {string} projectId
 */
export function getDmPeerIdsForPmScopedToProject(projects, jobs, tasks, user, projectId) {
    if (user?.role !== 'PM' || !projectId) return new Set();
    const managed = getManagedProjectIdsForPm(projects, user);
    const key = strId(projectId);
    if (!managed || !managed.has(key)) return new Set();
    const one = new Set([key]);
    const fromWork = collectAssigneeUserIdsOnProjects(jobs, tasks, one);
    const p = (projects || []).find((x) => strId(x) === key);
    const fromRec = p ? collectUserIdsFromProjectRecord(p) : new Set();
    return new Set([...fromWork, ...fromRec]);
}
