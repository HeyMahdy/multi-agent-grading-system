export const USER_ROLES = ['student', 'teacher', 'admin'] as const;

export type UserRoleName = (typeof USER_ROLES)[number];
