import { UserRole } from '../types';

export function canCreateEstimate(role: UserRole): boolean {
  return ['admin', 'procurement_officer', 'estimator'].includes(role);
}

export function canEditEstimate(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return isOwner;
}

export function canDeleteEstimate(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  return isOwner;
}

export function canFreezeVersion(role: UserRole): boolean {
  return ['admin', 'procurement_officer'].includes(role);
}

export function canViewAuditLog(role: UserRole): boolean {
  return ['admin', 'procurement_officer'].includes(role);
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin';
}

export function canManageSettings(role: UserRole): boolean {
  return role === 'admin';
}

export function canEditBoQRow(role: UserRole, isEstimateOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return isEstimateOwner;
}

export function canCommentOnRow(role: UserRole): boolean {
  return role !== 'viewer';
}

export function canAcceptAIRun(role: UserRole, isEstimateOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return isEstimateOwner;
}

export function canUseAI(role: UserRole, isEstimateOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return isEstimateOwner;
}

export function canChangeEstimateStatus(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'procurement_officer') return true;
  return isOwner && role === 'estimator';
}

export function canExportEstimate(role: UserRole): boolean {
  return role !== 'viewer';
}

export function canImportBoQ(role: UserRole, isEstimateOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return isEstimateOwner;
}
