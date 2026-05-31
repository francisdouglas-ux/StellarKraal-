/**
 * Admin routing configuration
 *
 * NOTE: We do NOT use the `end` prop on Route components.
 * In react-router v7, the `end` prop is only valid on NavLink.
 * For Route components with path="/admin", it already matches exactly
 * and does not need the `end` prop.
 */
export const adminRoutes = [
  {
    path: '/admin',
    label: 'Admin',
  },
  {
    path: '/admin/moderation',
    label: 'Moderation',
  },
  {
    path: '/admin/statistics',
    label: 'Statistics',
  },
  {
    path: '/admin/users',
    label: 'Users',
  },
  {
    path: '/admin/reports',
    label: 'Reports',
  },
];

export interface AdminRouteConfig {
  path: string;
  label: string;
}
