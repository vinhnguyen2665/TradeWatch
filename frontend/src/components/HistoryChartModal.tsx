import React, { useEffect, useState } from 'react';
import { Modal, Spin, Tag, Segmented } from 'antd';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import dayjs from 'dayjs';
import { Clock } from 'lucide-react';
import { PriceHistory, PortfolioPosition } from '../types';
import { getPriceHistory } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface HistoryChartModalProps {
  visible: boolean;
  ticker: string | null;
  position?: PortfolioPosition | null;
  onClose: () => void;
}

export const HistoryChartModal: React.FC<HistoryChartModalProps> = ({
  visible,
  ticker,
  position,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const [data, setData] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(100);

  useEffect(() => {
    if (visible && ticker) {
      fetchHistory(ticker, limit);
    }
  }, [visible, ticker, limit]);

  const fetchHistory = async (t: string, count: number) => {
    setLoading(true);
    try {
      const histories = await getPriceHistory(t, count);
      setData(histories);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!ticker) return null;

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const changePct = latest?.change_pct ?? 0;
  const isUp = changePct >= 0;

  // Format data for chart
  const chartData = data.map((d) => ({
    ...d,
    timeLabel: dayjs(d.timestamp).format('HH:mm:ss DD/MM'),
    timeShort: dayjs(d.timestamp).format('HH:mm'),
  }));

  // Calculate dynamic Y-axis bounds
  const buyPrice = position?.buy_price;
  const tpPrice = position?.tp_price;
  const slPrice = position?.sl_price;

  const allPrices = [
    ...data.map((d) => d.price),
    ...(buyPrice ? [buyPrice] : []),
    ...(tpPrice ? [tpPrice] : []),
    ...(slPrice ? [slPrice] : []),
  ];

  const yMin = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.98 * 10) / 10 : 'auto';
  const yMax = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.02 * 10) / 10 : 'auto';

  return (
    <Modal
      title={
        <div className="flex flex-wrap items-center justify-between gap-4 pr-6">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mono-font tracking-wide">
                  {ticker}
                </span>
                {position?.company_name && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-[280px] truncate hidden sm:inline-block">
                    • {position.company_name}
                  </span>
                )}
              </div>
            </div>
            {latest && (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 dark:text-white mono-font">
                  {latest.price.toFixed(2)}
                </span>
                <Tag
                  color={isUp ? 'green' : 'red'}
                  className="px-2 py-0.5 text-xs font-bold border-0"
                >
                  {isUp ? '+' : ''}{changePct.toFixed(2)}%
                </Tag>
              </div>
            )}
          </div>

          <Segmented
            options={[
              { label: t('historyChart.points30'), value: 30 },
              { label: t('historyChart.points100'), value: 100 },
              { label: t('historyChart.points300'), value: 300 },
            ]}
            value={limit}
            onChange={(val) => setLimit(val as number)}
            className="text-xs"
          />
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={850}
    >
      <div className="mt-4 space-y-4">
        {/* Metric Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('portfolio.colBuyPrice')}:</span>
            <span className="ml-1.5 font-bold text-blue-600 dark:text-blue-400 mono-font">
              {buyPrice ? `${buyPrice.toFixed(2)}` : '--'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('portfolio.colTakeProfit')}:</span>
            <span className="ml-1.5 font-bold text-emerald-600 dark:text-emerald-400 mono-font">
              {tpPrice ? `${tpPrice.toFixed(2)} (+${position?.tp_pct}%)` : '--'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('portfolio.colStopLoss')}:</span>
            <span className="ml-1.5 font-bold text-rose-600 dark:text-rose-400 mono-font">
              {slPrice ? `${slPrice.toFixed(2)} (-${position?.sl_pct}%)` : '--'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">{t('screener.colVolume')}:</span>
            <span className="ml-1.5 font-bold text-slate-800 dark:text-slate-200 mono-font">
              {latest ? `${latest.volume.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ${t('portfolio.shares')}` : '--'}
            </span>
          </div>
        </div>

        {/* Chart Container */}
        <div className="bg-slate-50/50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 h-[380px] relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/50 backdrop-blur-sm z-10">
              <Spin tip={t('historyChart.loadingData')} />
            </div>
          ) : null}

          {chartData.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              {t('historyChart.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} vertical={false} />
                <XAxis
                  dataKey="timeShort"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="price"
                  domain={[yMin, yMax]}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  domain={[0, 'dataMax * 3']}
                  hide={true}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as PriceHistory & { timeLabel: string };
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5" /> {d.timeLabel}
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white mono-font text-sm">
                            {t('historyChart.price')}: {d.price.toFixed(2)} (x1,000đ)
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 mono-font">
                            {t('historyChart.volume')}: {d.volume.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </p>
                          <p className={`font-semibold mono-font ${d.change_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {t('historyChart.change')}: {d.change_pct >= 0 ? '+' : ''}{d.change_pct}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Reference Lines for Buy, TP and SL */}
                {buyPrice && (
                  <ReferenceLine
                    yAxisId="price"
                    y={buyPrice}
                    stroke="#2563EB"
                    strokeWidth={1.5}
                    label={{ value: `${t('historyChart.cost')}: ${buyPrice.toFixed(2)}`, fill: '#2563EB', fontSize: 10, position: 'right' }}
                  />
                )}
                {tpPrice && (
                  <ReferenceLine
                    yAxisId="price"
                    y={tpPrice}
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `${t('historyChart.tp')}: ${tpPrice.toFixed(2)}`, fill: '#10B981', fontSize: 10, position: 'right' }}
                  />
                )}
                {slPrice && (
                  <ReferenceLine
                    yAxisId="price"
                    y={slPrice}
                    stroke="#EF4444"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `${t('historyChart.sl')}: ${slPrice.toFixed(2)}`, fill: '#EF4444', fontSize: 10, position: 'right' }}
                  />
                )}

                {/* Volume Bar at bottom */}
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  fill="#94A3B8"
                  opacity={0.3}
                  radius={[2, 2, 0, 0]}
                />

                {/* Price Line */}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#2563EB' }}
                  activeDot={{ r: 5, fill: '#3B82F6' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Modal>
  );
};
