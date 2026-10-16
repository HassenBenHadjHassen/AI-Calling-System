import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Business } from '@prisma/client';

export interface BusinessAuthResult {
  authorized: boolean;
  status: number;
  error?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    assignedBusiness: string;
    allowedSections: string;
  };
  business?: Business;
}

/**
 * Enforces business-level authorization on the server.
 * - Administrators may manage any business.
 * - Client staff may only manage the business assigned to their account.
 * - Resolves business by either UUID id or unique slug.
 */
export async function verifyBusinessAccess(
  reqHeaders: Headers,
  businessIdOrSlug: string
): Promise<BusinessAuthResult> {
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user?.id) {
    return { authorized: false, status: 401, error: 'Authentification requise.' };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      assignedBusiness: true,
      allowedSections: true,
    },
  });

  if (!user) {
    return { authorized: false, status: 401, error: 'Utilisateur non reconnu.' };
  }

  // Resolve business by ID or slug
  const business = await db.business.findFirst({
    where: {
      OR: [
        { id: businessIdOrSlug },
        { slug: businessIdOrSlug },
      ],
    },
  });

  if (!business) {
    return { authorized: false, status: 404, error: 'Établissement introuvable.' };
  }

  // 1. Administrators have unrestricted access across all businesses
  if (user.role === 'ADMIN') {
    return { authorized: true, status: 200, user, business };
  }

  // 2. Client users may only manage their assigned business
  const isAssigned =
    user.assignedBusiness === 'ALL' ||
    user.assignedBusiness === business.slug ||
    user.assignedBusiness === business.id;

  if (!isAssigned) {
    return {
      authorized: false,
      status: 403,
      error: 'Vous n’avez pas les droits d’accès pour gérer cet établissement.',
    };
  }

  // Assigned business accounts can manage routing for their own business.
  // Cross-business accounts still need the explicit routing section permission.
  const isAssignedToThisBusiness =
    user.assignedBusiness === business.slug || user.assignedBusiness === business.id;
  const hasRoutingPermission =
    user.allowedSections === 'ALL' ||
    user.allowedSections?.split(',').map((section) => section.trim()).includes('routing');

  if (!isAssignedToThisBusiness && !hasRoutingPermission) {
    return { authorized: false, status: 403, error: 'Accès non autorisé à la section Routage.' };
  }

  return { authorized: true, status: 200, user, business };
}
