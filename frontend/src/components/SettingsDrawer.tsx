import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Button,
  Switch,
  Divider,
  message,
  Card,
  Tabs,
  Segmented,
  Tag,
  Tooltip,
} from 'antd';
import {
  Send,
  Clock,
  ShieldAlert,
  Bot,
  MessageSquare,
  Sparkles,
  Key,
  Server,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { SystemSettings, UserAIConfig, AIProviderType } from '../types';
import {
  getSettings,
  updateSettings,
  testTelegramConnection,
  getUserAIConfig,
  updateUserAIConfig,
} from '../services/api';

interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
  focusField?: string | null;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  visible,
  onClose,
  onSettingsUpdated,
  focusField,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingTelegram, setTestingTelegram] = useState<boolean>(false);
  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'ai' | 'system' | 'telegram'>('ai');

  // User AI Settings state
  const [userAIConfig, setUserAIConfig] = useState<UserAIConfig | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProviderType>('gemini');
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState<string>('');
  const [localBaseUrlInput, setLocalBaseUrlInput] = useState<string>('');
  const [localKeyInput, setLocalKeyInput] = useState<string>('');

  const geminiInputRef = React.useRef<any>(null);
  const openaiInputRef = React.useRef<any>(null);

  useEffect(() => {
    if (visible) {
      loadAllSettings();
      if (focusField === 'gemini_api_key' || focusField === 'ai_config' || focusField === 'openai_api_key') {
        setActiveTab('ai');
        setTimeout(() => {
          if (focusField === 'openai_api_key') {
            openaiInputRef.current?.focus();
          } else {
            geminiInputRef.current?.focus();
          }
        }, 250);
      } else if (focusField === 'telegram') {
        setActiveTab('telegram');
      }
    }
  }, [visible, focusField]);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const [sysData, aiData] = await Promise.all([
        getSettings().catch(() => null),
        getUserAIConfig().catch(() => null),
      ]);

      if (sysData) {
        setSettingsData(sysData);
        form.setFieldsValue({
          polling_interval_sec: sysData.polling_interval_sec,
          alert_cooldown_min: sysData.alert_cooldown_min,
          bot_status: sysData.bot_status === 'RUNNING',
          trade_hours_only: sysData.trade_hours_only ?? true,
          telegram_chat_id: sysData.telegram_chat_id || '',
          telegram_bot_token: '',
        });
      }

      if (aiData) {
        setUserAIConfig(aiData);
        setAiProvider(aiData.ai_provider || 'gemini');
        setGeminiKeyInput(aiData.gemini_api_key_set ? '****************' : '');
        setOpenaiKeyInput(aiData.openai_api_key_set ? '****************' : '');
        setLocalBaseUrlInput(aiData.local_ai_base_url || '');
        setLocalKeyInput(aiData.local_ai_api_key_set ? '****************' : '');
      }
    } catch (err) {
      console.error('Lỗi khi tải cài đặt:', err);
      message.error('Không thể tải dữ liệu cài đặt');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. Lưu Cấu hình AI riêng biệt của User
      const aiPayload: any = {
        ai_provider: aiProvider,
        local_ai_base_url: localBaseUrlInput.trim(),
      };

      if (geminiKeyInput && !geminiKeyInput.startsWith('****')) {
        aiPayload.gemini_api_key = geminiKeyInput.trim();
      } else if (geminiKeyInput === '') {
        aiPayload.gemini_api_key = '';
      }

      if (openaiKeyInput && !openaiKeyInput.startsWith('****')) {
        aiPayload.openai_api_key = openaiKeyInput.trim();
      } else if (openaiKeyInput === '') {
        aiPayload.openai_api_key = '';
      }

      if (localKeyInput && !localKeyInput.startsWith('****')) {
        aiPayload.local_ai_api_key = localKeyInput.trim();
      } else if (localKeyInput === '') {
        aiPayload.local_ai_api_key = '';
      }

      await updateUserAIConfig(aiPayload);

      // 2. Lưu Cấu hình Hệ thống & Telegram
      const formValues = form.getFieldsValue();
      const sysPayload: any = {
        polling_interval_sec: Number(formValues.polling_interval_sec || 10),
        alert_cooldown_min: Number(formValues.alert_cooldown_min || 30),
        bot_status: formValues.bot_status ? 'RUNNING' : 'PAUSED',
        trade_hours_only: Boolean(formValues.trade_hours_only),
        telegram_chat_id: formValues.telegram_chat_id,
      };

      if (formValues.telegram_bot_token && formValues.telegram_bot_token.trim()) {
        sysPayload.telegram_bot_token = formValues.telegram_bot_token.trim();
      }

      await updateSettings(sysPayload);

      message.success('Cập nhật cấu hình cài đặt và lưu API Key thành công!');
      onSettingsUpdated();
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu cài đặt:', err);
      message.error(err.response?.data?.detail || 'Lỗi khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    const currentToken = form.getFieldValue('telegram_bot_token');
    const currentChatId = form.getFieldValue('telegram_chat_id');

    setTestingTelegram(true);
    try {
      const res = await testTelegramConnection({
        bot_token: currentToken || undefined,
        chat_id: currentChatId || undefined,
      });
      if (res.success) {
        message.success('Đã gửi tin nhắn thử nghiệm tới Telegram của bạn!');
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Gửi thử nghiệm thất bại. Vui lòng kiểm tra lại Token và Chat ID.');
    } finally {
      setTestingTelegram(false);
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2.5 font-bold">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">Cài Đặt Hệ Thống & AI Engine</div>
            <div className="text-[11px] font-normal text-slate-500">Quản lý API Key cá nhân, chu kỳ quét giá & Telegram</div>
          </div>
        </div>
      }
      placement="right"
      width={560}
      zIndex={1050}
      onClose={onClose}
      open={visible}
      extra={
        <Button
          type="primary"
          onClick={handleSaveAll}
          loading={saving || loading}
          className="bg-blue-600 hover:bg-blue-500 font-semibold"
        >
          Lưu Cài Đặt
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        className="settings-tabs"
        items={[
          {
            key: 'system',
            label: (
              <span className="flex items-center gap-1.5 font-semibold text-xs">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Hệ Thống & Quét Giá
              </span>
            ),
            children: (
              <Form
                form={form}
                layout="vertical"
                className="space-y-4 pt-1"
              >
                {/* Bot Status Switch */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">Trạng thái Quét Tự động</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bật hoặc tạm dừng toàn bộ scheduler</div>
                  </div>
                  <Form.Item name="bot_status" valuePropName="checked" noStyle>
                    <Switch checkedChildren="RUNNING" unCheckedChildren="PAUSED" />
                  </Form.Item>
                </div>

                {/* Trade Hours Only Switch */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="pr-4">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">Chỉ Quét Trong Giờ Giao Dịch</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Chỉ chạy crawler vào: 09:00 - 11:30 & 13:00 - 15:00 (T2 - T6). Tạm nghỉ vào buổi tối, giờ nghỉ trưa & cuối tuần.
                    </div>
                  </div>
                  <Form.Item name="trade_hours_only" valuePropName="checked" noStyle>
                    <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
                  </Form.Item>
                </div>

                {/* Polling Interval */}
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" bodyStyle={{ padding: '14px' }}>
                  <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase">
                    <Clock className="w-4 h-4" /> Chu kỳ Quét Giá (Dynamic Polling)
                  </div>
                  <Form.Item
                    name="polling_interval_sec"
                    label={<span className="text-xs font-medium">Khoảng thời gian giữa 2 lần quét (giây)</span>}
                    rules={[{ required: true, message: 'Nhập thời gian quét từ 5 đến 3600 giây' }]}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">Thay đổi sẽ áp dụng ngay tức thì (Hot-reload) mà không cần restart backend.</span>}
                  >
                    <InputNumber
                      min={5}
                      max={3600}
                      step={5}
                      className="w-full mono-font"
                    />
                  </Form.Item>
                </Card>

                {/* Anti-spam Cooldown */}
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" bodyStyle={{ padding: '14px' }}>
                  <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-semibold text-xs uppercase">
                    <ShieldAlert className="w-4 h-4" /> Chống Spam Cảnh Báo (Cooldown)
                  </div>
                  <Form.Item
                    name="alert_cooldown_min"
                    label={<span className="text-xs font-medium">Thời gian chờ giữa 2 cảnh báo cùng loại cho 1 mã (phút)</span>}
                    rules={[{ required: true, message: 'Nhập thời gian cooldown từ 1 đến 1440 phút' }]}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">Tránh tràn ngập tin nhắn Telegram khi giá dao động quanh mốc TP/SL.</span>}
                  >
                    <InputNumber
                      min={1}
                      max={1440}
                      step={5}
                      className="w-full mono-font"
                    />
                  </Form.Item>
                </Card>
              </Form>
            ),
          },
          {
            key: 'ai',
            label: (
              <span className="flex items-center gap-1.5 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                AI Engine & API Key
              </span>
            ),
            children: (
              <div className="space-y-4 pt-1">
                {/* Information Callout */}
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Quản lý API Key & Engine AI Cá Nhân
                  </div>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                    Mỗi tài khoản lưu trữ API Key riêng biệt trong cơ sở dữ liệu để tự quản lý quota và đảm bảo an toàn. Khi đã lưu, key được mã hóa và ẩn dưới dạng <code className="font-mono bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.5 rounded">****************</code>.
                  </p>
                </div>

                {/* Default Engine Switcher */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Chọn AI Engine Mặc Định:
                    </span>
                    <Tag color={aiProvider === 'gemini' ? 'gold' : aiProvider === 'openai' ? 'green' : 'blue'}>
                      {aiProvider === 'gemini' ? 'Google Gemini' : aiProvider === 'openai' ? 'OpenAI ChatGPT' : 'Local AI'}
                    </Tag>
                  </div>
                  <Segmented<AIProviderType>
                    value={aiProvider}
                    onChange={(val) => setAiProvider(val)}
                    block
                    size="middle"
                    className="p-1 bg-slate-200/80 dark:bg-slate-800 font-semibold"
                    options={[
                      {
                        label: (
                          <div className="flex items-center justify-center gap-1.5 py-0.5 text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Google Gemini</span>
                          </div>
                        ),
                        value: 'gemini',
                      },
                      {
                        label: (
                          <div className="flex items-center justify-center gap-1.5 py-0.5 text-xs">
                            <Bot className="w-3.5 h-3.5 text-emerald-500" />
                            <span>OpenAI ChatGPT</span>
                          </div>
                        ),
                        value: 'openai',
                      },
                      {
                        label: (
                          <div className="flex items-center justify-center gap-1.5 py-0.5 text-xs">
                            <Server className="w-3.5 h-3.5 text-blue-500" />
                            <span>Local AI</span>
                          </div>
                        ),
                        value: 'local',
                      },
                    ]}
                  />
                </div>

                {/* 1. Google Gemini Card */}
                <Card
                  className={`rounded-xl transition-all ${aiProvider === 'gemini'
                    ? 'border-2 border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                    }`}
                  bodyStyle={{ padding: '14px' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">
                        1. Google Gemini AI (Miễn Phí)
                      </span>
                    </div>
                    {userAIConfig?.gemini_api_key_set ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ĐÃ CẤU HÌNH KEY
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        CHƯA CÓ KEY
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Gemini API Key
                      </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Lấy Key tại Google AI Studio <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <Input.Password
                      ref={geminiInputRef}
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      placeholder={userAIConfig?.gemini_api_key_set ? "****************" : "Dán Gemini API Key (AIzaSy...)"}
                      className="font-mono text-xs"
                      allowClear
                    />
                    <div className="text-[10px] text-slate-400">
                      Hỗ trợ các model tốc độ cao: <code className="text-amber-600 font-mono">gemini-2.5-flash</code>, <code className="text-amber-600 font-mono">gemini-1.5-flash</code>, <code className="text-amber-600 font-mono">gemini-2.5-pro</code>.
                    </div>
                  </div>
                </Card>

                {/* 2. OpenAI Card */}
                <Card
                  className={`rounded-xl transition-all ${aiProvider === 'openai'
                    ? 'border-2 border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                    }`}
                  bodyStyle={{ padding: '14px' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">
                        2. OpenAI ChatGPT (Chính Thức)
                      </span>
                    </div>
                    {userAIConfig?.openai_api_key_set ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ĐÃ CẤU HÌNH KEY
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        CHƯA CÓ KEY
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        OpenAI API Key
                      </span>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Quản lý Key tại OpenAI Platform <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <Input.Password
                      ref={openaiInputRef}
                      value={openaiKeyInput}
                      onChange={(e) => setOpenaiKeyInput(e.target.value)}
                      placeholder={userAIConfig?.openai_api_key_set ? "****************" : "Dán OpenAI API Key (sk-...)"}
                      className="font-mono text-xs"
                      allowClear
                    />
                    <div className="text-[10px] text-slate-400">
                      Hỗ trợ: <code className="text-emerald-600 font-mono">gpt-4o-mini</code> (nhanh & tiết kiệm), <code className="text-emerald-600 font-mono">gpt-4o</code>, <code className="text-emerald-600 font-mono">o3-mini</code>.
                    </div>
                  </div>
                </Card>

                {/* 3. Local AI Card */}
                <Card
                  className={`rounded-xl transition-all ${aiProvider === 'local'
                    ? 'border-2 border-blue-500/50 bg-blue-50/20 dark:bg-blue-950/10 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                    }`}
                  bodyStyle={{ padding: '14px' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200">
                        3. Local AI (Ollama / LM Studio)
                      </span>
                    </div>
                    {userAIConfig?.local_ai_base_url ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ĐÃ CẤU HÌNH
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        CHƯA CẤU HÌNH
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        Endpoint Base URL (OpenAI-compatible)
                      </span>
                      <Input
                        value={localBaseUrlInput}
                        onChange={(e) => setLocalBaseUrlInput(e.target.value)}
                        placeholder="Để trống nếu chưa dùng (VD: http://localhost:11434/v1)"
                        className="font-mono text-xs"
                        allowClear
                      />
                      <div className="text-[10px] text-slate-400 mt-1">
                        Mặc định Ollama: <code className="text-blue-500 font-mono">http://localhost:11434/v1</code> • LM Studio: <code className="text-blue-500 font-mono">http://localhost:1234/v1</code>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        Local API Key (Tùy chọn)
                      </span>
                      <Input.Password
                        value={localKeyInput}
                        onChange={(e) => setLocalKeyInput(e.target.value)}
                        placeholder={userAIConfig?.local_ai_api_key_set ? "****************" : "Bỏ trống nếu không yêu cầu mật khẩu"}
                        className="font-mono text-xs"
                        allowClear
                      />
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'telegram',
            label: (
              <span className="flex items-center gap-1.5 font-semibold text-xs">
                <Send className="w-3.5 h-3.5 text-emerald-500" />
                Telegram Bot
              </span>
            ),
            children: (
              <Form
                form={form}
                layout="vertical"
                className="space-y-4 pt-1"
              >
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-3" bodyStyle={{ padding: '16px' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase">
                      <Send className="w-4 h-4" /> Cấu hình Telegram Bot Alert
                    </div>
                    {settingsData?.telegram_bot_token_set && (
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        TOKEN ĐÃ CẤU HÌNH
                      </span>
                    )}
                  </div>

                  <Form.Item
                    name="telegram_bot_token"
                    label={<span className="text-xs font-medium">Telegram Bot Token</span>}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">Lấy từ @BotFather trên Telegram (VD: 123456789:ABCdef...). Để trống nếu không muốn đổi.</span>}
                  >
                    <Input.Password
                      placeholder="Nhập Bot Token mới..."
                    />
                  </Form.Item>

                  <Form.Item
                    name="telegram_chat_id"
                    label={<span className="text-xs font-medium">Telegram Chat ID / Group ID</span>}
                    rules={[{ required: false }]}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">ID người nhận tin hoặc Group ID (VD: 987654321 hoặc -100123456789).</span>}
                  >
                    <Input
                      placeholder="VD: 123456789"
                      className="mono-font"
                    />
                  </Form.Item>

                  <Button
                    type="dashed"
                    block
                    icon={<MessageSquare className="w-4 h-4" />}
                    onClick={handleTestTelegram}
                    loading={testingTelegram}
                    className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 hover:text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 mt-2 font-medium"
                  >
                    Gửi Tin Nhắn Cảnh Báo Thử Nghiệm
                  </Button>
                </Card>
              </Form>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
