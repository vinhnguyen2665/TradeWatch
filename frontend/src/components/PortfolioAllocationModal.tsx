import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Table,
  Tag,
  Card,
  Divider,
  Alert,
  Tooltip,
  message,
  Tabs,
  Badge,
  Popconfirm,
  Segmented,
} from 'antd';
import {
  Sparkles,
  PieChart as PieChartIcon,
  Layers,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  DollarSign,
  Key,
  Flame,
  ArrowRight,
  Info,
  Clock,
  History,
  Target,
  Plus,
  X,
  BookmarkCheck,
  RefreshCw,
  Printer,
  Trash2,
  Eye,
  Bot,
  Cpu,
  Server,
  Save,
  Settings,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import {
  PortfolioAllocationResult,
  PortfolioAllocationRequest,
  PortfolioAllocationRecord,
  AssetAllocationItem,
  DetailedPositionStrategy,
  PortfolioPosition,
  GeminiModelInfo,
  UserAIConfig,
  AIProviderType,
} from '../types';
import {
  generateAllocation,
  getLatestAllocation,
  getAllocationHistory,
  deleteAllocation,
  applyAllocationToPortfolio,
  getSettings,
  updateSettings,
  getGeminiModels,
  getUserAIConfig,
  updateUserAIConfig,
} from '../services/api';

interface PortfolioAllocationModalProps {
  visible: boolean;
  onClose: () => void;
  onPositionsImported?: () => void;
  existingPositions?: PortfolioPosition[];
  onOpenSettings?: (focusField?: string) => void;
}

const VN30_INDEX_TICKERS = [
  'HPG', 'FPT', 'TCB', 'MBB', 'MWG', 'VNM', 'VHM', 'MSN', 'ACB', 'SSI',
  'VPB', 'VCB', 'CTG', 'STB', 'TPB', 'HDB', 'GAS', 'PLX', 'VRE', 'VIC',
  'BVH', 'POW', 'BCM', 'GVR', 'SAB', 'VJC', 'SSB', 'SHB', 'VIB', 'BID',
];

const MIDCAP_SUGGESTIONS = [
  'TAL', 'PVS', 'KBC', 'DXG', 'DIG', 'VIX', 'PC1', 'DGC', 'GEX', 'VCI',
  'PVD', 'HCM', 'VND', 'HSG', 'NKG', 'ANV', 'DBC', 'KDH', 'NLG', 'PDR',
  'REE', 'IDC', 'PVT', 'DCM', 'DPM', 'HDG', 'BMP', 'HAH', 'SZC', 'VGC',
];

const PENNY_SUGGESTIONS = [
  'NAG', 'HQC', 'DLG', 'QCG', 'ITA', 'EVG', 'HNG', 'TCD', 'SCR', 'HAR',
  'TNT', 'TTF', 'FIT', 'TSC', 'HHS', 'IDJ', 'API', 'APS', 'AMV', 'MST',
];

const ALLOCATION_PRESETS = [
  {
    key: 'BALANCED',
    label: 'Chuẩn Cân Bằng (60 - 30 - 10)',
    desc: '60% VN30 Tích sản • 30% Midcap Sóng ngành • 10% Penny T+',
    weights: { vn30: 60, midcap: 30, penny: 10 },
  },
  {
    key: 'DEFENSIVE',
    label: 'Phòng Thủ An Toàn (70 - 20 - 10)',
    desc: '70% VN30 An toàn • 20% Midcap • 10% Penny',
    weights: { vn30: 70, midcap: 20, penny: 10 },
  },
  {
    key: 'GROWTH',
    label: 'Tăng Trưởng Nhanh (50 - 35 - 15)',
    desc: '50% VN30 • 35% Midcap Bứt phá • 15% Penny',
    weights: { vn30: 50, midcap: 35, penny: 15 },
  },
  {
    key: 'AGGRESSIVE',
    label: 'Tấn Công Chủ Động (40 - 40 - 20)',
    desc: '40% VN30 • 40% Midcap Đón sóng • 20% Đầu cơ T+',
    weights: { vn30: 40, midcap: 40, penny: 20 },
  },
];

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'];

export const PortfolioAllocationModal: React.FC<PortfolioAllocationModalProps> = ({
  visible,
  onClose,
  onPositionsImported,
  existingPositions = [],
  onOpenSettings,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'create' | 'result' | 'history'>('create');
  const [currentResult, setCurrentResult] = useState<PortfolioAllocationRecord | null>(null);
  const [hasGlobalKey, setHasGlobalKey] = useState<boolean>(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('BALANCED');
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PortfolioAllocationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [userAIConfig, setUserAIConfig] = useState<UserAIConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('gemini');

  // Danh sách các AI Engine đã được đăng ký key trong Cài Đặt
  const configuredProviders = useMemo(() => {
    const list: { label: string; value: AIProviderType; icon: any; subText: string }[] = [];
    if (userAIConfig?.gemini_api_key_set) {
      list.push({
        label: 'Google Gemini',
        value: 'gemini',
        icon: Sparkles,
        subText: 'Google AI Studio',
      });
    }
    if (userAIConfig?.openai_api_key_set) {
      list.push({
        label: 'OpenAI (ChatGPT)',
        value: 'openai',
        icon: Bot,
        subText: 'GPT-4o / o3-mini',
      });
    }
    if (userAIConfig?.local_ai_base_url && userAIConfig.local_ai_base_url.trim()) {
      list.push({
        label: 'Local AI (Ollama/LM Studio)',
        value: 'local',
        icon: Server,
        subText: 'Offline Engine',
      });
    }
    return list;
  }, [userAIConfig]);

  useEffect(() => {
    if (visible) {
      loadInitialContext();
      fetchHistory();
    }
  }, [visible]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const history = await getAllocationHistory(30);
      setHistoryList(history || []);
    } catch (e) {
      console.error('Error fetching allocation history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await deleteAllocation(id);
      message.success('Đã xóa bản ghi phân bổ thành công!');
      fetchHistory();
      if (currentResult?.id === id) {
        getLatestAllocation().then((latest) => setCurrentResult(latest)).catch(() => null);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Không thể xóa bản ghi phân bổ vốn.');
    }
  };

  const fetchDynamicModels = async (
    provider: AIProviderType = selectedProvider,
    baseUrl?: string,
    force: boolean = false
  ) => {
    setLoadingModels(true);
    try {
      const resolvedBase = provider === 'local'
        ? (baseUrl || userAIConfig?.local_ai_base_url || 'http://localhost:11434/v1')
        : undefined;
      const models = await getGeminiModels(provider, resolvedBase);
      if (models && models.length > 0) {
        setAvailableModels(models);

        const currentVal = form.getFieldValue('model_name');
        const exists = models.some((m) => m.id === currentVal);
        if (!exists || force) {
          const rec = models.find((m) => m.is_recommended) || models[0];
          form.setFieldsValue({ model_name: rec.id });
        }
      } else {
        setAvailableModels([]);
      }
    } catch (e) {
      console.error('Error fetching live AI models:', e);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = (prov: AIProviderType) => {
    setSelectedProvider(prov);
    fetchDynamicModels(prov, undefined, true);
  };

  const loadInitialContext = async () => {
    try {
      const [aiConfig, latest] = await Promise.all([
        getUserAIConfig().catch(() => null),
        getLatestAllocation().catch(() => null),
      ]);

      if (aiConfig) {
        setUserAIConfig(aiConfig);
        let prov = aiConfig.ai_provider || 'gemini';
        const hasGemini = Boolean(aiConfig.gemini_api_key_set);
        const hasOpenAI = Boolean(aiConfig.openai_api_key_set);
        const hasLocal = Boolean(aiConfig.local_ai_base_url && aiConfig.local_ai_base_url.trim());

        // Đảm bảo chọn engine đã được đăng ký key
        if (prov === 'gemini' && !hasGemini) {
          if (hasOpenAI) prov = 'openai';
          else if (hasLocal) prov = 'local';
        } else if (prov === 'openai' && !hasOpenAI) {
          if (hasGemini) prov = 'gemini';
          else if (hasLocal) prov = 'local';
        }

        setSelectedProvider(prov);
        fetchDynamicModels(prov, aiConfig.local_ai_base_url);
      } else {
        fetchDynamicModels('gemini');
      }

      if (latest && !currentResult) {
        setCurrentResult(latest);
      }

      // Pre-fill tickers from existing positions if available
      const vn30Pre: string[] = [];
      const midcapPre: string[] = [];
      const pennyPre: string[] = [];

      if (existingPositions && existingPositions.length > 0) {
        existingPositions.forEach((p) => {
          const t = p.ticker.toUpperCase();
          if (VN30_INDEX_TICKERS.includes(t)) {
            if (!vn30Pre.includes(t)) vn30Pre.push(t);
          } else if (PENNY_SUGGESTIONS.includes(t) || (p.buy_price && p.buy_price < 10.0)) {
            if (!pennyPre.includes(t)) pennyPre.push(t);
          } else {
            if (!midcapPre.includes(t)) midcapPre.push(t);
          }
        });
      }

      form.setFieldsValue({
        total_capital: 250000000,
        vn30_tickers: vn30Pre,
        midcap_tickers: midcapPre,
        penny_tickers: pennyPre,
        risk_profile: 'BALANCED',
        model_name: form.getFieldValue('model_name') || 'gemini-3.5-flash',
      });
    } catch (e) {
      console.error('Error loading allocation initial data:', e);
    }
  };

  const handleImportAllWatchedPositions = () => {
    if (!existingPositions || existingPositions.length === 0) {
      message.info('Danh mục theo dõi của bạn hiện chưa có mã cổ phiếu nào.');
      return;
    }

    const currentVn30 = form.getFieldValue('vn30_tickers') || [];
    const currentMidcap = form.getFieldValue('midcap_tickers') || [];
    const currentPenny = form.getFieldValue('penny_tickers') || [];

    const newVn30 = [...currentVn30];
    const newMidcap = [...currentMidcap];
    const newPenny = [...currentPenny];

    existingPositions.forEach((p) => {
      const t = p.ticker.toUpperCase();
      if (VN30_INDEX_TICKERS.includes(t)) {
        if (!newVn30.includes(t)) newVn30.push(t);
      } else if (PENNY_SUGGESTIONS.includes(t) || (p.buy_price && p.buy_price < 10.0)) {
        if (!newPenny.includes(t)) newPenny.push(t);
      } else {
        if (!newMidcap.includes(t)) newMidcap.push(t);
      }
    });

    form.setFieldsValue({
      vn30_tickers: newVn30,
      midcap_tickers: newMidcap,
      penny_tickers: newPenny,
    });

    message.success(`Đã tự động phân loại và nạp ${existingPositions.length} mã đang theo dõi vào 3 nhóm!`);
  };

  const toggleTickerInGroup = (fieldName: string, ticker: string) => {
    const currentList: string[] = form.getFieldValue(fieldName) || [];
    const upper = ticker.toUpperCase();
    if (currentList.includes(upper)) {
      form.setFieldsValue({ [fieldName]: currentList.filter((t) => t !== upper) });
    } else {
      form.setFieldsValue({ [fieldName]: [...currentList, upper] });
    }
  };

  const handleSelectPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    form.setFieldsValue({ risk_profile: presetKey });
  };

  const handleGenerate = async (values: any) => {
    // 1. Kiểm tra xem đã có ít nhất một AI Engine được đăng ký Key hay chưa
    if (configuredProviders.length === 0) {
      message.warning('Tài khoản của bạn chưa đăng ký API Key cho AI Engine nào. Vui lòng mở Cài đặt để thêm API Key!');
      onOpenSettings?.('ai_config');
      return;
    }

    const isCurrentProvConfigured =
      (selectedProvider === 'gemini' && userAIConfig?.gemini_api_key_set) ||
      (selectedProvider === 'openai' && userAIConfig?.openai_api_key_set) ||
      (selectedProvider === 'local' && Boolean(userAIConfig?.local_ai_base_url && userAIConfig.local_ai_base_url.trim()));

    if (!isCurrentProvConfigured) {
      const provLabel = selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider === 'openai' ? 'OpenAI ChatGPT' : 'Local AI';
      message.warning(`AI Engine ${provLabel} chưa được cấu hình API Key. Vui lòng vào Cài đặt để cấu hình.`);
      onOpenSettings?.('ai_config');
      return;
    }

    const capital = Number(values.total_capital);
    if (!capital || capital <= 0) {
      message.error('Vui lòng nhập tổng số vốn đầu tư hợp lệ');
      return;
    }

    const vList = (values.vn30_tickers || []).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
    const mList = (values.midcap_tickers || []).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
    const pList = (values.penny_tickers || []).map((t: string) => t.trim().toUpperCase()).filter(Boolean);

    if (vList.length === 0 && mList.length === 0 && pList.length === 0) {
      message.error('Vui lòng chọn hoặc nhập ít nhất một mã cổ phiếu vào danh mục.');
      return;
    }

    const preset = ALLOCATION_PRESETS.find((p) => p.key === selectedPreset) || ALLOCATION_PRESETS[0];

    const payload: PortfolioAllocationRequest = {
      total_capital: capital,
      vn30_tickers: vList,
      midcap_tickers: mList,
      penny_tickers: pList,
      ai_provider: selectedProvider,
      model_name: values.model_name,
      risk_profile: selectedPreset,
      custom_weights: preset.weights,
    };

    setLoading(true);
    try {
      const res = await generateAllocation(payload);
      setCurrentResult(res);
      setActiveTab('result');
      fetchHistory();
      message.success('AI đã hoàn thành kế hoạch phân bổ vốn và hoạch định danh mục thành công!');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi gọi dịch vụ AI để phân tích danh mục');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToWatchlist = async () => {
    if (!currentResult?.data?.summary_table) return;

    setApplying(true);
    try {
      const positionsToImport = currentResult.data.summary_table.map((item) => {
        // Hệ thống lưu buy_price là x1,000 VND (Ví dụ: 28500 VND -> 28.5)
        const priceK = item.current_price > 1000 ? item.current_price / 1000.0 : item.current_price;
        
        let tpPct = 8.0;
        let slPct = 5.0;
        if (item.asset_class.includes('VN30')) {
          tpPct = 12.0;
          slPct = 6.0;
        } else if (item.asset_class.includes('Midcap')) {
          tpPct = 15.0;
          slPct = 6.0;
        } else if (item.asset_class.includes('Penny')) {
          tpPct = 18.0;
          slPct = 5.0;
        }

        return {
          ticker: item.ticker,
          company_name: item.company_name,
          buy_price: Math.max(1.0, round(priceK, 2)),
          quantity: item.estimated_shares || 100,
          tp_pct: tpPct,
          sl_pct: slPct,
        };
      });

      await applyAllocationToPortfolio(positionsToImport);
      message.success(`Đã tự động nạp ${positionsToImport.length} mã vào Danh mục Theo dõi! Bot Telegram sẽ bắt đầu canh TP/SL.`);
      if (onPositionsImported) {
        onPositionsImported();
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Lỗi khi thêm vị thế vào danh mục');
    } finally {
      setApplying(false);
    }
  };

  const round = (num: number, dec: number) => Number(Math.round(Number(num + 'e' + dec)) + 'e-' + dec);

  const formatVnd = (val: number) => {
    return val.toLocaleString('vi-VN') + ' đ';
  };

  const pieChartData = currentResult?.data?.summary_table?.map((item) => {
    const totalCap = currentResult?.total_capital || currentResult?.data?.total_capital || 0;
    const exactAmount = totalCap > 0 && item.capital_percentage
      ? Math.round(totalCap * (item.capital_percentage / 100))
      : item.allocated_amount;
    return {
      name: `${item.ticker} (${item.capital_percentage}%)`,
      value: exactAmount,
      percentage: item.capital_percentage,
      ticker: item.ticker,
    };
  }) || [];

  const columns = [
    {
      title: 'Nhóm Tài Sản',
      dataIndex: 'asset_class',
      key: 'asset_class',
      render: (text: string) => {
        let color = 'blue';
        if (text.includes('VN30')) color = 'geekblue';
        else if (text.includes('Midcap')) color = 'emerald';
        else if (text.includes('Penny')) color = 'volcano';
        return <Tag color={color} className="font-semibold text-xs">{text}</Tag>;
      },
    },
    {
      title: 'Mã Cổ Phiếu',
      dataIndex: 'ticker',
      key: 'ticker',
      render: (ticker: string, record: AssetAllocationItem) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
            <span>{ticker}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
            {record.company_name || ticker}
          </div>
        </div>
      ),
    },
    {
      title: 'Tỷ Trọng Vốn',
      dataIndex: 'capital_percentage',
      key: 'capital_percentage',
      render: (pct: number) => (
        <Tag
          color={pct >= 40 ? 'blue' : pct >= 20 ? 'green' : 'gold'}
          className="font-bold text-xs px-2.5 py-0.5 rounded-full"
        >
          {pct}%
        </Tag>
      ),
    },
    {
      title: 'Số Tiền Phân Bổ',
      dataIndex: 'allocated_amount',
      key: 'allocated_amount',
      render: (amount: number, record: AssetAllocationItem) => {
        const totalCap = currentResult?.total_capital || currentResult?.data?.total_capital || 0;
        const exactAmount = totalCap > 0 && record.capital_percentage
          ? Math.round(totalCap * (record.capital_percentage / 100))
          : amount;
        return (
          <span className="font-semibold mono-font text-slate-800 dark:text-slate-200">
            {formatVnd(exactAmount)}
          </span>
        );
      },
    },
    {
      title: 'Giá Mua Ước Tính',
      dataIndex: 'current_price',
      key: 'current_price',
      render: (price: number) => {
        const realPrice = price < 1000 ? price * 1000 : price;
        return (
          <span className="text-xs text-slate-600 dark:text-slate-400 mono-font">
            {formatVnd(realPrice)}
          </span>
        );
      },
    },
    {
      title: 'Khối Lượng Mua (Lô 100)',
      dataIndex: 'estimated_shares',
      key: 'estimated_shares',
      render: (shares: number, record: AssetAllocationItem) => {
        const totalCap = currentResult?.total_capital || currentResult?.data?.total_capital || 0;
        const exactAmount = totalCap > 0 && record.capital_percentage
          ? Math.round(totalCap * (record.capital_percentage / 100))
          : record.allocated_amount;
        const realPrice = record.current_price < 1000 ? record.current_price * 1000 : record.current_price;
        const exactShares = realPrice > 0
          ? Math.max(100, Math.floor((exactAmount / realPrice) / 100) * 100)
          : shares;
        return (
          <span className="font-bold text-blue-600 dark:text-blue-400 mono-font">
            {exactShares.toLocaleString('vi-VN')} CP
          </span>
        );
      },
    },
    {
      title: 'Vị Thế & Kỳ Vọng Chốt Lời',
      key: 'strategy',
      render: (_: any, record: AssetAllocationItem) => (
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {record.strategic_position}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <Target className="w-3 h-3" /> TP: {record.profit_target}
          </div>
        </div>
      ),
    },
  ];

  const handleExportPdf = (targetRecord?: PortfolioAllocationRecord | null) => {
    const record = targetRecord || currentResult;
    if (!record || !record.data) {
      message.warning('Chưa có dữ liệu phân bổ để xuất báo cáo PDF.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=1100');
    if (!printWindow) {
      message.error('Trình duyệt đã chặn pop-up in. Vui lòng cho phép mở pop-up trên trình duyệt để in/xuất PDF.');
      return;
    }

    const totalCap = record.total_capital || record.data.total_capital || 0;
    const createdDate = new Date(record.created_at).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const summaryRows = (record.data.summary_table || []).map((item) => {
      const exactAllocated = totalCap > 0 && item.capital_percentage
        ? Math.round(totalCap * (item.capital_percentage / 100))
        : item.allocated_amount;
      const realPrice = item.current_price < 1000 ? item.current_price * 1000 : item.current_price;
      const exactShares = realPrice > 0
        ? Math.max(100, Math.floor((exactAllocated / realPrice) / 100) * 100)
        : item.estimated_shares;

      let badgeClass = 'badge-blue';
      if (item.asset_class.includes('Midcap')) badgeClass = 'badge-green';
      else if (item.asset_class.includes('Penny')) badgeClass = 'badge-amber';

      const strat = record.data.detailed_strategies?.find(
        (s) => s.ticker.toUpperCase() === item.ticker.toUpperCase()
      );
      const buyZone = strat?.buy_zone || '-';

      return `
        <tr>
          <td style="font-weight: 700; color: #1e3a8a; font-size: 13px;">${item.ticker}</td>
          <td style="font-size: 11px; color: #475569;">${item.company_name || item.ticker}</td>
          <td><span class="badge ${badgeClass}">${item.asset_class}</span></td>
          <td style="text-align: right; font-weight: 700; color: #1d4ed8;">${item.capital_percentage}%</td>
          <td style="text-align: right; font-weight: 700; color: #047857;">${exactAllocated.toLocaleString('vi-VN')} đ</td>
          <td style="text-align: right;">${realPrice.toLocaleString('vi-VN')} đ</td>
          <td style="text-align: right; font-weight: 700; color: #2563eb;">${exactShares.toLocaleString('vi-VN')} CP</td>
          <td style="color: #1e40af; font-size: 11px;">${buyZone}</td>
          <td style="color: #047857; font-size: 11px; font-weight: 600;">${item.profit_target || '-'}</td>
          <td style="color: #b91c1c; font-size: 11px; font-weight: 600;">${item.stop_loss || strat?.stop_loss_zone || '-'}</td>
        </tr>
      `;
    }).join('');

    const strategyCards = (record.data.detailed_strategies || []).map((s) => `
      <div class="strategy-card">
        <div class="strat-header">
          <span class="strat-title">${s.title}</span>
          <span class="strat-pct">${s.percentage}% TỔNG VỐN</span>
        </div>
        <div class="strat-analysis">${s.position_analysis}</div>
        <div class="strat-grid">
          <div><b>Vùng Mua Gom:</b> <span style="color:#1d4ed8; font-weight:600;">${s.buy_zone}</span></div>
          <div><b>Mục Tiêu Chốt Lời:</b> <span style="color:#047857; font-weight:600;">${s.profit_target_zone}</span></div>
          <div><b>Cắt Lỗ Kỷ Luật:</b> <span style="color:#b91c1c; font-weight:600;">${s.stop_loss_zone}</span></div>
        </div>
        <div class="strat-exec"><b>💡 Cách giải ngân:</b> ${s.execution_strategy}</div>
        ${s.risk_notes ? `<div class="strat-risk"><b>⚠️ Cảnh báo rủi ro:</b> ${s.risk_notes}</div>` : ''}
      </div>
    `).join('');

    const riskRules = (record.data.risk_management_rules || []).map((r) => `<li>${r}</li>`).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Báo Cáo Phân Bổ Vốn AI - ${record.data.risk_profile} - ${createdDate}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 12px;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header .meta {
      font-size: 11px;
      color: #64748b;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a8a;
      text-transform: uppercase;
      border-left: 3px solid #2563eb;
      padding-left: 8px;
      margin: 16px 0 8px 0;
    }
    .summary-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11.5px;
      color: #1e3a8a;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    tr:nth-child(even) { background: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
    }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #d1fae5; color: #047857; }
    .badge-amber { background: #fef3c7; color: #b45309; }
    .strategy-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .strategy-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .strat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .strat-title { font-weight: 700; color: #0f172a; font-size: 12px; }
    .strat-pct { font-size: 10px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 4px; }
    .strat-analysis { font-size: 11px; color: #475569; margin-bottom: 6px; line-height: 1.5; }
    .strat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      background: #f8fafc;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 10.5px;
      margin-bottom: 6px;
    }
    .strat-exec { font-size: 10.5px; color: #334155; margin-bottom: 4px; }
    .strat-risk { font-size: 10px; color: #b45309; background: #fffbeb; padding: 4px 6px; border-radius: 4px; margin-top: 4px; }
    .rules-box {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .rules-box ul { margin: 0; padding-left: 20px; font-size: 11px; color: #581c87; line-height: 1.6; }
    .footer {
      margin-top: 24px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #94a3b8;
    }
    .print-btn-bar {
      text-align: right;
      margin-bottom: 12px;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(37,99,235,0.2);
    }
    @media print {
      .print-btn-bar { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">🖨️ In / Lưu PDF Ngay (Save as PDF)</button>
  </div>
  <div class="header">
    <div>
      <h1>Báo Cáo Phân Bổ Vốn & Chiến Lược Đầu Tư AI</h1>
      <div class="meta">Hệ thống TradeWatch Robo-Advisor • Sinh tự động bởi <b>${record.data.ai_provider === 'openai' ? 'OpenAI ChatGPT' : record.data.ai_provider === 'local' ? 'Local AI' : 'Google Gemini'}</b> ${record.data.ai_model ? `(Model: <code>${record.data.ai_model}</code>)` : ''}</div>
    </div>
    <div style="text-align: right;">
      <div class="meta">Thời gian lập: <b>${createdDate}</b></div>
      <div class="meta">Mã báo cáo: <b>#ALLOC-${record.id}</b></div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="kpi-label">Tổng Vốn Đầu Tư</div>
      <div class="kpi-val" style="color: #2563eb;">${totalCap.toLocaleString('vi-VN')} VND</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Khẩu Vị Rủi Ro</div>
      <div class="kpi-val" style="color: #7c3aed;">${record.data.risk_profile} STRATEGY</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">Kỳ Vọng Sinh Lời Danh Mục</div>
      <div class="kpi-val" style="color: #059669;">${record.data.estimated_portfolio_yield || '+20% - +30%/năm'}</div>
    </div>
  </div>

  <div class="section-title">1. Tóm Tắt Chiến Lược Vĩ Mô & Chu Kỳ Thị Trường</div>
  <div class="summary-box">
    ${record.data.executive_summary}
  </div>

  <div class="section-title">2. Bảng Cơ Cấu Danh Mục & Khối Lượng Giải Ngân (Chuẩn Lô 100 CP)</div>
  <table>
    <thead>
      <tr>
        <th>Mã</th>
        <th>Doanh nghiệp</th>
        <th>Nhóm</th>
        <th style="text-align: right;">Tỷ lệ</th>
        <th style="text-align: right;">Số tiền phân bổ</th>
        <th style="text-align: right;">Thị giá</th>
        <th style="text-align: right;">Số lượng CP</th>
        <th>Vùng mua gom</th>
        <th>Mục tiêu chốt lời</th>
        <th>Cắt lỗ</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
    </tbody>
  </table>

  <div class="section-title">3. Chi Tiết Chiến Lược Từng Vị Thế Cổ Phiếu</div>
  <div class="strategy-list">
    ${strategyCards}
  </div>

  <div class="rules-box">
    <div style="font-weight: 700; margin-bottom: 6px; font-size: 11.5px; text-transform: uppercase;">
      🛡️ Kỷ Luật Giao Dịch & Nguyên Tắc Quản Trị Rủi Ro Bắt Buộc
    </div>
    <ul>
      ${riskRules}
    </ul>
  </div>

  <div class="footer">
    <span>TradeWatch AI Portfolio Optimization • Powered by Google Gemini</span>
    <span>Khuyến nghị mang tính chất tham khảo đầu tư dữ liệu mô phỏng</span>
  </div>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.error('Print dialog error:', e);
      }
    }, 450);
  };

  const historyColumns = [
    {
      title: 'Thời Gian Lập',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val: string) => {
        const d = new Date(val);
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{d.toLocaleString('vi-VN')}</span>
          </div>
        );
      },
    },
    {
      title: 'Mô Hình AI',
      key: 'ai_model_info',
      width: 175,
      render: (_: any, record: PortfolioAllocationRecord) => {
        const prov = record.data?.ai_provider || 'gemini';
        const model = record.data?.ai_model || 'gemini-3.5-flash';
        const color = prov === 'openai' ? 'green' : prov === 'local' ? 'purple' : 'blue';
        const provName = prov === 'openai' ? 'OpenAI' : prov === 'local' ? 'Local AI' : 'Gemini';
        return (
          <div className="flex flex-col gap-0.5">
            <Tag color={color} className="font-bold text-[10px] w-fit uppercase px-1.5 py-0 leading-tight">
              {provName}
            </Tag>
            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[155px]" title={model}>
              {model}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Tổng Vốn',
      dataIndex: 'total_capital',
      key: 'total_capital',
      width: 135,
      render: (val: number) => (
        <span className="font-bold mono-font text-blue-600 dark:text-blue-400 text-sm">
          {formatVnd(val)}
        </span>
      ),
    },
    {
      title: 'Khẩu Vị',
      key: 'risk_profile',
      width: 120,
      render: (_: any, record: PortfolioAllocationRecord) => {
        const p = record.data?.risk_profile || 'BALANCED';
        const color = p === 'DEFENSIVE' ? 'blue' : p === 'GROWTH' ? 'green' : p === 'AGGRESSIVE' ? 'volcano' : 'purple';
        return <Tag color={color} className="font-semibold text-xs">{p}</Tag>;
      },
    },
    {
      title: 'Cổ Phiếu Phân Bổ',
      key: 'tickers',
      render: (_: any, record: PortfolioAllocationRecord) => {
        const items = record.data?.summary_table || [];
        return (
          <div className="flex flex-wrap gap-1">
            {items.map((it) => (
              <Tag
                key={it.ticker}
                color={it.asset_class.includes('VN30') ? 'blue' : it.asset_class.includes('Midcap') ? 'cyan' : 'orange'}
                className="font-bold text-xs"
              >
                {it.ticker} ({it.capital_percentage}%)
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Kỳ Vọng Sinh Lời',
      key: 'yield',
      width: 150,
      render: (_: any, record: PortfolioAllocationRecord) => (
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
          {record.data?.estimated_portfolio_yield || 'Chưa xác định'}
        </span>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 200,
      align: 'right' as const,
      render: (_: any, record: PortfolioAllocationRecord) => (
        <div className="flex items-center justify-end gap-1.5">
          <Tooltip title="Xem chi tiết kết quả phân bổ này">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<Eye className="w-3.5 h-3.5" />}
              onClick={() => {
                setCurrentResult(record);
                setActiveTab('result');
              }}
              className="text-xs font-medium flex items-center gap-1"
            >
              Xem
            </Button>
          </Tooltip>

          <Tooltip title="Xuất file PDF báo cáo phân bổ">
            <Button
              size="small"
              icon={<Printer className="w-3.5 h-3.5 text-blue-600" />}
              onClick={() => handleExportPdf(record)}
              className="text-xs font-medium flex items-center gap-1"
            >
              PDF
            </Button>
          </Tooltip>

          <Popconfirm
            title="Xóa bản ghi này?"
            description="Bạn có chắc chắn muốn xóa bản ghi phân bổ vốn này khỏi lịch sử?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteHistory(record.id)}
          >
            <Tooltip title="Xóa khỏi lịch sử">
              <Button
                size="small"
                danger
                type="text"
                icon={<Trash2 className="w-3.5 h-3.5" />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  // Watchlist tickers helper list
  const watchedTickers = existingPositions.map((p) => p.ticker.toUpperCase());

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-emerald-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                AI Portfolio Allocation & Capital Strategy
              </div>
              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                Phân bổ vốn đa mã & hoạch định chiến lược danh mục theo khẩu vị rủi ro
              </div>
            </div>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width="90vw"
      style={{ maxWidth: '1600px', top: 20 }}
      footer={null}
      className="portfolio-allocation-modal"
      destroyOnClose={false}
    >
      <div className="mt-4">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k as any);
            if (k === 'history') {
              fetchHistory();
            }
          }}
          items={[
            {
              key: 'create',
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                  <Layers className="w-4 h-4" /> Thiết lập Danh Mục Đa Mã
                </span>
              ),
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleGenerate}
                  className="space-y-6 pt-2"
                >
                  {/* Step 1: Capital Input & Quick Import Bar */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-900/80 dark:via-indigo-950/20 dark:to-slate-900/40 border border-blue-100 dark:border-blue-900/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm uppercase">
                        <DollarSign className="w-4 h-4" /> 1. Tổng Số Vốn Đầu Tư Dự Kiến (VND)
                      </div>
                      
                      {existingPositions.length > 0 && (
                        <Button
                          type="default"
                          size="small"
                          icon={<BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />}
                          onClick={handleImportAllWatchedPositions}
                          className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 font-semibold"
                        >
                          Nạp nhanh {existingPositions.length} mã đang theo dõi
                        </Button>
                      )}
                    </div>

                    <Form.Item
                      name="total_capital"
                      rules={[{ required: true, message: 'Vui lòng nhập tổng số vốn đầu tư' }]}
                      className="mb-3"
                    >
                      <InputNumber<number>
                        className="w-full text-lg font-bold mono-font py-1"
                        formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(val) => Number(val?.replace(/\$\s?|(,*)/g, '') || 0)}
                        addonAfter={<span className="font-bold text-blue-600">VND</span>}
                        min={1000000}
                        step={10000000}
                      />
                    </Form.Item>

                    {/* Quick Capital Selection Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Chọn nhanh vốn:</span>
                      {[
                        { label: '50 Triệu', val: 50000000 },
                        { label: '100 Triệu', val: 100000000 },
                        { label: '250 Triệu', val: 250000000 },
                        { label: '500 Triệu', val: 500000000 },
                        { label: '1 Tỷ', val: 1000000000 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => form.setFieldsValue({ total_capital: item.val })}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: 3 Multi-Stock Groups */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm uppercase">
                        <Layers className="w-4 h-4 text-indigo-500" /> 2. Chọn Mã Cổ Phiếu Cho Từng Nhóm (Có thể chọn nhiều mã)
                      </div>
                      <span className="text-xs text-slate-500">Nhập mã & nhấn Enter hoặc click chọn gợi ý</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* VN30 Card (Multi-select) */}
                      <Card className="rounded-xl border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-slate-900/70 hover:border-blue-400 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                            🌟 Trụ Cột (VN30)
                          </span>
                          <Tag color="geekblue" className="text-[10px] font-bold">~60% VỐN</Tag>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Tích sản an toàn, nền tảng cơ bản vững, phòng thủ dài hạn.
                        </p>

                        <Form.Item
                          name="vn30_tickers"
                          className="mb-2"
                        >
                          <Select
                            mode="tags"
                            placeholder="Chọn hoặc nhập mã (HPG, FPT...)"
                            tokenSeparators={[',', ' ']}
                            className="w-full font-bold mono-font"
                            maxTagCount="responsive"
                          />
                        </Form.Item>

                        {/* Watched & Suggestions Chips */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div className="text-[10px] text-slate-400 font-medium">Gợi ý nhanh:</div>
                          <div className="flex flex-wrap gap-1">
                            {VN30_INDEX_TICKERS.slice(0, 8).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleTickerInGroup('vn30_tickers', t)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                  watchedTickers.includes(t)
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                    : 'bg-blue-100/70 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                                }`}
                              >
                                {watchedTickers.includes(t) ? `⭐ ${t}` : t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Card>

                      {/* Midcap Card (Multi-select) */}
                      <Card className="rounded-xl border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-slate-900/70 hover:border-emerald-400 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                            📈 Đón Sóng (Midcap)
                          </span>
                          <Tag color="green" className="text-[10px] font-bold">~30% VỐN</Tag>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Đón sóng chu kỳ ngành, bứt phá tăng trưởng trung hạn.
                        </p>

                        <Form.Item
                          name="midcap_tickers"
                          className="mb-2"
                        >
                          <Select
                            mode="tags"
                            placeholder="Chọn hoặc nhập mã (TAL, PVS...)"
                            tokenSeparators={[',', ' ']}
                            className="w-full font-bold mono-font"
                            maxTagCount="responsive"
                          />
                        </Form.Item>

                        {/* Watched & Suggestions Chips */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div className="text-[10px] text-slate-400 font-medium">Gợi ý nhanh:</div>
                          <div className="flex flex-wrap gap-1">
                            {MIDCAP_SUGGESTIONS.slice(0, 8).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleTickerInGroup('midcap_tickers', t)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                  watchedTickers.includes(t)
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                    : 'bg-emerald-100/70 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                                }`}
                              >
                                {watchedTickers.includes(t) ? `⭐ ${t}` : t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Card>

                      {/* Penny Card (Multi-select) */}
                      <Card className="rounded-xl border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-slate-900/70 hover:border-amber-400 transition-all shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                            🔎 Lướt Sóng (Penny)
                          </span>
                          <Tag color="gold" className="text-[10px] font-bold">~10% VỐN</Tag>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                          Đầu cơ dòng tiền nóng, lướt sóng nhanh T+, cắt lỗ dứt khoát.
                        </p>

                        <Form.Item
                          name="penny_tickers"
                          className="mb-2"
                        >
                          <Select
                            mode="tags"
                            placeholder="Chọn hoặc nhập mã (NAG, HQC...)"
                            tokenSeparators={[',', ' ']}
                            className="w-full font-bold mono-font"
                            maxTagCount="responsive"
                          />
                        </Form.Item>

                        {/* Watched & Suggestions Chips */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div className="text-[10px] text-slate-400 font-medium">Gợi ý nhanh:</div>
                          <div className="flex flex-wrap gap-1">
                            {PENNY_SUGGESTIONS.slice(0, 8).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleTickerInGroup('penny_tickers', t)}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                  watchedTickers.includes(t)
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                    : 'bg-amber-100/70 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                                }`}
                              >
                                {watchedTickers.includes(t) ? `⭐ ${t}` : t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Step 3: Strategy Preset Selection */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm uppercase">
                      <ShieldCheck className="w-4 h-4 text-blue-600" /> 3. Khẩu Vị Rủi Ro & Tỷ Lệ Phân Bổ
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ALLOCATION_PRESETS.map((preset) => (
                        <div
                          key={preset.key}
                          onClick={() => handleSelectPreset(preset.key)}
                          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                            selectedPreset === preset.key
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                              {preset.label}
                            </span>
                            {selectedPreset === preset.key && (
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {preset.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 4: AI Provider Selection (Configured Only) & Model */}
                  <div className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase">
                        <Sparkles className="w-4 h-4" /> 4. Lựa Chọn Cố Vấn AI (Engine Đã Đăng Ký Key)
                      </div>
                      <Button
                        type="link"
                        size="small"
                        icon={<Settings className="w-3.5 h-3.5" />}
                        onClick={() => onOpenSettings?.('ai_config')}
                        className="p-0 h-auto text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1"
                      >
                        Quản lý / Đổi API Key trong Cài đặt ↗
                      </Button>
                    </div>

                    {configuredProviders.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 space-y-3">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          Chưa Có AI Engine Nào Được Đăng Ký API Key
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                          Tài khoản của bạn chưa cấu hình API Key cho bất kỳ AI Engine nào (Google Gemini, OpenAI ChatGPT hoặc Local AI). Vui lòng nhấn nút bên dưới để mở phần Cài Đặt và đăng ký API Key của bạn.
                        </p>
                        <Button
                          type="primary"
                          icon={<Settings className="w-4 h-4" />}
                          onClick={() => onOpenSettings?.('ai_config')}
                          className="bg-amber-600 hover:bg-amber-500 font-semibold text-xs"
                        >
                          Mở Cài Đặt Để Đăng Ký Key AI
                        </Button>
                      </div>
                    ) : (
                      <>
                        {/* Segmented Provider Switcher - Chỉ hiển thị các engine đã được đăng ký key */}
                        <div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                            <span>Chọn Nền Tảng AI Engine ({configuredProviders.length} động cơ sẵn sàng):</span>
                            <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> ĐÃ XÁC THỰC KEY
                            </Tag>
                          </div>
                          <Segmented<AIProviderType>
                            value={selectedProvider}
                            onChange={(val) => handleProviderChange(val)}
                            block
                            size="large"
                            className="p-1 bg-slate-200/70 dark:bg-slate-800/80 font-semibold"
                            options={configuredProviders.map((cp) => ({
                              label: (
                                <div className="flex items-center justify-center gap-1.5 py-1">
                                  <cp.icon className="w-4 h-4 text-indigo-500" />
                                  <span>{cp.label}</span>
                                </div>
                              ),
                              value: cp.value,
                            }))}
                          />
                        </div>

                        {/* Model Select */}
                        <Form.Item
                          name="model_name"
                          label={
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Mô hình AI ({selectedProvider === 'gemini' ? 'Google Gemini' : selectedProvider === 'openai' ? 'OpenAI ChatGPT' : 'Local AI Engine'})
                              </span>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => fetchDynamicModels(selectedProvider, undefined, true)}
                                loading={loadingModels}
                                icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />}
                                className="p-0 h-auto text-xs text-blue-600 dark:text-blue-400 font-medium"
                              >
                                Đồng bộ lại model
                              </Button>
                            </div>
                          }
                          className="mb-1"
                        >
                      <Select
                        className="w-full font-medium"
                        loading={loadingModels}
                        placeholder={loadingModels ? "Đang tải danh sách models..." : "Chọn model AI phân tích..."}
                        showSearch
                        optionFilterProp="label"
                        options={availableModels.map((m) => ({
                          value: m.id,
                          label: `${m.is_recommended ? '⚡ ' : ''}${m.display_name} (${m.id})`,
                          raw: m,
                        }))}
                        optionRender={(option) => {
                          const m = option.data.raw as GeminiModelInfo;
                          if (!m) return option.label;
                          return (
                            <div className="py-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {m.is_recommended ? '⚡ ' : ''}{m.display_name}
                                </span>
                                {m.is_recommended && (
                                  <Tag color="blue" className="text-[10px] font-bold">
                                    KHUYÊN DÙNG
                                  </Tag>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {m.id}
                              </div>
                              {m.description && (
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                                  {m.description}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                    </Form.Item>
                      </>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="primary"
                    size="large"
                    block
                    htmlType="submit"
                    loading={loading}
                    icon={<Sparkles className="w-5 h-5" />}
                    className="h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:opacity-95 shadow-lg shadow-blue-500/25 font-bold text-base rounded-xl"
                  >
                    {loading ? 'Đang Phân Tích & Hoạch Định Bằng Gemini AI...' : 'Tạo Danh Mục Phân Bổ Bằng AI'}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'result',
              disabled: !currentResult,
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                  <PieChartIcon className="w-4 h-4" /> Kết Quả Phân Bổ AI
                </span>
              ),
              children: currentResult ? (
                <div className="space-y-6 pt-2">
                  {/* Top Summary Banner */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-indigo-500/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="small"
                            icon={<Printer className="w-3.5 h-3.5" />}
                            onClick={() => handleExportPdf(currentResult)}
                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs flex items-center gap-1 backdrop-blur-sm"
                          >
                            Xuất Báo Cáo PDF
                          </Button>
                          <Tag color="cyan" className="font-bold uppercase text-[11px]">
                            {currentResult.data.risk_profile} STRATEGY
                          </Tag>
                          <Tag
                            color="blue"
                            className="font-mono font-bold text-[11px] border-indigo-400/40 bg-indigo-900/70 text-indigo-200 flex items-center gap-1.5 px-2.5 py-0.5 rounded-md"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-300 shrink-0" />
                            <span>
                              {currentResult.data.ai_provider === 'openai'
                                ? 'OpenAI'
                                : currentResult.data.ai_provider === 'local'
                                ? 'Local AI'
                                : 'Google Gemini'}
                              {currentResult.data.ai_model ? ` • ${currentResult.data.ai_model}` : ''}
                            </span>
                          </Tag>
                          <span className="text-xs text-slate-400">
                            Khởi tạo: {new Date(currentResult.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <h2 className="text-2xl font-black text-white mt-1 mono-font">
                          {formatVnd(currentResult.total_capital)}
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                          {currentResult.data.executive_summary}
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end justify-center p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 min-w-[200px]">
                        <span className="text-[11px] text-slate-300 uppercase font-semibold">
                          Kỳ Vọng Sinh Lời Danh Mục
                        </span>
                        <span className="text-xl font-bold text-emerald-400 mono-font mt-0.5">
                          {currentResult.data.estimated_portfolio_yield || '+20% - +30%/năm'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Visuals: Table + Donut Chart */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Donut Chart */}
                    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-center shadow-sm">
                      <div className="text-center font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">
                        Tỷ Lệ Phân Bổ Từng Mã
                      </div>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {pieChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value: any) => [formatVnd(Number(value)), 'Vốn phân bổ']}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    {/* Table View */}
                    <div className="lg:col-span-2">
                      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span>Bảng Chi Tiết Phân Bổ ({currentResult.data.summary_table.length} mã cổ phiếu)</span>
                          <span className="text-xs font-normal text-slate-500">
                            Chuẩn giao dịch lô 100 CP
                          </span>
                        </div>
                        <Table
                          dataSource={currentResult.data.summary_table}
                          columns={columns}
                          pagination={false}
                          rowKey="ticker"
                          size="small"
                          className="portfolio-summary-table"
                        />
                      </Card>
                    </div>
                  </div>

                  {/* Position Cards Strategy */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-base text-slate-800 dark:text-slate-100">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <span>Chi Tiết Chiến Lược Từng Vị Thế ({currentResult.data.detailed_strategies?.length || 0} mã)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentResult.data.detailed_strategies?.map((strat) => {
                        const isSafe = strat.badge_type === 'SAFE' || strat.asset_class.includes('VN30');
                        const isMedium = strat.badge_type === 'MEDIUM' || strat.asset_class.includes('Midcap');
                        
                        const borderCls = isSafe
                          ? 'border-blue-300 dark:border-blue-900 bg-blue-50/20 dark:bg-slate-900'
                          : isMedium
                          ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/20 dark:bg-slate-900'
                          : 'border-amber-300 dark:border-amber-900 bg-amber-50/20 dark:bg-slate-900';

                        const badgeColor = isSafe ? 'blue' : isMedium ? 'green' : 'gold';

                        return (
                          <Card
                            key={strat.ticker}
                            className={`rounded-2xl border ${borderCls} shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {strat.title}
                                </span>
                                <Tag color={badgeColor} className="font-bold text-xs">
                                  {strat.percentage}% VỐN
                                </Tag>
                              </div>

                              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                                {strat.position_analysis}
                              </div>

                              <div className="space-y-2 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 text-xs mb-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-medium">Vùng Mua Gom:</span>
                                  <span className="font-bold text-blue-600 dark:text-blue-400 mono-font">
                                    {strat.buy_zone}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-medium">Kỳ Vọng Chốt Lời:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mono-font">
                                    {strat.profit_target_zone}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 font-medium">Ngưỡng Cắt Lỗ:</span>
                                  <span className="font-bold text-rose-600 dark:text-rose-400 mono-font">
                                    {strat.stop_loss_zone}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                                  💡 Cách Giải Ngân:
                                </span>
                                {strat.execution_strategy}
                              </div>
                            </div>

                            {strat.risk_notes && (
                              <div className="mt-3 text-[10px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{strat.risk_notes}</span>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* Market Cycle & Risk Rules */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Kỷ Luật Giao Dịch & Quản Trị Rủi Ro
                    </div>
                    <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      {currentResult.data.risk_management_rules?.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Quick Action Button: Apply To Watchlist & Export PDF */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Button
                        type="default"
                        onClick={() => setActiveTab('create')}
                        className="font-medium"
                      >
                        Thiết Lập Lại Danh Mục Mới
                      </Button>
                      <Button
                        type="default"
                        icon={<Printer className="w-4 h-4 text-blue-600" />}
                        onClick={() => handleExportPdf(currentResult)}
                        className="font-semibold flex items-center gap-1.5 border-blue-300 dark:border-blue-700 hover:text-blue-600"
                      >
                        Xuất Báo Cáo PDF
                      </Button>
                    </div>

                    <Button
                      type="primary"
                      size="large"
                      onClick={handleApplyToWatchlist}
                      loading={applying}
                      icon={<Zap className="w-4 h-4 text-amber-300" />}
                      className="bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/25 px-6"
                    >
                      Áp Dụng Tất Cả {currentResult.data.summary_table.length} Mã Vào Danh Mục Theo Dõi (Bật Bot Canh TP/SL)
                    </Button>
                  </div>
                </div>
              ) : null,
            },
            {
              key: 'history',
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-sm">
                  <History className="w-4 h-4 text-purple-500" />
                  Lịch Sử Phân Bổ AI {historyList.length > 0 && `(${historyList.length})`}
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 m-0 text-sm">
                        <History className="w-4 h-4 text-purple-600" /> Danh Sách Kết Quả Phân Bổ AI Đã Lưu
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
                        Xem lại các kịch bản phân bổ vốn đã được AI tính toán trong quá khứ, tra cứu chi tiết hoặc xuất ra file PDF.
                      </p>
                    </div>
                    <Button
                      size="small"
                      onClick={fetchHistory}
                      loading={loadingHistory}
                      icon={<RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />}
                      className="text-xs font-semibold flex items-center gap-1"
                    >
                      Làm mới
                    </Button>
                  </div>

                  <Table
                    dataSource={historyList}
                    rowKey="id"
                    loading={loadingHistory}
                    pagination={{ pageSize: 8, showTotal: (total) => `Tổng cộng ${total} bản ghi` }}
                    columns={historyColumns}
                    size="middle"
                    className="portfolio-history-table rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
                  />
                </div>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
};
