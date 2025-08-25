import api from '@services/api';

// MongoDB User interface
export interface User {
  _id: string;
  name: string;
  email: string;
  extension: string;
  role: 'agent' | 'supervisor' | 'admin';
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Laravel User interface (commented out)
// export interface User {
//   id: number;
//   name: string;
//   email: string;
//   email_verified_at: string;
//   created_at: string;
// }

export interface LoginCredentials {
  email: string;
  password: string;
}

// MongoDB API Response interface
export interface MongoLoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    lastLogin: string;
  };
}

// Laravel API Response interface (commented out)
// export interface LoginResponse {
//   message: string;
//   access_token: string;
//   token_type: string;
//   user: User;
// }

class AuthService {
  async login(credentials: LoginCredentials): Promise<MongoLoginResponse> {
    try {
      const response = await api.post<MongoLoginResponse>('/auth/login', credentials);
      
      if (response.data.success) {
        // Store user data (no token for MongoDB API)
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        // Store a simple auth flag
        localStorage.setItem('auth_token', 'authenticated');
      } else {
        // Handle unsuccessful login response
        throw new Error(response.data.message || 'Login failed');
      }
      
      return response.data;
    } catch (error: any) {
      // Enhanced error handling for MongoDB API
      console.error('Login error details:', error);
      
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.message) {
        throw new Error(error.message);
      } else {
        throw new Error('Login failed. Please check your credentials and try again.');
      }
    }
  }

  // Laravel login method (commented out)
  // async login(credentials: LoginCredentials): Promise<LoginResponse> {
  //   const response = await api.post<LoginResponse>('/login', credentials);
  //   
  //   // Store token and user data
  //   localStorage.setItem('auth_token', response.data.access_token);
  //   localStorage.setItem('user', JSON.stringify(response.data.user));
  //   
  //   return response.data;
  // }

  async logout(): Promise<void> {
    try {
      // MongoDB API doesn't have a logout endpoint, just clear local storage
      // await api.post('/logout'); // Laravel logout endpoint (commented out)
    } catch (error) {
      // Even if the API call fails, clear local storage
      console.error('Logout API error:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }

  async getProfile(): Promise<User> {
    // For MongoDB API, we need to send the user email in the request body
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      throw new Error('No user found');
    }
    
    const response = await api.post<{ success: boolean; data: User }>('/auth/profile', {
      email: currentUser.email
    });
    return response.data.data;
  }

  // Laravel profile method (commented out)
  // async getProfile(): Promise<User> {
  //   const response = await api.get<{ user: User }>('/profile');
  //   return response.data.user;
  // }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export default new AuthService();