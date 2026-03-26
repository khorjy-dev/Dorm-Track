export type Role = 'ra' | 'staff' | 'admin';

export type Permission =
  | 'incident:create'
  | 'incident:review'
  | 'staff:manage';

export const permissionsByRole: Record<Role, Permission[]> = {
  ra: ['incident:create'],
  staff: ['incident:create', 'incident:review', 'staff:manage'],
  admin: ['incident:create', 'incident:review', 'staff:manage'],
};

export function hasPermission(role: Role, permission: Permission) {
  return permissionsByRole[role]?.includes(permission) ?? false;
}

