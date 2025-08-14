import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, Bounce, Flip } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from '@contexts/ThemeContext';

// Components
import DashboardLayout from '@components/DashboardLayout';
import ProtectedRoute from '@components/ProtectedRoute';

// Pages
import Login from '@pages/Login';
import Dashboard from '@pages/Dashboard';
import CallConsole from '@pages/CallConsole';
import Customers from '@pages/Customers';
import Orders from '@pages/Orders';


// Services
import authService from '@services/authService';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen">
          <Routes>
            {/* Login Route */}
            <Route 
              path="/login" 
              element={
                authService.isAuthenticated() ? 
                  <Navigate to="/dashboard" replace /> : 
                  <Login />
              } 
            />
            
            {/* Protected Dashboard Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="call-console" element={<CallConsole />} />
              <Route path="customers" element={<Customers />} />
              <Route path="orders" element={<Orders />} />
              

              
            </Route>
            
            {/* Catch all route - redirect based on authentication */}
            <Route 
              path="*" 
              element={
                <Navigate 
                  to={authService.isAuthenticated() ? "/dashboard" : "/login"} 
                  replace 
                />
              } 
            />
          </Routes>
        </div>
        
        {/* React Toastify Container */}
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          transition={Flip}
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;
