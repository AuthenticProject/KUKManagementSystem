export interface Unit {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  business_type: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_system_role: boolean;
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  name: string;
}

export interface UserUnitRole {
  id: string;
  user_id: string;
  unit_id: string;
  role_id: string;
  is_default_unit: boolean;
  unit: Unit;
  role: Role;
  permissions: Permission[];
}

export interface UserSystemRole {
  user_id: string;
  role_id: string;
  role: Role;
  permissions: Permission[];
}

