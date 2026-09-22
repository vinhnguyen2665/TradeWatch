import React, { useState } from 'react';
import { Modal, Tabs, Form, Input, Button, message } from 'antd';
import {
  User as UserIcon,
  Lock,
  Mail,
  Send,
  Zap,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoginData, RegisterData } from '../types';

interface AuthModalProps {
  visible: boolean;
  defaultTab?: 'login' | 'register';
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  defaultTab = 'login',
  onClose,
}) => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [loginForm] = Form.useForm<LoginData>();
  const [registerForm] = Form.useForm<RegisterData>();

  // Reset tab when modal opens with new defaultTab
  React.useEffect(() => {
    if (visible) {
      setActiveTab(defaultTab);
      loginForm.resetFields();
      registerForm.resetFields();
    }
  }, [visible, defaultTab]);

  const handleLogin = async (values: LoginData) => {
    setLoading(true);
    try {
      await login(values);
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterData) => {
    setLoading(true);
    try {
      await register(values);
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    loginForm.setFieldsValue({
      username_or_email: 'demo',
      password: '123456',
    });
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={440}
      centered
      className="auth-modal"
    >
      <div className="pt-2 pb-1">
        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 shadow-lg shadow-blue-500/20 text-white mb-3">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {activeTab === 'login' ? 'Đăng Nhập TradeWatch Pro' : 'Tạo Tài Khoản Mới'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'login'
              ? 'Quản trị danh mục & nhận cảnh báo thị trường thời gian thực'
              : 'Theo dõi danh mục và nhận cảnh báo Telegram tự động'}
          </p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'login' | 'register')}
          centered
          items={[
            {
              key: 'login',
              label: (
                <span className="flex items-center gap-1.5 font-medium px-2">
                  <LogIn className="w-4 h-4" /> Đăng Nhập
                </span>
              ),
              children: (
                <Form
                  form={loginForm}
                  layout="vertical"
                  onFinish={handleLogin}
                  className="mt-3 space-y-3"
                >
                  <Form.Item
                    name="username_or_email"
                    label={<span className="text-xs font-medium">Tên đăng nhập hoặc Email</span>}
                    rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập hoặc email' }]}
                  >
                    <Input
                      prefix={<UserIcon className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="VD: demo hoặc demo@tradewatch.vn"
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label={<span className="text-xs font-medium">Mật khẩu</span>}
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
                  >
                    <Input.Password
                      prefix={<Lock className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="Nhập mật khẩu..."
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="h-10 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold shadow-md shadow-blue-500/20 text-sm mt-2"
                  >
                    Đăng Nhập Ngay
                  </Button>

                  {/* Demo Account Quick Fill */}
                  <div className="pt-2">
                    <Button
                      type="dashed"
                      block
                      onClick={fillDemoAccount}
                      icon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
                      className="text-xs text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-500"
                    >
                      Điền tài khoản Demo (demo / 123456)
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'register',
              label: (
                <span className="flex items-center gap-1.5 font-medium px-2">
                  <UserPlus className="w-4 h-4" /> Đăng Ký
                </span>
              ),
              children: (
                <Form
                  form={registerForm}
                  layout="vertical"
                  onFinish={handleRegister}
                  className="mt-3 space-y-2.5"
                >
                  <Form.Item
                    name="username"
                    label={<span className="text-xs font-medium">Tên đăng nhập</span>}
                    rules={[
                      { required: true, message: 'Vui lòng nhập tên đăng nhập' },
                      { min: 3, message: 'Tối thiểu 3 ký tự' },
                    ]}
                  >
                    <Input
                      prefix={<UserIcon className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="VD: vinhnguyen"
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label={<span className="text-xs font-medium">Địa chỉ Email</span>}
                    rules={[
                      { required: true, message: 'Vui lòng nhập email' },
                      { type: 'email', message: 'Email không hợp lệ' },
                    ]}
                  >
                    <Input
                      prefix={<Mail className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="VD: name@domain.com"
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label={<span className="text-xs font-medium">Mật khẩu</span>}
                    rules={[
                      { required: true, message: 'Vui lòng nhập mật khẩu' },
                      { min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' },
                    ]}
                  >
                    <Input.Password
                      prefix={<Lock className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="Tối thiểu 6 ký tự"
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Form.Item
                    name="full_name"
                    label={<span className="text-xs font-medium">Họ và tên (Tùy chọn)</span>}
                  >
                    <Input
                      placeholder="VD: Nguyễn Văn A"
                      className="rounded-lg h-10"
                    />
                  </Form.Item>

                  <Form.Item
                    name="telegram_chat_id"
                    label={<span className="text-xs font-medium">Telegram Chat ID (Tùy chọn)</span>}
                    help={<span className="text-[10px] text-slate-500">Lấy ID từ @userinfobot và bấm Start với @trade_zero9vn_bot để nhận cảnh báo TP/SL</span>}
                  >
                    <Input
                      prefix={<Send className="w-4 h-4 text-slate-400 mr-1" />}
                      placeholder="VD: 123456789"
                      className="rounded-lg h-10 mono-font"
                    />
                  </Form.Item>

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold shadow-md shadow-emerald-500/20 text-sm mt-2"
                  >
                    Tạo Tài Khoản
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
};
