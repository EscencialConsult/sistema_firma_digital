export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  primaryColor?: string;
  plan: "basic" | "pro" | "enterprise";
  isActive: boolean;
  diditWorkflowId?: string;
  maxUsers: number;
  contactEmail?: string;
  createdAt: string;
  /** Colores de marca — se aplican al tema de la UI al cargar la org */
  brandPrimary?:    string;
  brandSecondary?:  string;
  brandAccent?:     string;
  brandBackground?: string;
}

export interface OrganizationStats {
  totalUsers: number;
  activeUsers: number;
  pendingKycs: number;
  verifiedUsers: number;
  totalContracts: number;
}
