import React from 'react';
import { Table, Tag, Button, Switch, Popconfirm, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  LineChart,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { PortfolioPosition } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PositionTableProps {
  positions: PortfolioPosition[];
  loading: boolean;
  onViewHistory: (ticker: string) => void;
  onEdit: (position: PortfolioPosition) => void;
  onDelete: (ticker: string) => void;
  onToggleActive: (ticker: string, active: boolean) => void;
}

export const PositionTable: React.FC<PositionTableProps> = ({
  positions,
  loading,
  onViewHistory,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const { language, t } = useLanguage();
  const columns: ColumnsType<PortfolioPosition> = [
    {
      title: `${t('portfolio.colTicker')} & ${t('portfolio.colCompany')}`,
      dataIndex: 'ticker',
      key: 'ticker',
      fixed: 'left',
      width: 220,
      render: (ticker: string, record: PortfolioPosition) => {
        const isTriggeredTP = record.status === 'TAKE_PROFIT_TRIGGERED';
        const isTriggeredSL = record.status === 'STOP_LOSS_TRIGGERED';

        return (
          <div className="flex flex-col max-w-[210px]">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wide text-slate-900 dark:text-white mono-font">
                {ticker}
              </span>
              {isTriggeredTP && (
                <Tooltip title={t('portfolio.tpHit')}>
                  <Tag color="success" className="px-1.5 py-0 text-[10px] font-bold border-0">
                    TP HIT
                  </Tag>
                </Tooltip>
              )}
              {isTriggeredSL && (
                <Tooltip title={t('portfolio.slHit')}>
                  <Tag color="error" className="px-1.5 py-0 text-[10px] font-bold border-0">
                    SL HIT
                  </Tag>
                </Tooltip>
              )}
            </div>
            {record.company_name && (
              <Tooltip title={record.company_name}>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                  {record.company_name}
                </span>
              </Tooltip>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              {record.quantity.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} {t('portfolio.shares')}
            </span>
          </div>
        );
      },
    },
    {
      title: `${t('portfolio.colBuyPrice')} (x1K)`,
      dataIndex: 'buy_price',
      key: 'buy_price',
      width: 120,
      render: (price: number) => (
        <div className="mono-font text-slate-700 dark:text-slate-300 font-medium">
          {price.toFixed(2)}
        </div>
      ),
    },
    {
      title: `${t('portfolio.colCurrentPrice')} (x1K)`,
      dataIndex: 'current_price',
      key: 'current_price',
      width: 140,
      render: (currPrice: number | undefined, record: PortfolioPosition) => {
        const p = currPrice ?? record.buy_price;
        const change = record.change_pct ?? 0;
        const isUp = change >= 0;

        return (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white mono-font text-sm">
              {p.toFixed(2)}
            </span>
            <span className={`text-xs mono-font flex items-center gap-0.5 ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isUp ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        );
      },
    },
    {
      title: t('portfolio.colMarketValue'),
      key: 'market_value',
      width: 150,
      render: (_, record: PortfolioPosition) => {
        const valVND = ((record.market_value ?? (record.buy_price * record.quantity)) * 1000);
        return (
          <div className="flex flex-col">
            <span className="text-slate-800 dark:text-slate-200 font-medium mono-font text-sm">
              {(valVND / 1000000).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 })} {t('header.millionShort')}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {t('portfolio.cost')}: {(((record.buy_price * record.quantity) * 1000) / 1000000).toFixed(2)} {t('header.millionShort')}
            </span>
          </div>
        );
      },
    },
    {
      title: t('portfolio.colTakeProfit'),
      key: 'tp',
      width: 130,
      render: (_, record: PortfolioPosition) => (
        <div className="flex flex-col">
          <Tag color="green" className="w-fit text-xs font-semibold px-2 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
            +{record.tp_pct}%
          </Tag>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mono-font">
            {t('portfolio.target')}: {record.tp_price?.toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      title: t('portfolio.colStopLoss'),
      key: 'sl',
      width: 130,
      render: (_, record: PortfolioPosition) => (
        <div className="flex flex-col">
          <Tag color="red" className="w-fit text-xs font-semibold px-2 border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">
            -{record.sl_pct}%
          </Tag>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mono-font">
            {t('portfolio.stop')}: {record.sl_price?.toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      title: t('portfolio.colPnl'),
      key: 'pnl',
      width: 160,
      sorter: (a, b) => (a.pnl_pct ?? 0) - (b.pnl_pct ?? 0),
      render: (_, record: PortfolioPosition) => {
        const pnlPct = record.pnl_pct ?? 0;
        const pnlVal = ((record.pnl_value ?? 0) * 1000);
        const isProf = pnlPct >= 0;

        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-extrabold mono-font ${isProf ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {isProf ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
              {isProf ? (
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <span className={`text-xs mono-font ${isProf ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
              {isProf ? '+' : ''}{(pnlVal / 1000000).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 })} {t('header.millionShort')} VND
            </span>
          </div>
        );
      },
    },
    {
      title: t('portfolio.colStatus'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (active: boolean, record: PortfolioPosition) => (
        <Switch
          checked={active}
          size="small"
          onChange={(checked) => onToggleActive(record.ticker, checked)}
          className={active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}
        />
      ),
    },
    {
      title: t('portfolio.colActions'),
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, record: PortfolioPosition) => (
        <div className="flex items-center gap-1.5">
          <Tooltip title={t('portfolio.historyTooltip')}>
            <Button
              type="text"
              size="small"
              icon={<LineChart className="w-4 h-4 text-blue-600 dark:text-blue-400 hover:text-blue-500" />}
              onClick={() => onViewHistory(record.ticker)}
              className="hover:bg-blue-50 dark:hover:bg-blue-500/20"
            />
          </Tooltip>

          <Tooltip title={t('portfolio.editTooltip')}>
            <Button
              type="text"
              size="small"
              icon={<Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400 hover:text-amber-500" />}
              onClick={() => onEdit(record)}
              className="hover:bg-amber-50 dark:hover:bg-amber-500/20"
            />
          </Tooltip>

          <Tooltip title={t('portfolio.deleteTooltip')}>
            <Popconfirm
              title={`${t('portfolio.deleteConfirmTitle')} ${record.ticker}?`}
              description={t('portfolio.deleteConfirmDesc')}
              onConfirm={() => onDelete(record.ticker)}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 hover:text-rose-500" />}
                className="hover:bg-rose-50 dark:hover:bg-rose-500/20"
              />
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-md dark:shadow-xl transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {t('portfolio.title')}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-semibold">
              {positions.length} {t('header.stocksUnit')}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('portfolio.subtitle')}
          </p>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={positions}
        rowKey="ticker"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1000 }}
        className="custom-financial-table"
        locale={{
          emptyText: (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm">{t('portfolio.emptyText')}</p>
              <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">{t('portfolio.emptySubtext')}</p>
            </div>
          ),
        }}
      />
    </div>
  );
};

