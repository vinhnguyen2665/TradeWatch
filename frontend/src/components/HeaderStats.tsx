import React from 'react';
import { Card, Button, Badge, Tag, Tooltip } from 'antd';
import {
  PlayCircle,
  PauseCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  SlidersHorizontal,
  Sparkles,
  PlusCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { DashboardSummary } from '../types';

interface HeaderStatsProps {
  summary: DashboardSummary | null;
  loading: boolean;
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onRefresh: () => void;
  onToggleBot: () => void;
  onOpenSettings: () => void;
  onOpenScreener: () => void;
  onOpenAddModal: () => void;
}

export const HeaderStats: React.FC<HeaderStatsProps> = ({
  summary,
  loading,
  themeMode,
  onToggleTheme,
  onRefresh,
  onToggleBot,
  onOpenSettings,
  onOpenScreener,
  onOpenAddModal,
}) => {
  const isRunning = summary?.bot_status === 'RUNNING';
  const isDark = themeMode === 'dark';
  const totalPnl = summary?.total_pnl_value ?? 0;
  const totalPnlPct = summary?.total_pnl_pct ?? 0;
  const isProfit = totalPnl >= 0;

  return (
    <div className="space-y-6">
      {/* Top Navbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl transition-colors">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                TradeWatch Pro
              </h1>
              <Badge
                status={isRunning ? 'processing' : 'default'}
                color={isRunning ? '#10B981' : '#64748B'}
                text={
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isRunning
                      ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                    {isRunning ? 'BOT RUNNING' : 'BOT PAUSED'}
                  </span>
                }
              />
              {summary?.market_status && (
                <Tooltip
                  title={
                    <div className="space-y-1.5 text-xs p-1">
                      <div className="font-bold text-amber-300">Khung Giờ Giao Dịch Chứng Khoán VN:</div>
                      <div>• <b>Phiên Sáng:</b> 09:00 – 11:30 (ATO 09:00–09:15 HOSE)</div>
                      <div>• <b>Nghỉ Trưa:</b> 11:30 – 13:00</div>
                      <div>• <b>Phiên Chiều:</b> 13:00 – 15:00 (ATC 14:30–14:45, PLO đến 15:00)</div>
                      <div>• <b>T2 - T6:</b> Tự động quét theo giờ giao dịch</div>
                      <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-700">
                        {summary.market_status.description}
                      </div>
                    </div>
                  }
                >
                  <span className={`cursor-help text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border transition-all ${
                    summary.market_status.is_open
                      ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700/60 animate-pulse'
                      : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${summary.market_status.is_open ? 'bg-blue-600 dark:bg-blue-400' : 'bg-amber-500'}`}></span>
                    <span>{summary.market_status.session_name}</span>
                  </span>
                </Tooltip>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Giám sát danh mục tự động (HOSE/HNX/UPCoM) • Chu kỳ: <span className="text-blue-600 dark:text-blue-400 font-semibold">{summary?.polling_interval_sec || 30}s</span>
              {summary?.trade_hours_only && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">• Chỉ quét trong giờ giao dịch</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Theme Mode Toggle Button */}
          <Tooltip title={isDark ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}>
            <Button
              type="default"
              icon={isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 font-medium border-slate-200 dark:border-slate-700 hover:border-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {isDark ? 'Sáng' : 'Tối'}
            </Button>
          </Tooltip>

          <Tooltip title={isRunning ? 'Tạm dừng giám sát' : 'Tiếp tục giám sát'}>
            <Button
              type={isRunning ? 'default' : 'primary'}
              danger={isRunning}
              icon={isRunning ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              onClick={onToggleBot}
              className="flex items-center gap-1.5 font-medium shadow-sm"
            >
              {isRunning ? 'Tạm dừng Bot' : 'Bật Bot'}
            </Button>
          </Tooltip>

          <Button
            type="default"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-500 bg-white dark:bg-slate-800"
          >
            Làm mới
          </Button>

          <Button
            type="default"
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            onClick={onOpenScreener}
            className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 hover:border-amber-400 bg-amber-50 dark:bg-amber-950/20 font-medium"
          >
            Gợi ý Mã Kỹ thuật
          </Button>

          <Button
            type="default"
            icon={<SlidersHorizontal className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-500 bg-white dark:bg-slate-800"
          >
            Cài đặt
          </Button>

          <Button
            type="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 font-semibold"
          >
            Thêm Mã Mới
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Positions */}
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Danh mục nắm giữ</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white mono-font">{summary?.total_positions ?? 0}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">mã ({summary?.active_positions ?? 0} active)</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Card 2: Portfolio Value */}
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Giá trị Danh mục</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white mono-font">
                  {summary ? ((summary.current_portfolio_value * 1000) / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '0'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Triệu VNĐ</span>
              </div>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-200 dark:border-indigo-500/20">
              <DollarSign className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </Card>

        {/* Card 3: Total PnL */}
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Tổng Lãi / Lỗ</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold mono-font ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {isProfit ? '+' : ''}{totalPnlPct.toFixed(2)}%
                </span>
                <Tag color={isProfit ? 'green' : 'red'} className="text-[11px] font-semibold border-0">
                  {isProfit ? '+' : ''}{((totalPnl * 1000) / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Tr
                </Tag>
              </div>
            </div>
            <div className={`p-3 rounded-xl border ${isProfit ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'}`}>
              {isProfit ? <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />}
            </div>
          </div>
        </Card>

        {/* Card 4: Top Performer */}
        <Card className="bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Top Tăng / Giảm</p>
              <div className="flex items-center justify-between mt-1.5 pr-2">
                {summary?.top_gainer ? (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">{summary.top_gainer.ticker}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm mono-font">
                      +{(summary.top_gainer.pnl_pct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Chưa có dữ liệu</span>
                )}

                {summary?.top_loser && summary.top_loser.ticker !== summary.top_gainer?.ticker && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">{summary.top_loser.ticker}</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold text-sm mono-font">
                      {(summary.top_loser.pnl_pct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
