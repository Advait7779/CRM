export const ADMIN = ['super_admin', 'director'];
export const SALES = [...ADMIN, 'sales_manager', 'sales_executive'];
export const OPERATIONS = [...ADMIN, 'installation_manager', 'gps_installer', 'cctv_technician', 'website_developer'];
export const SUPPORT = [...ADMIN, 'support_executive'];
export const FINANCE = [...ADMIN, 'accounts'];
export const MANAGEMENT = [...ADMIN, 'sales_manager', 'installation_manager'];
export const ALL_STAFF = [
  ...new Set([...ADMIN, 'accounts', 'sales_manager', 'sales_executive', 'installation_manager',
    'gps_installer', 'cctv_technician', 'website_developer', 'digital_marketing', 'support_executive'])
];

export const SCREEN_ROLES = {
  Leads: SALES,
  Renewals: [...new Set([...SALES, ...FINANCE])],
  Quotations: [...new Set([...SALES, ...FINANCE])],
  Accounts: FINANCE,
  Inventory: [...new Set([...OPERATIONS, ...MANAGEMENT])],
  Installations: [...new Set([...OPERATIONS, ...SALES, ...SUPPORT])],
  Tickets: [...new Set([...SUPPORT, ...OPERATIONS])],
  Employees: ADMIN,
  MyWork: ALL_STAFF,
  Users: ADMIN,
  Calendar: ALL_STAFF,
  Profile: ALL_STAFF,
  Customers: ALL_STAFF,
  Tasks: ALL_STAFF,
  Chat: ALL_STAFF,
  Dashboard: ALL_STAFF,
  GlobalSearch: ALL_STAFF,
  Notifications: ALL_STAFF,
};

export const WRITE_ROLES = {
  leads: SALES,
  customers: SALES,
  tasks: MANAGEMENT,
  tickets: [...new Set([...SUPPORT, 'installation_manager', 'gps_installer', 'cctv_technician'])],
  employees: ADMIN,
  installations: OPERATIONS,
  renewals: [...new Set([...SALES, ...FINANCE])],
  inventory: [...new Set([...OPERATIONS, ...MANAGEMENT])],
  invoices: FINANCE,
  quotations: SALES,
  users: ADMIN,
};

export const hasRole = (role, roles = []) => Boolean(role && roles.includes(role));
export const canAccessScreen = (role, screen) => hasRole(role, SCREEN_ROLES[screen] || ALL_STAFF);
export const canWriteResource = (role, resource) => hasRole(role, WRITE_ROLES[resource] || []);
export const isManager = (role) => hasRole(role, MANAGEMENT);
