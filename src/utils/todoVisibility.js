/**
 * Resolve Mongo/user id from populated or raw refs.
 * @param {string|{ _id?: string, id?: string }|null|undefined} ref
 * @returns {string}
 */
function idFromRef(ref) {
    if (ref == null) return '';
    if (typeof ref === 'object') return String(ref._id || ref.id || '');
    return String(ref);
}

/**
 * Todos are visible only to their assignee(s). If there is no assignee (legacy data),
 * only the creator (assignedBy / createdBy) can see the item — not the whole org.
 * @param {object} todo
 * @param {{ _id?: string }|null|undefined} user
 * @returns {boolean}
 */
export function isTodoVisibleToUser(todo, user) {
    if (!todo || !user?._id) return false;
    const myId = String(user._id);

    const raw = todo.assignedTo;
    const assigneeIds = [];

    if (Array.isArray(raw)) {
        raw.forEach((a) => {
            if (a && typeof a === 'object') assigneeIds.push(String(a._id || a.id || ''));
            else if (a) assigneeIds.push(String(a));
        });
    } else if (raw && typeof raw === 'object') {
        assigneeIds.push(String(raw._id || raw.id || ''));
    } else if (raw) {
        assigneeIds.push(String(raw));
    }

    const hasAssignee = assigneeIds.some((id) => id && id.length > 0);
    if (hasAssignee) {
        return assigneeIds.some((id) => id === myId);
    }

    const byAssigner = idFromRef(todo.assignedBy) === myId;
    const byCreator = idFromRef(todo.createdBy) === myId;
    return byAssigner || byCreator;
}
