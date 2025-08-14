import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Phone, 
  Users, 
  ShoppingCart,
  MessageCircle,
  CheckSquare,
  X
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}

const menuItems = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard'
  },
  {
    name: 'Call Console',
    icon: Phone,
    path: '/call-console'
  },
  {
    name: 'Customers',
    icon: Users,
    path: '/customers'
  },
  {
    name: 'Orders',
    icon: ShoppingCart,
    path: '/orders'
  },
  {
    name: 'Follow-ups',
    icon: CheckSquare,
    path: '/follow-ups'
  }
];

const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed, 
  isMobileMenuOpen, 
  onMobileMenuClose 
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileMenuClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-gray-900 dark:bg-gray-800 z-50 transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Mobile Close Button */}
        <div className="lg:hidden flex justify-end p-4">
          <button
            onClick={onMobileMenuClose}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300 backdrop-blur-sm"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Logo */}
        <div className="flex  items-center justify-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            {!isCollapsed && (
              <span className="text-white font-bold text-xl">CRM</span>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="mt-6 px-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <NavLink
                    to={item.path}
                    onClick={() => window.innerWidth < 1024 && onMobileMenuClose()}
                  >
                    {({ isActive }) => (
                      <div className={`
                        flex items-center px-3 py-2 rounded-lg transition-all duration-300 group relative
                        ${isActive 
                          ? 'bg-white/10 dark:bg-white/5 text-white border-l-4 border-blue-400 shadow-sm backdrop-blur-sm' 
                          : 'text-gray-300 dark:text-gray-400 hover:bg-white/5 dark:hover:bg-white/5 hover:text-white border-l-4 border-transparent hover:border-gray-500/30'
                        }
                        ${isCollapsed ? 'justify-center border-l-0' : 'space-x-3'}
                      `}>
                        <Icon className={`h-5 w-5 flex-shrink-0 transition-all duration-300 ${isActive ? 'text-blue-300' : ''}`} />
                        {!isCollapsed && (
                          <span className="font-medium transition-all duration-300">{item.name}</span>
                        )}
                        {isCollapsed && (
                          <div className="absolute left-16 ml-2 px-3 py-2 bg-gray-900/90 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 whitespace-nowrap shadow-lg backdrop-blur-sm border border-gray-700">
                            {item.name}
                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900/90 rotate-45 border-l border-b border-gray-700"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className={`
            text-center text-xs text-gray-500 dark:text-gray-400
            ${isCollapsed ? 'hidden' : 'block'}
          `}>
            <p>CRM Dashboard</p>
            <p>v1.0.0</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;