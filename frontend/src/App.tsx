import React, { useEffect, useState, useCallback } from 'react';
import { ConfigProvider, theme, message, Layout, Spin } from 'antd';
import { HeaderStats } from './components/HeaderStats';
import { PositionTable } from './components/PositionTable';
import { PositionModal } from './components/PositionModal';
import { HistoryChartModal } from './components/HistoryChartModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ScreenerModal } from './components/ScreenerModal';
import { LandingPage } from './components/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  PortfolioPosition,
  DashboardSummary,
  PositionFormData,
  ScreenerSignal,
} from './types';
import {
  getDashboardSummary,
  getPositions,
  savePosition,
  updatePosition,
  deletePosition,
  toggleBotStatus,
} from './services/api';

const DashboardView: React.FC<{
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}> = ({ themeMode, onToggleTheme }) => {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null);
  const [initialFormData, setInitialFormData] = useState<Partial<PositionFormData> | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const [historyPosition, setHistoryPosition] = useState<PortfolioPosition | null>(null);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [screenerVisible, setScreenerVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load Data
  const loadData = useCallback(async (silent: boolean = false) => {
    if (!isAuthenticated) return;
    if (!silent) setLoading(true);
    try {
      const [sumData, posData] = await Promise.all([
        getDashboardSummary(),
        getPositions(),
      ]);
      setSummary(sumData);
      setPositions(posData);
    } catch (err) {
      console.error('Failed to load portfolio data:', err);
      if (!silent) message.error('Không thể kết nối đến máy chủ TradeWatch');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();

      // Chu kỳ refresh tự động phía giao diện đồng bộ với scheduler
      const interval = setInterval(() => {
        loadData(true);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadData]);

  // Handlers
  const handleToggleBot = async () => {
    try {
      const res = await toggleBotStatus();
      message.info(res.message);
      loadData(true);
    } catch (err) {
      message.error('Lỗi khi chuyển trạng thái Bot');
    }
  };

  const handleSavePosition = async (data: PositionFormData, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingPosition) {
        await updatePosition(editingPosition.ticker, data);
        message.success(`Cập nhật mã ${data.ticker} thành công!`);
      } else {
        await savePosition(data);
        message.success(`Thêm mã ${data.ticker} vào danh mục thành công!`);
      }
      setAddModalVisible(false);
      setEditingPosition(null);
      setInitialFormData(null);
      setIsEditMode(false);
      loadData(true);
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi lưu vị thế');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPosition = (pos: PortfolioPosition) => {
    setEditingPosition(pos);
    setInitialFormData(null);
    setIsEditMode(true);
    setAddModalVisible(true);
  };

  const handleDeletePosition = async (ticker: string) => {
    try {
      await deletePosition(ticker);
      message.success(`Đã xóa mã ${ticker} khỏi danh mục`);
      loadData(true);
    } catch (err) {
      message.error('Lỗi khi xóa mã cổ phiếu');
    }
  };

  const handleViewChart = (ticker: string) => {
    const pos = positions.find((p) => p.ticker === ticker) || null;
    setHistoryTicker(ticker);
    setHistoryPosition(pos);
  };

  const handleToggleActive = async (ticker: string, active: boolean) => {
    try {
      await updatePosition(ticker, { is_active: active });
      message.success(`Đã ${active ? 'bật' : 'tắt'} theo dõi mã ${ticker}`);
      loadData(true);
    } catch (err) {
      message.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleQuickAdd = (signal: ScreenerSignal) => {
    setEditingPosition(null);
    setInitialFormData({
      ticker: signal.ticker,
      company_name: signal.name,
      buy_price: signal.price,
      quantity: 100,
      tp_pct: 7.0,
      sl_pct: 5.0,
      is_active: true,
    });
    setIsEditMode(false);
    setScreenerVisible(false);
    setAddModalVisible(true);
  };

  return (
    <Layout className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      <Layout.Content className="w-full max-w-[90%] mx-auto px-4 py-8 space-y-8">
        {/* Header & KPI Summary */}
        <HeaderStats
          summary={summary}
          loading={loading}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
          onRefresh={() => loadData(false)}
          onToggleBot={handleToggleBot}
          onOpenSettings={() => setSettingsVisible(true)}
          onOpenScreener={() => setScreenerVisible(true)}
          onOpenAddModal={() => {
            setEditingPosition(null);
            setInitialFormData(null);
            setIsEditMode(false);
            setAddModalVisible(true);
          }}
        />

        {/* Portfolio Table */}
        <PositionTable
          positions={positions}
          loading={loading}
          onEdit={handleEditPosition}
          onDelete={handleDeletePosition}
          onViewHistory={handleViewChart}
          onToggleActive={handleToggleActive}
        />
      </Layout.Content>

      {/* Add / Edit Position Modal */}
      <PositionModal
        visible={addModalVisible}
        editingPosition={editingPosition}
        initialData={initialFormData}
        isEdit={isEditMode}
        onCancel={() => {
          setAddModalVisible(false);
          setEditingPosition(null);
          setInitialFormData(null);
          setIsEditMode(false);
        }}
        onSubmit={handleSavePosition}
        loading={submitting}
      />


      {/* Price History Chart Modal */}
      <HistoryChartModal
        ticker={historyTicker}
        position={historyPosition}
        visible={!!historyTicker}
        onClose={() => {
          setHistoryTicker(null);
          setHistoryPosition(null);
        }}
      />

      {/* Technical Screener Modal */}
      <ScreenerModal
        visible={screenerVisible}
        onClose={() => setScreenerVisible(false)}
        onQuickAdd={handleQuickAdd}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSettingsUpdated={() => loadData(true)}
      />
    </Layout>
  );

};

const AppContent: React.FC = () => {
  // Theme mode: Default to 'light', load preference from localStorage if previously saved
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('tradewatch_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const { isAuthenticated, loading } = useAuth();

  // Sync theme with HTML root class
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('tradewatch_theme', themeMode);
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = themeMode === 'dark';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spin size="large" tip="Đang tải TradeWatch..." />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563eb', // Indigo-600
          borderRadius: 12,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          colorBgContainer: isDark ? '#0f172a' : '#ffffff',
          colorBgElevated: isDark ? '#1e293b' : '#ffffff',
          colorBorder: isDark ? '#334155' : '#e2e8f0',
        },
      }}
    >
      {!isAuthenticated ? (
        <LandingPage themeMode={themeMode} onToggleTheme={handleToggleTheme} />
      ) : (
        <DashboardView themeMode={themeMode} onToggleTheme={handleToggleTheme} />
      )}
    </ConfigProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
