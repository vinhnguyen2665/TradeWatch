import React, { useEffect, useState } from 'react';
import { Drawer, Form, Input, InputNumber, Button, Switch, Divider, message, Card } from 'antd';
import {
  Send,
  Clock,
  ShieldAlert,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { SystemSettings } from '../types';
import { getSettings, updateSettings, testTelegramConnection } from '../services/api';

interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  visible,
  onClose,
  onSettingsUpdated,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [testingTelegram, setTestingTelegram] = useState<boolean>(false);
  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettingsData(data);
      form.setFieldsValue({
        polling_interval_sec: data.polling_interval_sec,
        alert_cooldown_min: data.alert_cooldown_min,
        bot_status: data.bot_status === 'RUNNING',
        trade_hours_only: data.trade_hours_only ?? true,
        telegram_chat_id: data.telegram_chat_id || '',
        telegram_bot_token: '',
      });
    } catch (err) {
      message.error('Không thể tải cài đặt hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      const payload: any = {
        polling_interval_sec: Number(values.polling_interval_sec),
        alert_cooldown_min: Number(values.alert_cooldown_min),
        bot_status: values.bot_status ? 'RUNNING' : 'PAUSED',
        trade_hours_only: Boolean(values.trade_hours_only),
        telegram_chat_id: values.telegram_chat_id,
      };

      if (values.telegram_bot_token && values.telegram_bot_token.trim()) {
        payload.telegram_bot_token = values.telegram_bot_token.trim();
      }

      await updateSettings(payload);
      message.success('Cập nhật cấu hình thành công! Scheduler đã được áp dụng chu kỳ mới.');
      onSettingsUpdated();
      onClose();
    } catch (err) {
      message.error('Lỗi khi lưu cấu hình');
    } finally {
      setLoading(false);
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
        <div className="flex items-center gap-2 font-bold">
          <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Cấu hình Hệ thống & Cảnh báo Telegram</span>
        </div>
      }
      placement="right"
      width={480}
      onClose={onClose}
      open={visible}
      extra={
        <Button
          type="primary"
          onClick={() => form.submit()}
          loading={loading}
          className="bg-blue-600 hover:bg-blue-500 font-semibold"
        >
          Lưu Cài Đặt
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        className="space-y-4"
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
        <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
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
        <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
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

        <Divider className="border-slate-200 dark:border-slate-800 my-4" />

        {/* Telegram Bot Configuration */}
        <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
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
    </Drawer>
  );
};
