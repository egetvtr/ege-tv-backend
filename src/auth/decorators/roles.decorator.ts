import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Hangi rollerin bu route'a erişebileceğini belirtir */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
