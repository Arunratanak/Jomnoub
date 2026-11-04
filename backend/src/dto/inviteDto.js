// GET /api/invites/:token: what someone sees before joining.
// Deliberately excludes the member list and any ids other than the project's.
export function toInvitePreview(invite, project, userId) {
  return {
    projectId: project.id,
    projectName: project.name,
    memberCount: project.members.length,
    expiresAt: invite.expiresAt,
    alreadyMember: project.members.some((m) => m.user.equals(userId)),
  };
}
