import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@components/Sidebar';
import Header from '@components/Header';

const DashboardLayout: React.FC = () => {
  // Initialize sidebar state from localStorage or default based on screen size
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default to collapsed on smaller screens for better UX
    return window.innerWidth < 1024;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Handle window resize to auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev: boolean) => !prev);
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