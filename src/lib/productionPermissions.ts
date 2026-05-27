import type { ProductionMemberRole } from "@/types";

export function isProductionMemberRole(value: string): value is ProductionMemberRole {
  return value === "admin" || value === "department_head" || value === "crew" || value === "viewer";
}

/** Department heads and show admins may upload rental lists and logs. */
export function canUploadProductionLists(role: ProductionMemberRole | undefined): boolean {
  return role === "admin" || role === "department_head";
}

export function canManageCrewInvites(role: ProductionMemberRole | undefined): boolean {
  return canUploadProductionLists(role);
}

/**
 * When not signed in to cloud, treat the device user as show lead (local setup).
 * When signed in, enforce membership role from the server.
 */
export function canUploadProductionListsForSession(
  role: ProductionMemberRole | undefined,
  cloudSignedIn: boolean
): boolean {
  if (!cloudSignedIn) return true;
  return canUploadProductionLists(role);
}
