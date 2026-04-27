/**
 * Gallery badges use `projectId.name`. List endpoints populate it; upload used to return a raw id only.
 * Merges the project name from the app project list when the API omits it.
 */
export function enrichPhotoWithProject(photo, projectList) {
    if (!photo) return photo;
    const pid = photo.projectId;
    if (pid && typeof pid === 'object' && pid.name) return photo;

    const rawId =
        pid == null || pid === ''
            ? ''
            : String(typeof pid === 'object' && pid !== null ? pid._id ?? pid : pid);

    if (!rawId) return photo;

    const proj = Array.isArray(projectList)
        ? projectList.find((p) => String(p._id ?? p.id) === rawId)
        : null;

    return {
        ...photo,
        projectId: proj ? { _id: rawId, name: proj.name } : { _id: rawId, name: 'Project' }
    };
}
