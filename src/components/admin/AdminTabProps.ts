import { User } from "firebase/auth";
import { UserProfile, UserRole } from "@/contexts/AuthContext";

/**
 * Shared props for all admin tab components
 */
export interface AdminTabProps {
  form: any;
  setForm: (form: any) => void;
  handleSave: () => void;
}

/**
 * Extended props for tabs that need settings context
 */
export interface AdminTabWithSettingsProps extends AdminTabProps {
  settings: any;
  updateSettings: (updates: any) => void;
}

/**
 * Props for tabs that need user/profile context
 */
export interface AdminTabWithAuthProps extends AdminTabProps {
  user: User;
  profile: UserProfile;
}

/**
 * Props for tabs that need user list
 */
export interface AdminTabWithUsersProps extends AdminTabWithAuthProps {
  users: FirestoreUser[];
  loadUsers: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
}

export interface FirestoreUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
}

export const generateId = () => Math.random().toString(36).substring(2, 10);
