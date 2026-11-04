// One row in GET /api/projects: just what the dashboard list needs
export function toProjectSummary(project, userId) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    memberCount: project.members.length,
    role: project.members.find((m) => m.user.equals(userId)).role,
    updatedAt: project.updatedAt,
  };
}
