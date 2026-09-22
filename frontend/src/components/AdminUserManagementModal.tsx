import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Tabs,
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Popconfirm,
  message,
  Avatar,
  Form,
  Spin,
  Tooltip,
  Badge,
} from 'antd';
import {
  Users,
  ShieldCheck,
  UserPlus,
  BarChart3,
  TrendingUp,
  Send,
  UserCheck,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  KeyRound,
  Mail,
  Calendar,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  UserAdminItem,
  UserAdminStats,
  AdminCreateUserData,
  AdminUpdateUserData,
} from '../types';
import {
  getAdminStats,
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AdminUserManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'users'>('stats');

  // Stats state
  const [stats, setStats] = useState<UserAdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // Users state
  const [users, setUsers] = useState<UserAdminItem[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals for Create & Edit User
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createForm] = Form.useForm();

  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserAdminItem | null>(null);
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editForm] = Form.useForm();

  // Load Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load admin stats:', err);
      message.error(err.response?.data?.detail || 'Không thể tải thống kê quản trị');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load Users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params: any = {};
      if (searchKeyword.trim()) params.q = searchKeyword.trim();
      if (roleFilter !== 'all') params.role = roleFilter;
      const data = await getAdminUsers(params);
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users list:', err);
      message.error(err.response?.data?.detail || 'Không thể tải danh sách người dùng');
    } finally {
      setUsersLoading(false);
    }
  }, [searchKeyword, roleFilter]);

  useEffect(() => {
    if (visible) {
      loadStats();
      loadUsers();
    }
  }, [visible, loadStats, loadUsers]);

  // Handle Create User
  const handleCreateSubmit = async (values: AdminCreateUserData) => {
    setCreateSubmitting(true);
    try {
      await createAdminUser(values);
      message.success(`Đã tạo tài khoản '${values.username}' thành công!`);
      setCreateModalVisible(false);
      createForm.resetFields();
      loadUsers();
      loadStats();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi tạo người dùng');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (record: UserAdminItem) => {
    setEditingUser(record);
    editForm.setFieldsValue({
      full_name: record.full_name || '',
      email: record.email,
      role: record.role,
      telegram_chat_id: record.telegram_chat_id || '',
      password: '',
    });
    setEditModalVisible(true);
  };

  // Handle Update User
  const handleEditSubmit = async (values: any) => {
    if (!editingUser) return;
    setEditSubmitting(true);
    try {
      const payload: AdminUpdateUserData = {
        full_name: values.full_name,
        email: values.email,
        role: values.role,
        telegram_chat_id: values.telegram_chat_id,
      };
      if (values.password && values.password.trim()) {
        payload.password = values.password.trim();
      }
      await updateAdminUser(editingUser.id, payload);
      message.success(`Đã cập nhật thông tin người dùng '${editingUser.username}' thành công!`);
      setEditModalVisible(false);
      setEditingUser(null);
      editForm.resetFields();
      loadUsers();
      loadStats();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi cập nhật người dùng');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (record: UserAdminItem) => {
    try {
      await deleteAdminUser(record.id);
      message.success(`Đã xóa tài khoản '${record.username}' thành công!`);
      loadUsers();
      loadStats();
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi xóa người dùng');
    }
  };

  // User Table Columns
  const columns = [
    {
      title: 'Người Dùng',
      key: 'user_info',
      render: (_: any, record: UserAdminItem) => {
        const initial = (record.username || 'U').charAt(0).toUpperCase();
        const isAdmin = record.role === 'admin';
        return (
          <div className="flex items-center gap-3">
            <Avatar
              size="default"
              className={
                isAdmin
                  ? 'bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 font-bold shadow-sm'
                  : 'bg-gradient-to-tr from-blue-600 to-emerald-500 font-bold shadow-sm'
              }
            >
              {initial}
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                <span>{record.full_name || record.username}</span>
                {currentUser?.id === record.id && (
                  <Tag color="cyan" className="text-[10px] m-0 px-1 py-0 leading-tight">
                    Bạn
                  </Tag>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                @{record.username} • {record.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Vai Trò (Phân Quyền)',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const isAdmin = role === 'admin';
        return (
          <Tag
            color={isAdmin ? 'error' : 'processing'}
            className="flex items-center gap-1 w-fit font-bold text-xs px-2.5 py-0.5 rounded-full"
          >
            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>{isAdmin ? 'ADMINISTRATOR' : 'USER THƯỜNG'}</span>
          </Tag>
        );
      },
    },
    {
      title: 'Telegram Alert',
      dataIndex: 'telegram_chat_id',
      key: 'telegram_chat_id',
      render: (tg: string | undefined) =>
        tg ? (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <Send className="w-3 h-3" /> {tg}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">Chưa kết nối</span>
        ),
    },
    {
      title: 'Mã Theo Dõi',
      dataIndex: 'positions_count',
      key: 'positions_count',
      align: 'center' as const,
      sorter: (a: UserAdminItem, b: UserAdminItem) => a.positions_count - b.positions_count,
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          overflowCount={999}
          style={{
            backgroundColor: count > 0 ? '#2563eb' : '#94a3b8',
            fontWeight: 600,
          }}
        />
      ),
    },
    {
      title: 'Cảnh Báo Đã Gửi',
      dataIndex: 'alerts_count',
      key: 'alerts_count',
      align: 'center' as const,
      sorter: (a: UserAdminItem, b: UserAdminItem) => a.alerts_count - b.alerts_count,
      render: (count: number) => (
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
          {count} lượt
        </span>
      ),
    },
    {
      title: 'Ngày Tham Gia',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          return (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {d.toLocaleDateString('vi-VN')}
            </span>
          );
        } catch {
          return <span className="text-xs text-slate-500">{dateStr}</span>;
        }
      },
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: UserAdminItem) => {
        const isSelf = currentUser?.id === record.id;
        return (
          <Space size="small">
            <Tooltip title="Chỉnh sửa thông tin & Phân quyền">
              <Button
                type="text"
                size="small"
                icon={<Edit className="w-4 h-4 text-blue-600 hover:text-blue-500" />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
            <Tooltip title={isSelf ? 'Không thể xóa chính tài khoản đang đăng nhập' : 'Xóa tài khoản người dùng'}>
              <Popconfirm
                title="Xác nhận xóa tài khoản?"
                description={`Bạn có chắc muốn xóa vĩnh viễn tài khoản @${record.username}? Toàn bộ danh mục và cảnh báo liên quan sẽ bị xóa.`}
                onConfirm={() => handleDeleteUser(record)}
                okText="Xác nhận xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                disabled={isSelf}
              >
                <Button
                  type="text"
                  danger
                  size="small"
                  disabled={isSelf}
                  icon={<Trash2 className={`w-4 h-4 ${isSelf ? 'text-slate-300' : 'text-rose-600'}`} />}
                />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Trung Tâm Quản Trị Hệ Thống & Người Dùng</span>
                <Tag color="magenta" className="text-[10px] font-bold m-0 px-2 py-0.5 rounded-full uppercase">
                  Admin Portal
                </Tag>
              </div>
              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                Thống kê người dùng toàn hệ thống, cấp quyền & quản lý danh mục thành viên
              </div>
            </div>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={1080}
        footer={null}
        destroyOnClose
        className="admin-modal"
        styles={{ body: { padding: '16px 24px 24px 24px' } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as any)}
          className="mt-2"
          items={[
            {
              key: 'stats',
              label: (
                <span className="flex items-center gap-2 font-semibold text-xs">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  Thống Kê & Tổng Quan
                </span>
              ),
              children: (
                <div className="space-y-6 pt-2">
                  {statsLoading && !stats ? (
                    <div className="py-12 flex items-center justify-center">
                      <Spin size="large" tip="Đang tải dữ liệu thống kê..." />
                    </div>
                  ) : (
                    <>
                      {/* Top KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">Tổng Thành Viên</span>
                            <Users className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white mono-font">
                            {stats?.total_users || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Tất cả tài khoản hệ thống</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">Quản Trị Viên</span>
                            <ShieldCheck className="w-4 h-4 text-rose-500" />
                          </div>
                          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mono-font">
                            {stats?.total_admins || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Quyền Admin tối cao</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">User Thường</span>
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mono-font">
                            {stats?.total_regular_users || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Nhà đầu tư cá nhân</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">Vị Thế Đang Quét</span>
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mono-font">
                            {stats?.total_positions_tracked || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Mã CP trong danh mục</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">Alert Đã Bắn</span>
                            <Send className="w-4 h-4 text-amber-500" />
                          </div>
                          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mono-font">
                            {stats?.total_alerts_sent || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Qua Telegram bot</div>
                        </Card>
                      </div>

                      {/* Chart & Top Users Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* User Growth Chart */}
                        <Card
                          className="lg:col-span-7 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                          bodyStyle={{ padding: '16px' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-purple-600" />
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase">
                                Tăng Trưởng Thành Viên Theo Thời Gian
                              </span>
                            </div>
                            <Tag color="purple" className="text-[10px] font-mono">
                              Tích lũy
                            </Tag>
                          </div>

                          <div className="h-56 w-full">
                            {stats?.user_growth && stats.user_growth.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.user_growth}>
                                  <defs>
                                    <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 10, fill: '#64748b' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                  />
                                  <RechartsTooltip
                                    formatter={(value: any) => [`${value} người dùng`, 'Tổng thành viên']}
                                    labelFormatter={(label) => `Thời điểm: ${label}`}
                                    contentStyle={{
                                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                      borderRadius: '8px',
                                      border: '1px solid #334155',
                                      color: '#fff',
                                      fontSize: '11px',
                                    }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="users_count"
                                    stroke="#8b5cf6"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#userGrowthGrad)"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                Chưa có dữ liệu lịch sử
                              </div>
                            )}
                          </div>
                        </Card>

                        {/* Top Active Users */}
                        <Card
                          className="lg:col-span-5 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                          bodyStyle={{ padding: '16px' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase">
                                Top Thành Viên Tích Cực
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">Theo số lượng mã CP</span>
                          </div>

                          <div className="space-y-2.5">
                            {stats?.top_users && stats.top_users.length > 0 ? (
                              stats.top_users.map((u, idx) => (
                                <div
                                  key={u.id}
                                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                                      #{idx + 1}
                                    </div>
                                    <div>
                                      <div className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <span>{u.full_name || u.username}</span>
                                        {u.role === 'admin' && (
                                          <Tag color="red" className="text-[9px] m-0 px-1 py-0">
                                            Admin
                                          </Tag>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        @{u.username}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                      {u.positions_count} mã CP
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {u.alerts_count} cảnh báo
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-400">
                                Chưa có dữ liệu thành viên
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'users',
              label: (
                <span className="flex items-center gap-2 font-semibold text-xs">
                  <Users className="w-4 h-4 text-blue-600" />
                  Danh Sách & Phân Quyền Người Dùng
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <Input
                        prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
                        placeholder="Tìm username, email, họ tên..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full sm:w-64 text-xs"
                        allowClear
                      />
                      <Select
                        value={roleFilter}
                        onChange={(v) => setRoleFilter(v)}
                        className="w-36 text-xs"
                        options={[
                          { label: 'Tất cả vai trò', value: 'all' },
                          { label: 'Quản trị viên (Admin)', value: 'admin' },
                          { label: 'Người dùng (User)', value: 'user' },
                        ]}
                      />
                      <Button
                        type="default"
                        size="middle"
                        icon={<RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />}
                        onClick={loadUsers}
                        className="text-xs"
                      >
                        Làm mới
                      </Button>
                    </div>

                    <Button
                      type="primary"
                      icon={<UserPlus className="w-4 h-4" />}
                      onClick={() => {
                        createForm.resetFields();
                        setCreateModalVisible(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 font-semibold shadow-sm w-full sm:w-auto"
                    >
                      Thêm Người Dùng Mới
                    </Button>
                  </div>

                  {/* Users Table */}
                  <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={usersLoading}
                    pagination={{
                      pageSize: 8,
                      showSizeChanger: false,
                      showTotal: (total) => `Tổng cộng ${total} người dùng`,
                    }}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                    size="middle"
                  />
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Modal: Create User */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-sm">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Tạo Tài Khoản Người Dùng Mới</span>
          </div>
        }
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{ role: 'user' }}
          className="pt-2 space-y-3"
        >
          <Form.Item
            name="username"
            label={<span className="text-xs font-semibold">Tên đăng nhập (Username)</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập username' },
              { min: 3, message: 'Tối thiểu 3 ký tự' },
            ]}
          >
            <Input placeholder="VD: nguyenvan_a" />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span className="text-xs font-semibold">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập địa chỉ email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="VD: user@domain.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-xs font-semibold">Mật khẩu khởi tạo</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Tối thiểu 6 ký tự' },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu..." />
          </Form.Item>

          <Form.Item
            name="full_name"
            label={<span className="text-xs font-semibold">Họ và tên (Tùy chọn)</span>}
          >
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span className="text-xs font-semibold">Vai trò / Phân quyền</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Người dùng thông thường (User)', value: 'user' },
                { label: 'Quản trị viên hệ thống (Admin)', value: 'admin' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="telegram_chat_id"
            label={<span className="text-xs font-semibold">Telegram Chat ID (Tùy chọn)</span>}
          >
            <Input placeholder="VD: 123456789" />
          </Form.Item>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setCreateModalVisible(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createSubmitting}
              className="bg-blue-600 hover:bg-blue-500 font-semibold"
            >
              Tạo Người Dùng
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Edit User & Change Role */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-sm">
            <Edit className="w-4 h-4 text-blue-600" />
            <span>Chỉnh Sửa & Phân Quyền: @{editingUser?.username}</span>
          </div>
        }
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingUser(null);
        }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditSubmit}
          className="pt-2 space-y-3"
        >
          <Form.Item
            name="full_name"
            label={<span className="text-xs font-semibold">Họ và tên</span>}
          >
            <Input placeholder="Họ và tên người dùng" />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span className="text-xs font-semibold">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span className="text-xs font-semibold">Vai trò / Phân quyền</span>}
            rules={[{ required: true }]}
            help={
              editingUser?.id === currentUser?.id ? (
                <span className="text-[11px] text-amber-500">
                  Lưu ý: Bạn đang chỉnh sửa tài khoản của chính mình.
                </span>
              ) : undefined
            }
          >
            <Select
              options={[
                { label: 'Người dùng thông thường (User)', value: 'user' },
                { label: 'Quản trị viên hệ thống (Admin)', value: 'admin' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="telegram_chat_id"
            label={<span className="text-xs font-semibold">Telegram Chat ID</span>}
          >
            <Input placeholder="Telegram Chat ID" />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-xs font-semibold">Đặt lại mật khẩu mới (Để trống nếu giữ nguyên)</span>}
            rules={[{ min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}
          >
            <Input.Password placeholder="Nhập mật khẩu mới nếu muốn đổi..." />
          </Form.Item>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              onClick={() => {
                setEditModalVisible(false);
                setEditingUser(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editSubmitting}
              className="bg-blue-600 hover:bg-blue-500 font-semibold"
            >
              Lưu Thay Đổi
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};
