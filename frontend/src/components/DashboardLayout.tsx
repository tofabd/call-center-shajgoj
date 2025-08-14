import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@components/Sidebar';
import Header from '@components/Header';

const DashboardLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar 
        isCollapsed={isCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={handleMobileMenuClose}
      />
      
      <Header 
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onMobileMenuToggle={handleMobileMenuToggle}
      />
      
      {/* Main Content - Full width */}
      <main className={`
        transition-all duration-300 ease-in-out pt-16 min-h-screen
        ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
        ml-0
      `}>
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;