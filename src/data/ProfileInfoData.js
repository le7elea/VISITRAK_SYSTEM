// src/data/ProfileInfoData.js

// Base profile info - this will be dynamically updated based on user role
export const profilePersonalInfo = [
  { label: "Email Address:", value: "superadmin@gmail.com" },
  { label: "Department Office:", value: "Admin Office" },
  { label: "User Role:", value: "Super Admin" },
  { label: "Date Created:", value: "12-05-2025" },
];

// Optional: Create separate data for different user types
export const profileInfoSuperAdmin = [
  { label: "Email Address:", value: "superadmin@gmail.com" },
  { label: "Department Office:", value: "Administrative Office" },
  { label: "User Role:", value: "Super Administrator" },
  { label: "Date Created:", value: "12-05-2025" },
  { label: "Access Level:", value: "Full System Access" },
  { label: "Managed Offices:", value: "All Offices" },
];

export const profileInfoOfficeAdmin = (office) => [
  { label: "Email Address:", value: "officeadmin@gmail.com" },
  { label: "Assigned Office:", value: office || "Office Not Assigned" },
  { label: "User Role:", value: "Office Administrator" },
  { label: "Date Created:", value: "15-01-2025" },
  { label: "Access Level:", value: "Office-Level Access" },
  { label: "Permissions:", value: `Manage ${office || "assigned"} office visitors only` },
]; 