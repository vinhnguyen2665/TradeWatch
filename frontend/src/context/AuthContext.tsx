import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginData, RegisterData, UserProfileUpdateData } from '../types';
import { loginApi, registerApi, getMeApi, updateProfileApi } from '../services/api';
import { message } from 'antd';
import { STORAGE_KEYS } from '../constants';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UserProfileUpdateData) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (savedToken) {
        try {
          const userData = await getMeApi();
          setUser(userData);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        } catch (err) {
          // Token invalid or expired
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleLogoutEvent = () => {
      logout();
      message.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => window.removeEventListener('auth:logout', handleLogoutEvent);
  }, []);

  const login = async (data: LoginData) => {
    const res = await loginApi(data);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    message.success(`Chào mừng trở lại, ${res.user.full_name || res.user.username}!`);
  };

  const register = async (data: RegisterData) => {
    const res = await registerApi(data);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem(STORAGE_KEYS.TOKEN, res.access_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
    message.success('Đăng ký tài khoản thành công!');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const updateProfile = async (data: UserProfileUpdateData) => {
    const updatedUser = await updateProfileApi(data);
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    message.success('Cập nhật thông tin tài khoản thành công!');
  };

  const refreshUser = async () => {
    try {
      const userData = await getMeApi();
      setUser(userData);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
