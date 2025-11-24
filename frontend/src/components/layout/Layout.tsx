// // src/components/layout/Layout.tsx
// import React from "react";
// import { Link, useLocation } from "react-router-dom";
// import { cn } from "@/lib/utils";
// import {
//   LayoutDashboard,
//   ShoppingCart,
//   Package,
//   Users,
//   BarChart3,
// } from "lucide-react";

// interface LayoutProps {
//   children: React.ReactNode;
// }

// const navigation = [
//   { name: "Dashboard", href: "/", icon: LayoutDashboard },
//   { name: "POS", href: "/pos", icon: ShoppingCart },
//   { name: "Inventory", href: "/inventory", icon: Package },
//   { name: "Customers", href: "/customers", icon: Users },
//   { name: "Sales", href: "/sales", icon: BarChart3 },
// ];

// const Layout: React.FC<LayoutProps> = ({ children }) => {
//   const location = useLocation();

//   return (
//     <div className="flex h-screen bg-gray-50">
//       {/* Sidebar */}
//       <div className="w-64 bg-white shadow-lg">
//         <div className="p-6">
//           <h1 className="text-2xl font-bold text-gray-800">
//             Sari<span className="text-blue-600">Store</span>POS
//           </h1>
//         </div>

//         <nav className="mt-6">
//           {navigation.map((item) => {
//             const isActive = location.pathname === item.href;
//             return (
//               <Link
//                 key={item.name}
//                 to={item.href}
//                 className={cn(
//                   "flex items-center px-6 py-3 text-sm font-medium transition-colors",
//                   isActive
//                     ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
//                     : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
//                 )}
//               >
//                 <item.icon className="mr-3 h-5 w-5" />
//                 {item.name}
//               </Link>
//             );
//           })}
//         </nav>
//       </div>

//       {/* Main content */}
//       <div className="flex-1 overflow-auto">
//         <main className="p-6">{children}</main>
//       </div>
//     </div>
//   );
// };

// export default Layout;

// src/components/layout/Layout.tsx
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "POS", href: "/pos", icon: ShoppingCart },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Sales", href: "/sales", icon: BarChart3 },
  { name: "Admin", href: "/admin", icon: Settings },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authService.logout();
      logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      logout();
      navigate("/login");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 flex flex-col",
          "w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">
            Sari<span className="text-blue-600">Store</span>POS
          </h1>

          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1">
          {navigation.map((item) => {
            // Hide Admin link for non-admin/non-manager users
            if (
              item.name === "Admin" &&
              user?.role !== "admin" &&
              user?.role !== "manager"
            ) {
              return null;
            }

            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center px-6 py-3 text-sm font-medium transition-colors",
                  "hover:bg-gray-50 hover:text-gray-900",
                  isActive
                    ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                    : "text-gray-600"
                )}
              >
                <item.icon className="mr-3 h-5 w-5 shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info and Logout */}
        <div className="border-t border-gray-200 p-4 mt-auto">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <Menu className="h-6 w-6" />
            </button>

            <h1 className="text-lg font-semibold text-gray-800">
              Sari<span className="text-blue-600">Store</span>POS
            </h1>

            {/* Spacer to balance the layout */}
            <div className="w-10" />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
