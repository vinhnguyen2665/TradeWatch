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
  Globe,
} from 'lucide-react';
import { SystemSettings, UserAIConfig, AIProviderType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getSettings,
  updateSettings,
  testTelegramConnection,
  getUserAIConfig,
  updateUserAIConfig,
} from '../services/api';
import {
  LANGUAGE_OPTIONS,
  USER_ROLES,
  BOT_STATUS,
  ROLE_LABELS,
} from '../constants';

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
  const { user, updateProfile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const isAdmin = user?.role === USER_ROLES.ADMIN;

  const [form] = Form.useForm();
  const adminChatIdWatch = Form.useWatch('telegram_chat_id', form);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingTelegram, setTestingTelegram] = useState<boolean>(false);
  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);

  // Active Tab state: Nếu là admin mặc định mở 'system', nếu user thường thì mặc định mở 'ai'
  const [activeTab, setActiveTab] = useState<'system' | 'ai' | 'telegram' | 'language'>('ai');

  // Telegram Chat ID cá nhân của User
  const [userTelegramChatId, setUserTelegramChatId] = useState<string>(user?.telegram_chat_id || '');

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
      setUserTelegramChatId(user?.telegram_chat_id || '');
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
      } else {
        setActiveTab(isAdmin ? 'system' : 'ai');
      }
    }
  }, [visible, focusField, isAdmin, user?.telegram_chat_id]);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      setUserTelegramChatId(user?.telegram_chat_id || '');
      if (isAdmin) {
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
            telegram_chat_id: sysData.telegram_chat_id || user?.telegram_chat_id || '',
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
      } else {
        // Người dùng thường: Gọi API cấu hình AI cá nhân
        const aiData = await getUserAIConfig().catch(() => null);
        if (aiData) {
          setUserAIConfig(aiData);
          setAiProvider(aiData.ai_provider || 'gemini');
          setGeminiKeyInput(aiData.gemini_api_key_set ? '****************' : '');
          setOpenaiKeyInput(aiData.openai_api_key_set ? '****************' : '');
          setLocalBaseUrlInput(aiData.local_ai_base_url || '');
          setLocalKeyInput(aiData.local_ai_api_key_set ? '****************' : '');
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      message.error(t('common.error'));
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

      // 2. Lưu Telegram Chat ID vào Profile cá nhân nếu có thay đổi
      const trimmedUserChatId = userTelegramChatId.trim();
      if (trimmedUserChatId !== (user?.telegram_chat_id || '')) {
        await updateProfile({ telegram_chat_id: trimmedUserChatId });
      }

      // 3. Chỉ Lưu Cấu hình Hệ thống nếu người dùng là ADMIN
      if (isAdmin) {
        const formValues = form.getFieldsValue();
        const sysPayload: any = {
          polling_interval_sec: Number(formValues.polling_interval_sec || 10),
          alert_cooldown_min: Number(formValues.alert_cooldown_min || 30),
          bot_status: formValues.bot_status ? BOT_STATUS.RUNNING : BOT_STATUS.PAUSED,
          trade_hours_only: Boolean(formValues.trade_hours_only),
          telegram_chat_id: formValues.telegram_chat_id || trimmedUserChatId,
        };

        if (formValues.telegram_bot_token && formValues.telegram_bot_token.trim()) {
          sysPayload.telegram_bot_token = formValues.telegram_bot_token.trim();
        }

        await updateSettings(sysPayload);
      }

      message.success(isAdmin ? t('settings.saveSuccessAdmin') : t('settings.saveSuccessUser'));
      onSettingsUpdated();
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu cài đặt:', err);
      message.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      if (isAdmin) {
        const currentToken = form.getFieldValue('telegram_bot_token');
        const currentChatId = form.getFieldValue('telegram_chat_id') || userTelegramChatId;
        const res = await testTelegramConnection({
          bot_token: currentToken || undefined,
          chat_id: currentChatId || undefined,
        });
        if (res.success) {
          message.success(t('settings.testSuccess'));
        }
      } else {
        if (!userTelegramChatId || !userTelegramChatId.trim()) {
          message.warning(t('settings.tgIdUnbound'));
          setTestingTelegram(false);
          return;
        }
        const res = await testTelegramConnection({
          chat_id: userTelegramChatId.trim(),
        });
        if (res.success) {
          message.success(t('settings.testSuccess'));
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.detail || t('settings.testFail'));
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
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {isAdmin ? t('settings.titleAdmin') : t('settings.titleUser')}
            </div>
            <div className="text-[11px] font-normal text-slate-500">
              {isAdmin ? t('settings.descAdmin') : t('settings.descUser')}
            </div>
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
          {t('settings.saveAllBtn')}
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        className="settings-tabs"
        items={[
          ...(isAdmin
            ? [
              {
                key: 'system',
                label: (
                  <span className="flex items-center gap-1.5 font-semibold text-xs">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    {t('settings.tabSystem')}
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
                        <div className="text-sm font-semibold text-slate-800 dark:text-white">{t('settings.botStatus')}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('settings.botStatusDesc')}</div>
                      </div>
                      <Form.Item name="bot_status" valuePropName="checked" noStyle>
                        <Switch checkedChildren={BOT_STATUS.RUNNING} unCheckedChildren={BOT_STATUS.PAUSED} />
                      </Form.Item>
                    </div>

                    {/* Trade Hours Only Switch */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="pr-4">
                        <div className="text-sm font-semibold text-slate-800 dark:text-white">{t('settings.tradeHours')}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {t('settings.tradeHoursDesc')}
                        </div>
                      </div>
                      <Form.Item name="trade_hours_only" valuePropName="checked" noStyle>
                        <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                      </Form.Item>
                    </div>

                    {/* Polling Interval */}
                    <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" bodyStyle={{ padding: '14px' }}>
                      <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase">
                        <Clock className="w-4 h-4" /> {t('settings.pollingSec')}
                      </div>
                      <Form.Item
                        name="polling_interval_sec"
                        label={<span className="text-xs font-medium">{t('settings.pollingSecLabel')}</span>}
                        rules={[{ required: true, message: '5 - 3600' }]}
                        help={<span className="text-[11px] text-slate-500 dark:text-slate-400">{t('settings.pollingSecHelp')}</span>}
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
                        <ShieldAlert className="w-4 h-4" /> {t('settings.cooldown')}
                      </div>
                      <Form.Item
                        name="alert_cooldown_min"
                        label={<span className="text-xs font-medium">{t('settings.cooldownLabel')}</span>}
                        rules={[{ required: true, message: '1 - 1440' }]}
                        help={<span className="text-[11px] text-slate-500 dark:text-slate-400">{t('settings.cooldownHelp')}</span>}
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
            ]
            : []),
          {
            key: 'ai',
            label: (
              <span className="flex items-center gap-1.5 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                {t('settings.tabAi')}
              </span>
            ),
            children: (
              <div className="space-y-4 pt-1">
                {/* Information Callout */}
                <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {t('settings.aiCalloutTitle')}
                  </div>
                  <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                    {t('settings.aiCalloutDesc')}{' '}
                    <code className="font-mono bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.5 rounded">****************</code>.
                  </p>
                </div>

                {/* Default Engine Switcher */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('settings.selectDefaultEngine')}
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
                        {t('settings.geminiTitle')}
                      </span>
                    </div>
                    {userAIConfig?.gemini_api_key_set ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.keyConfigured')}
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        {t('settings.noKey')}
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {t('settings.geminiKeyLabel')}
                      </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {t('settings.geminiLinkText')} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <Input.Password
                      ref={geminiInputRef}
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      placeholder={userAIConfig?.gemini_api_key_set ? "****************" : t('settings.geminiPlaceholder')}
                      className="font-mono text-xs"
                      allowClear
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                    <div className="text-[10px] text-slate-400">
                      {t('settings.geminiSupportedModels')} <code className="text-amber-600 font-mono">gemini-2.5-flash</code>, <code className="text-amber-600 font-mono">gemini-1.5-flash</code>, <code className="text-amber-600 font-mono">gemini-2.5-pro</code>.
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
                        {t('settings.openaiTitle')}
                      </span>
                    </div>
                    {userAIConfig?.openai_api_key_set ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.keyConfigured')}
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        {t('settings.noKey')}
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {t('settings.openaiKeyLabel')}
                      </span>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {t('settings.openaiLinkText')} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <Input.Password
                      ref={openaiInputRef}
                      value={openaiKeyInput}
                      onChange={(e) => setOpenaiKeyInput(e.target.value)}
                      placeholder={userAIConfig?.openai_api_key_set ? "****************" : t('settings.openaiPlaceholder')}
                      className="font-mono text-xs"
                      allowClear
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                    <div className="text-[10px] text-slate-400">
                      {t('settings.openaiSupportedModels')} <code className="text-emerald-600 font-mono">gpt-4o-mini</code> {t('settings.openaiFast')}, <code className="text-emerald-600 font-mono">gpt-4o</code>, <code className="text-emerald-600 font-mono">o3-mini</code>.
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
                        {t('settings.localAiTitle')}
                      </span>
                    </div>
                    {userAIConfig?.local_ai_base_url ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.configured')}
                      </Tag>
                    ) : (
                      <Tag color="default" className="text-[10px] font-bold m-0">
                        {t('settings.notConfigured')}
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        {t('settings.localAiUrlLabel')}
                      </span>
                      <Input
                        value={localBaseUrlInput}
                        onChange={(e) => setLocalBaseUrlInput(e.target.value)}
                        placeholder={t('settings.localAiUrlPlaceholder')}
                        className="font-mono text-xs"
                        allowClear
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <div className="text-[10px] text-slate-400 mt-1">
                        {t('settings.localAiDefaultHint')} <code className="text-blue-500 font-mono">http://localhost:11434/v1</code> • {t('settings.localAiLmHint')} <code className="text-blue-500 font-mono">http://localhost:1234/v1</code>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        {t('settings.localAiKeyLabel')}
                      </span>
                      <Input.Password
                        value={localKeyInput}
                        onChange={(e) => setLocalKeyInput(e.target.value)}
                        placeholder={userAIConfig?.local_ai_api_key_set ? "****************" : t('settings.localAiKeyPlaceholder')}
                        className="font-mono text-xs"
                        allowClear
                        autoComplete="new-password"
                        spellCheck={false}
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
                {isAdmin ? t('settings.tabTelegramAdmin') : t('settings.tabTelegramUser')}
              </span>
            ),
            children: isAdmin ? (
              <Form
                form={form}
                layout="vertical"
                className="space-y-4 pt-1"
              >
                {/* Bot Info & Direct Link Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-slate-900 text-white shadow-md border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-200 font-medium">{t('settings.botBannerSystem')}</div>
                      <div className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                        @trade_zero9vn_bot
                      </div>
                    </div>
                  </div>
                  <a
                    href="https://t.me/trade_zero9vn_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-colors shrink-0"
                  >
                    {t('settings.openBotBtn')} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* 1. Bot Token Configuration */}
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-3" bodyStyle={{ padding: '16px' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase">
                      <Key className="w-4 h-4" /> {t('settings.botTokenTitle')}
                    </div>
                    {settingsData?.telegram_bot_token_set ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.tokenConfigured')}
                      </Tag>
                    ) : (
                      <Tag color="warning" className="text-[10px] font-bold m-0">
                        {t('settings.noToken')}
                      </Tag>
                    )}
                  </div>

                  <Form.Item
                    name="telegram_bot_token"
                    label={<span className="text-xs font-medium">Telegram Bot Token</span>}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">{t('settings.botTokenHelp')}</span>}
                  >
                    <Input.Password
                      placeholder={t('settings.botTokenPlaceholder')}
                      autoComplete="new-password"
                      spellCheck={false}
                    />
                  </Form.Item>
                </Card>

                {/* 2. System Chat ID / Group ID Configuration */}
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-3" bodyStyle={{ padding: '16px' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase">
                      <Send className="w-4 h-4" /> {t('settings.tgSystemTitle')}
                    </div>
                    {(adminChatIdWatch || form.getFieldValue('telegram_chat_id')) ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.tgIdBound')} {adminChatIdWatch || form.getFieldValue('telegram_chat_id')}
                      </Tag>
                    ) : (
                      <Tag color="warning" className="text-[10px] font-bold m-0">
                        {t('settings.tgIdUnbound')}
                      </Tag>
                    )}
                  </div>

                  <Form.Item
                    name="telegram_chat_id"
                    label={<span className="text-xs font-medium">{t('settings.tgSystemLabel')}</span>}
                    rules={[{ required: false }]}
                    help={<span className="text-[11px] text-slate-500 dark:text-slate-400">{t('settings.tgSystemHelp')}</span>}
                  >
                    <Input
                      placeholder={t('settings.tgSystemPlaceholder')}
                      className="mono-font text-xs"
                      allowClear
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Form.Item>

                  {/* Step by step guide identical to user */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-2.5 mt-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <HelpCircle className="w-4 h-4" /> {t('settings.tgGuideTitle')}
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <div>
                          {t('settings.tgStep1Admin')}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <div>
                          {t('settings.tgStep2Admin')}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                        <div>
                          {t('settings.tgStep3Admin')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="dashed"
                    block
                    icon={<MessageSquare className="w-4 h-4" />}
                    onClick={handleTestTelegram}
                    loading={testingTelegram}
                    className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 hover:text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 mt-2 font-semibold"
                  >
                    {t('settings.testAlertBtnSystem')}
                  </Button>
                </Card>
              </Form>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Bot Info & Direct Link Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-slate-900 text-white shadow-md border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Send className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-200 font-medium">{t('settings.botBannerUser')}</div>
                      <div className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                        @trade_zero9vn_bot
                      </div>
                    </div>
                  </div>
                  <a
                    href="https://t.me/trade_zero9vn_bot"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-colors shrink-0"
                  >
                    {t('settings.openBotBtn')} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-3" bodyStyle={{ padding: '16px' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs uppercase">
                      <Send className="w-4 h-4" /> {t('settings.tgChatIdPersonal')}
                    </div>
                    {userTelegramChatId?.trim() ? (
                      <Tag color="success" className="text-[10px] font-bold m-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('settings.tgIdBound')} {userTelegramChatId}
                      </Tag>
                    ) : (
                      <Tag color="warning" className="text-[10px] font-bold m-0">
                        {t('settings.tgIdUnbound')}
                      </Tag>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                      {t('settings.tgPersonalLabel')}
                    </label>
                    <Input
                      value={userTelegramChatId}
                      onChange={(e) => setUserTelegramChatId(e.target.value)}
                      placeholder={t('settings.tgPersonalPlaceholder')}
                      className="mono-font text-xs"
                      allowClear
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('settings.tgPersonalHelp')}
                    </div>
                  </div>

                  {/* Step by step guide */}
                  <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-2.5 mt-2">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <HelpCircle className="w-4 h-4" /> {t('settings.tgGuideTitle')}
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <div>
                          {t('settings.tgStep1User')}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <div>
                          {t('settings.tgStep2User')}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                        <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                        <div>
                          {t('settings.tgStep3User')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="dashed"
                    block
                    icon={<MessageSquare className="w-4 h-4" />}
                    onClick={handleTestTelegram}
                    loading={testingTelegram}
                    className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 hover:text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 mt-2 font-semibold"
                  >
                    {t('settings.testAlertBtnUser')}
                  </Button>
                </Card>
              </div>
            ),
          },
          {
            key: 'language',
            label: (
              <span className="flex items-center gap-1.5 font-semibold text-xs">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                {t('settings.tabLanguage')}
              </span>
            ),
            children: (
              <div className="space-y-4 pt-1">
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-4" bodyStyle={{ padding: '16px' }}>
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t('settings.langDesc')}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const isSelected = language === opt.code;
                      return (
                        <div
                          key={opt.code}
                          onClick={() => setLanguage(opt.code)}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{opt.flag}</span>
                            <div>
                              <div className={`text-sm font-bold ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {opt.label}
                              </div>
                              <div className="text-[11px] text-slate-400 uppercase font-mono">{opt.code}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
