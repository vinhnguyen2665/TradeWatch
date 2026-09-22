import React, { useEffect, useState, useCallback } from 'react';
import { ConfigProvider, theme, message, Layout } from 'antd';
import { HeaderStats } from './components/HeaderStats';
import { PositionTable } from './components/PositionTable';
import { PositionModal } from './components/PositionModal';
import { HistoryChartModal } from './components/HistoryChartModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ScreenerModal } from './components/ScreenerModal';
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

export const App: React.FC = () => {
  // Theme mode: Default to 'light', load preference from localStorage if previously saved
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('tradewatch_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const [historyPosition, setHistoryPosition] = useState<PortfolioPosition | null>(null);
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [screenerVisible, setScreenerVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

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

  // Load Data
  const loadData = useCallback(async (silent: boolean = false) => {
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
  }, []);

  useEffect(() => {
    loadData();

    // Thiết lập chu kỳ refresh tự động phía giao diện đồng bộ với scheduler
    const interval = setInterval(() => {
      loadData(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadData]);

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

  const handleSavePosition = async (data: PositionFormData) => {
    setSubmitting(true);
    try {
      await savePosition(data);
      message.success(
        editingPosition
          ? `Đã cập nhật vị thế ${data.ticker}`
          : `Đã thêm ${data.ticker} vào danh mục theo dõi`
      );
      setAddModalVisible(false);
      setEditingPosition(null);
      await loadData();
    } catch (err) {
      message.error('Lỗi khi lưu vị thế cổ phiếu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePosition = async (ticker: string) => {
    try {
      await deletePosition(ticker);
      message.success(`Đã xóa ${ticker} khỏi danh mục`);
      await loadData();
    } catch (err) {
      message.error('Lỗi khi xóa vị thế');
    }
  };

  const handleToggleActive = async (ticker: string, active: boolean) => {
    try {
      await updatePosition(ticker, { is_active: active });
      message.success(`Đã ${active ? 'bật' : 'tắt'} theo dõi cho ${ticker}`);
      await loadData(true);
    } catch (err) {
      message.error('Lỗi khi thay đổi trạng thái theo dõi');
    }
  };

  const handleViewHistory = (ticker: string) => {
    const pos = positions.find((p) => p.ticker === ticker) || null;
    setHistoryTicker(ticker);
    setHistoryPosition(pos);
  };

  const handleEditPosition = (pos: PortfolioPosition) => {
    setEditingPosition(pos);
    setAddModalVisible(true);
  };

  const handleQuickAddFromScreener = (signal: ScreenerSignal) => {
    setEditingPosition(null);
    setAddModalVisible(true);
    setTimeout(() => {
      setEditingPosition({
        ticker: signal.ticker,
        company_name: signal.name,
        buy_price: signal.price,
        quantity: 1000,
        tp_pct: 7.0,
        sl_pct: 5.0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }, 50);
  };

  const isDark = themeMode === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2563EB',
          colorBgBase: isDark ? '#0B0F19' : '#FFFFFF',
          colorBgContainer: isDark ? '#111827' : '#FFFFFF',
          colorBorder: isDark ? '#1E293B' : '#E2E8F0',
          colorText: isDark ? '#F1F5F9' : '#0F172A',
          borderRadius: 10,
          fontFamily: "'Inter', sans-serif",
        },
      }}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 transition-colors duration-200">
        <div className="max-w-[90%] mx-auto space-y-6">
          {/* Header & KPI Stats */}
          <HeaderStats
            summary={summary}
            loading={loading}
            themeMode={themeMode}
            onToggleTheme={handleToggleTheme}
            onRefresh={() => loadData(false)}
            onToggleBot={handleToggleBot}
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenScreener={() => setScreenerVisible(true)}
            onOpenAddModal={() => {
              setEditingPosition(null);
              setAddModalVisible(true);
            }}
          />

          {/* Main Portfolio Table */}
          <PositionTable
            positions={positions}
            loading={loading}
            onViewHistory={handleViewHistory}
            onEdit={handleEditPosition}
            onDelete={handleDeletePosition}
            onToggleActive={handleToggleActive}
          />
        </div>

        {/* Modals & Drawers */}
        <PositionModal
          visible={addModalVisible}
          editingPosition={editingPosition}
          onCancel={() => {
            setAddModalVisible(false);
            setEditingPosition(null);
          }}
          onSubmit={handleSavePosition}
          loading={submitting}
        />

        <HistoryChartModal
          visible={!!historyTicker}
          ticker={historyTicker}
          position={historyPosition}
          onClose={() => {
            setHistoryTicker(null);
            setHistoryPosition(null);
          }}
        />

        <SettingsDrawer
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onSettingsUpdated={() => loadData(true)}
        />

        <ScreenerModal
          visible={screenerVisible}
          onClose={() => setScreenerVisible(false)}
          onQuickAdd={handleQuickAddFromScreener}
        />
      </div>
    </ConfigProvider>
  );
};

export default App;
