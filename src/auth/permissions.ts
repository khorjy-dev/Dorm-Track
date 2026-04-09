export type Role = 'staff' | 'admin';

export type Permission =
  | 'incident:create'
  | 'incident:review'
  | 'staff:manage'
  | 'users:manage';

export const permissionsByRole: Record<Role, Permission[]> = {
  staff: ['incident:create', 'incident:review'],
  admin: ['incident:create', 'incident:review', 'staff:manage', 'users:manage'],
};

export function hasPermission(role: Role, permission: Permission) {
  return permissionsByRole[role]?.includes(permission) ?? false;
}

