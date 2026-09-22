import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Slider, Switch } from 'antd';
import { Target, ShieldAlert } from 'lucide-react';
import { PortfolioPosition, PositionFormData } from '../types';

interface PositionModalProps {
  visible: boolean;
  editingPosition: PortfolioPosition | null;
  onCancel: () => void;
  onSubmit: (values: PositionFormData) => Promise<void>;
  loading: boolean;
}

export const PositionModal: React.FC<PositionModalProps> = ({
  visible,
  editingPosition,
  onCancel,
  onSubmit,
  loading,
}) => {
  const [form] = Form.useForm<PositionFormData>();
  const [buyPrice, setBuyPrice] = useState<number>(30.0);
  const [tpPct, setTpPct] = useState<number>(7.0);
  const [slPct, setSlPct] = useState<number>(5.0);

  useEffect(() => {
    if (visible) {
      if (editingPosition) {
        form.setFieldsValue({
          ticker: editingPosition.ticker,
          company_name: editingPosition.company_name || '',
          buy_price: editingPosition.buy_price,
          quantity: editingPosition.quantity,
          tp_pct: editingPosition.tp_pct,
          sl_pct: editingPosition.sl_pct,
          is_active: editingPosition.is_active,
        });
        setBuyPrice(editingPosition.buy_price);
        setTpPct(editingPosition.tp_pct);
        setSlPct(editingPosition.sl_pct);
      } else {
        form.resetFields();
        form.setFieldsValue({
          ticker: '',
          company_name: '',
          buy_price: 30.0,
          quantity: 1000,
          tp_pct: 7.0,
          sl_pct: 5.0,
          is_active: true,
        });
        setBuyPrice(30.0);
        setTpPct(7.0);
        setSlPct(5.0);
      }
    }
  }, [visible, editingPosition, form]);

  const targetTpPrice = buyPrice ? buyPrice * (1 + tpPct / 100) : 0;
  const targetSlPrice = buyPrice ? buyPrice * (1 - slPct / 100) : 0;

  const handleFinish = async (values: PositionFormData) => {
    await onSubmit({
      ...values,
      ticker: values.ticker.trim().toUpperCase(),
      company_name: values.company_name?.trim() || undefined,
      buy_price: Number(values.buy_price),
      quantity: Number(values.quantity),
      tp_pct: Number(values.tp_pct),
      sl_pct: Number(values.sl_pct),
    });
  };

  return (
    <Modal
      title={
        <span className="text-lg font-bold">
          {editingPosition ? `Chỉnh sửa Vị thế ${editingPosition.ticker}` : 'Thêm Cổ phiếu vào Danh mục Theo dõi'}
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={editingPosition ? 'Lưu thay đổi' : 'Thêm vào danh mục'}
      cancelText="Hủy"
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        className="mt-4 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="ticker"
            label={<span className="font-medium">Mã Cổ phiếu (HOSE / HNX / UPCoM)</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập mã cổ phiếu' },
              { min: 3, max: 10, message: 'Mã từ 3 đến 10 ký tự' },
            ]}
          >
            <Input
              placeholder="VD: FPT, HPG, SSI, TAL..."
              disabled={!!editingPosition}
              className="uppercase font-bold mono-font"
              onChange={(e) => {
                form.setFieldValue('ticker', e.target.value.toUpperCase());
              }}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={<span className="font-medium">Số lượng CP</span>}
            rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
          >
            <InputNumber
              min={100}
              step={100}
              className="w-full mono-font"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="company_name"
          label={<span className="font-medium">Tên Doanh nghiệp (Tùy chọn - Tự động tra cứu nếu để trống)</span>}
        >
          <Input
            placeholder="VD: CTCP FPT, Công ty CP Đầu tư Bất động sản Taseco..."
          />
        </Form.Item>

        <Form.Item
          name="buy_price"
          label={<span className="font-medium">Giá vốn mua vào (x1,000 VNĐ)</span>}
          rules={[{ required: true, message: 'Vui lòng nhập giá vốn' }]}
        >
          <InputNumber
            min={0.1}
            step={0.1}
            className="w-full mono-font"
            placeholder="VD: 135.5 (tương đương 135,500đ)"
            onChange={(val) => setBuyPrice(val || 0)}
          />
        </Form.Item>

        {/* Take Profit (TP) Configuration */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-950/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
              <Target className="w-4 h-4" /> Ngưỡng Chốt lời (Take-Profit %)
            </label>
            <Form.Item name="tp_pct" noStyle>
              <InputNumber
                min={0.5}
                max={100}
                step={0.5}
                size="small"
                formatter={(val) => `+${val}%`}
                className="w-24 font-bold mono-font text-emerald-600 dark:text-emerald-400"
                onChange={(val) => setTpPct(val || 7.0)}
              />
            </Form.Item>
          </div>
          <Slider
            min={1}
            max={50}
            step={0.5}
            value={tpPct}
            onChange={(val) => {
              setTpPct(val);
              form.setFieldValue('tp_pct', val);
            }}
            trackStyle={{ backgroundColor: '#10B981' }}
            handleStyle={{ borderColor: '#10B981' }}
          />
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-100 dark:border-slate-800/80">
            <span>Giá mục tiêu chốt lời:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 mono-font text-sm">
              {targetTpPrice.toFixed(2)} ({((targetTpPrice * 1000)).toLocaleString('vi-VN')} đ)
            </span>
          </div>
        </div>

        {/* Stop Loss (SL) Configuration */}
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-950/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase">
              <ShieldAlert className="w-4 h-4" /> Ngưỡng Cắt lỗ (Stop-Loss %)
            </label>
            <Form.Item name="sl_pct" noStyle>
              <InputNumber
                min={0.5}
                max={50}
                step={0.5}
                size="small"
                formatter={(val) => `-${val}%`}
                className="w-24 font-bold mono-font text-rose-600 dark:text-rose-400"
                onChange={(val) => setSlPct(val || 5.0)}
              />
            </Form.Item>
          </div>
          <Slider
            min={1}
            max={30}
            step={0.5}
            value={slPct}
            onChange={(val) => {
              setSlPct(val);
              form.setFieldValue('sl_pct', val);
            }}
            trackStyle={{ backgroundColor: '#EF4444' }}
            handleStyle={{ borderColor: '#EF4444' }}
          />
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-rose-100 dark:border-slate-800/80">
            <span>Giá ngưỡng cắt lỗ:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 mono-font text-sm">
              {targetSlPrice.toFixed(2)} ({((targetSlPrice * 1000)).toLocaleString('vi-VN')} đ)
            </span>
          </div>
        </div>

        <Form.Item
          name="is_active"
          valuePropName="checked"
          className="mb-0"
        >
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="text-sm text-slate-700 dark:text-slate-300">Bật giám sát tự động cho mã này</span>
            <Switch defaultChecked />
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
