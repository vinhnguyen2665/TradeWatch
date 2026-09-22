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
import { useLanguage } from '../context/LanguageContext';
import { USER_ROLES, ROLE_LABELS } from '../constants';

interface AdminUserManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const { user: currentUser } = useAuth();
  const { t, language } = useLanguage();
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
      title: t('adminUsers.colUser'),
      key: 'user_info',
      render: (_: any, record: UserAdminItem) => {
        const initial = (record.username || 'U').charAt(0).toUpperCase();
        const isAdmin = record.role === USER_ROLES.ADMIN;
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
                    {t('common.user')} (You)
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
      title: t('adminUsers.colRole'),
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const isAdmin = role === USER_ROLES.ADMIN;
        return (
          <Tag
            color={isAdmin ? 'error' : 'processing'}
            className="flex items-center gap-1 w-fit font-bold text-xs px-2.5 py-0.5 rounded-full"
          >
            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>{isAdmin ? ROLE_LABELS.ADMIN : ROLE_LABELS.USER}</span>
          </Tag>
        );
      },
    },
    {
      title: t('adminUsers.colTelegram'),
      dataIndex: 'telegram_chat_id',
      key: 'telegram_chat_id',
      render: (tg: string | undefined) =>
        tg ? (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <Send className="w-3 h-3" /> {tg}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">{t('header.noData')}</span>
        ),
    },
    {
      title: t('adminUsers.colPositions'),
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
      title: t('adminUsers.alertsSent'),
      dataIndex: 'alerts_count',
      key: 'alerts_count',
      align: 'center' as const,
      sorter: (a: UserAdminItem, b: UserAdminItem) => a.alerts_count - b.alerts_count,
      render: (count: number) => (
        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
          {count}
        </span>
      ),
    },
    {
      title: t('adminUsers.colCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          return (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
            </span>
          );
        } catch {
          return <span className="text-xs text-slate-500">{dateStr}</span>;
        }
      },
    },
    {
      title: t('adminUsers.colActions'),
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: UserAdminItem) => {
        const isSelf = currentUser?.id === record.id;
        return (
          <Space size="small">
            <Tooltip title={t('common.edit')}>
              <Button
                type="text"
                size="small"
                icon={<Edit className="w-4 h-4 text-blue-600 hover:text-blue-500" />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
            <Tooltip title={isSelf ? 'Self' : t('common.delete')}>
              <Popconfirm
                title={t('portfolio.deleteConfirmTitle')}
                description={`@${record.username}`}
                onConfirm={() => handleDeleteUser(record)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
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
                <span>{t('adminUsers.title')}</span>
                <Tag color="magenta" className="text-[10px] font-bold m-0 px-2 py-0.5 rounded-full uppercase">
                  {ROLE_LABELS.ADMIN}
                </Tag>
              </div>
              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {t('adminUsers.subtitle')}
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
                  {t('adminUsers.tabStats')}
                </span>
              ),
              children: (
                <div className="space-y-6 pt-2">
                  {statsLoading && !stats ? (
                    <div className="py-12 flex items-center justify-center">
                      <Spin size="large" tip={t('common.loading')} />
                    </div>
                  ) : (
                    <>
                      {/* Top KPI Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('adminUsers.totalUsers')}</span>
                            <Users className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white mono-font">
                            {stats?.total_users || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t('adminUsers.totalUsers')}</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('adminUsers.activeAdmins')}</span>
                            <ShieldCheck className="w-4 h-4 text-rose-500" />
                          </div>
                          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mono-font">
                            {stats?.total_admins || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{ROLE_LABELS.ADMIN}</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('adminUsers.roleUser')}</span>
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mono-font">
                            {stats?.total_regular_users || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{ROLE_LABELS.USER}</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('adminUsers.trackedPositions')}</span>
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mono-font">
                            {stats?.total_positions_tracked || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t('adminUsers.trackedPositions')}</div>
                        </Card>

                        <Card className="rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shadow-sm" bodyStyle={{ padding: '14px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('adminUsers.alertsSent')}</span>
                            <Send className="w-4 h-4 text-amber-500" />
                          </div>
                          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mono-font">
                            {stats?.total_alerts_sent || 0}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{t('adminUsers.alertsSent')}</div>
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
                                {t('adminUsers.growthChart')}
                              </span>
                            </div>
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
                                    formatter={(value: any) => [`${value}`, t('adminUsers.totalUsers')]}
                                    labelFormatter={(label) => `${label}`}
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
                                {t('header.noData')}
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
                                Top Users
                              </span>
                            </div>
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
                                        {u.role === USER_ROLES.ADMIN && (
                                          <Tag color="red" className="text-[9px] m-0 px-1 py-0">
                                            {ROLE_LABELS.ADMIN}
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
                                      {u.positions_count} {t('header.stocksUnit')}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {u.alerts_count} alerts
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-400">
                                {t('header.noData')}
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
                  {t('adminUsers.tabUsers')}
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <Input
                        prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
                        placeholder={t('adminUsers.searchPlaceholder')}
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
                          { label: t('adminUsers.allRoles'), value: 'all' },
                          { label: t('adminUsers.roleAdmin'), value: USER_ROLES.ADMIN },
                          { label: t('adminUsers.roleUser'), value: USER_ROLES.USER },
                        ]}
                      />
                      <Button
                        type="default"
                        size="middle"
                        icon={<RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />}
                        onClick={loadUsers}
                        className="text-xs"
                      >
                        {t('common.refresh')}
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
                      {t('adminUsers.createUserBtn')}
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
            <span>{t('adminUsers.createUserBtn')}</span>
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
          initialValues={{ role: USER_ROLES.USER }}
          className="pt-2 space-y-3"
        >
          <Form.Item
            name="username"
            label={<span className="text-xs font-semibold">{t('auth.username')}</span>}
            rules={[
              { required: true, message: t('auth.username') },
              { min: 3, message: 'Min 3 chars' },
            ]}
          >
            <Input placeholder="VD: nguyenvan_a" />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span className="text-xs font-semibold">{t('auth.email')}</span>}
            rules={[
              { required: true, message: t('auth.email') },
              { type: 'email', message: 'Email invalid' },
            ]}
          >
            <Input placeholder="VD: user@domain.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-xs font-semibold">{t('auth.password')}</span>}
            rules={[
              { required: true, message: t('auth.password') },
              { min: 6, message: 'Min 6 chars' },
            ]}
          >
            <Input.Password placeholder={t('auth.password')} />
          </Form.Item>

          <Form.Item
            name="full_name"
            label={<span className="text-xs font-semibold">{t('auth.fullName')}</span>}
          >
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span className="text-xs font-semibold">{t('adminUsers.colRole')}</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: t('adminUsers.roleUser'), value: USER_ROLES.USER },
                { label: t('adminUsers.roleAdmin'), value: USER_ROLES.ADMIN },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="telegram_chat_id"
            label={<span className="text-xs font-semibold">{t('auth.telegramChatId')}</span>}
          >
            <Input placeholder="VD: 123456789" autoComplete="off" spellCheck={false} />
          </Form.Item>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setCreateModalVisible(false)}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createSubmitting}
              className="bg-blue-600 hover:bg-blue-500 font-semibold"
            >
              {t('common.create')}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal: Edit User & Change Role */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-sm">
            <Edit className="w-4 h-4 text-blue-600" />
            <span>{t('common.edit')}: @{editingUser?.username}</span>
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
            label={<span className="text-xs font-semibold">{t('auth.fullName')}</span>}
          >
            <Input placeholder="Họ và tên người dùng" />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span className="text-xs font-semibold">{t('auth.email')}</span>}
            rules={[
              { required: true, message: t('auth.email') },
              { type: 'email', message: 'Email invalid' },
            ]}
          >
            <Input placeholder="Email" />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span className="text-xs font-semibold">{t('adminUsers.colRole')}</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: t('adminUsers.roleUser'), value: USER_ROLES.USER },
                { label: t('adminUsers.roleAdmin'), value: USER_ROLES.ADMIN },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="telegram_chat_id"
            label={<span className="text-xs font-semibold">{t('auth.telegramChatId')}</span>}
          >
            <Input placeholder="Telegram Chat ID" autoComplete="off" spellCheck={false} />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-xs font-semibold">{t('auth.password')}</span>}
            rules={[{ min: 6, message: 'Min 6 chars' }]}
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
              {t('common.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editSubmitting}
              className="bg-blue-600 hover:bg-blue-500 font-semibold"
            >
              {t('common.save')}
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};
