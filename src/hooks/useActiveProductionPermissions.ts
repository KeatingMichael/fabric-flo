import { useActiveProduction, useApp } from "@/context/AppStore";
import { useCloudAuth } from "@/context/CloudAuthProvider";
import {
  canManageCrewInvites,
  canUploadProductionListsForSession,
} from "@/lib/productionPermissions";
import type { ProductionMemberRole } from "@/types";

export function useActiveProductionPermissions(): {
  role: ProductionMemberRole | undefined;
  canUploadLists: boolean;
  canManageInvites: boolean;
  cloudSignedIn: boolean;
} {
  const production = useActiveProduction();
  const { productionRoles } = useApp();
  const { session, configured } = useCloudAuth();
  const cloudSignedIn = configured && Boolean(session);
  const role = production ? productionRoles?.[production.id] : undefined;

  return {
    role,
    cloudSignedIn,
    canUploadLists: canUploadProductionListsForSession(role, cloudSignedIn),
    canManageInvites: cloudSignedIn ? canManageCrewInvites(role) : true,
  };
}
