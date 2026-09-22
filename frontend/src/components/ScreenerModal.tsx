import React, { useEffect, useState } from 'react';
import { Modal, Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Sparkles,
  TrendingUp,
  Flame,
  Activity,
  PlusCircle,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { ScreenerSignal } from '../types';
import { getScreenerSuggestions } from '../services/api';

interface ScreenerModalProps {
  visible: boolean;
  onClose: () => void;
  onQuickAdd: (signal: ScreenerSignal) => void;
}

export const ScreenerModal: React.FC<ScreenerModalProps> = ({
  visible,
  onClose,
  onQuickAdd,
}) => {
  const [signals, setSignals] = useState<ScreenerSignal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadSignals();
    }
  }, [visible]);

  const loadSignals = async () => {
    setLoading(true);
    try {
      const data = await getScreenerSuggestions();
      setSignals(data);
    } catch (err) {
      console.error('Failed to load screener signals:', err);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ScreenerSignal> = [
    {
      title: 'Mã CP',
      dataIndex: 'ticker',
      key: 'ticker',
      width: 150,
      render: (ticker: string, record: ScreenerSignal) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 dark:text-white mono-font text-base">{ticker}</span>
            <Tag color="blue" className="text-[10px] px-1 py-0 border-0">
              {record.exchange || 'HOSE'}
            </Tag>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">{record.name}</span>
        </div>
      ),
    },
    {
      title: 'Giá (x1K)',
      dataIndex: 'price',
      key: 'price',
      width: 110,
      render: (price: number, record: ScreenerSignal) => {
        const isUp = record.change_pct >= 0;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white mono-font">{price.toFixed(2)}</span>
            <span className={`text-xs mono-font ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isUp ? '+' : ''}{record.change_pct.toFixed(2)}%
            </span>
          </div>
        );
      },
    },
    {
      title: 'Khối lượng / SMA20',
      key: 'volume',
      width: 160,
      render: (_, record: ScreenerSignal) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 dark:text-white font-semibold mono-font text-xs">
              {(record.volume / 1000).toLocaleString('vi-VN')}K
            </span>
            <Tag color={record.volume_spike_ratio >= 1.5 ? 'orange' : 'default'} className="text-[10px] px-1 py-0 border-0 font-bold">
              {record.volume_spike_ratio}x Vol
            </Tag>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mono-font">
            SMA20: {(record.sma20_volume / 1000).toLocaleString('vi-VN')}K
          </span>
        </div>
      ),
    },
    {
      title: 'Chỉ báo Kỹ thuật',
      key: 'indicators',
      width: 150,
      render: (_, record: ScreenerSignal) => (
        <div className="space-y-1 text-xs mono-font">
          {record.rsi_14 !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">RSI(14):</span>
              <span className={`font-bold ${record.rsi_14 < 35 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {record.rsi_14.toFixed(1)}
              </span>
            </div>
          )}
          {record.ma_20 !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">MA20:</span>
              <span className="text-blue-600 dark:text-blue-300 font-bold">{record.ma_20.toFixed(2)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tín hiệu & Lý do',
      key: 'reason',
      render: (_, record: ScreenerSignal) => {
        let icon = <Zap className="w-3.5 h-3.5 mr-1" />;
        let label = 'TÍN HIỆU';

        if (record.signal_type === 'VOLUME_BREAKOUT') {
          icon = <Flame className="w-3.5 h-3.5 mr-1 text-orange-500" />;
          label = 'ĐỘT BIẾN KHỐI LƯỢNG';
        } else if (record.signal_type === 'RSI_OVERSOLD_REBOUND') {
          icon = <Activity className="w-3.5 h-3.5 mr-1 text-purple-500" />;
          label = 'RSI ĐẢO CHIỀU ĐÁY';
        } else if (record.signal_type === 'MA20_BREAKOUT') {
          icon = <TrendingUp className="w-3.5 h-3.5 mr-1 text-cyan-500" />;
          label = 'VƯỢT MA20';
        }

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white">
                {icon} {label}
              </span>
              {record.signal_strength === 'STRONG' && (
                <Tag color="red" className="text-[10px] px-1 font-extrabold border-0 animate-pulse">
                  STRONG
                </Tag>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{record.reason}</p>
          </div>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 140,
      render: (_, record: ScreenerSignal) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusCircle className="w-3.5 h-3.5" />}
          onClick={() => {
            onQuickAdd(record);
            onClose();
          }}
          className="bg-emerald-600 hover:bg-emerald-500 font-semibold flex items-center gap-1 text-xs"
        >
          Theo dõi
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-lg">Bộ Lọc Gợi Ý Cổ Phiếu Tiềm Năng</span>
          </div>
          <Button
            size="small"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadSignals}
          >
            Quét lại
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      <div className="mt-4 space-y-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Tiêu chí: 🚀 <b>Khối lượng đột biến</b> ($Vol \ge 1.5 \times SMA20$) • 💡 <b>RSI(14) quá bán hồi phục</b> • 📈 <b>Phá vỡ cản MA20</b></span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{signals.length} tín hiệu tìm thấy</span>
        </div>

        <Table
          columns={columns}
          dataSource={signals}
          rowKey="ticker"
          loading={loading}
          pagination={{ pageSize: 6 }}
          className="custom-financial-table"
          locale={{
            emptyText: (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                Không tìm thấy tín hiệu bùng nổ nào trong watchlist lúc này.
              </div>
            ),
          }}
        />
      </div>
    </Modal>
  );
};
