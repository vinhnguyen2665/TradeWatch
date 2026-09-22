import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Slider, Switch } from 'antd';
import { Target, ShieldAlert } from 'lucide-react';
import { PortfolioPosition, PositionFormData } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PositionModalProps {
  visible: boolean;
  editingPosition: PortfolioPosition | null;
  initialData?: Partial<PositionFormData> | null;
  isEdit?: boolean;
  onCancel: () => void;
  onSubmit: (values: PositionFormData, isEdit: boolean) => Promise<void>;
  loading: boolean;
}

export const PositionModal: React.FC<PositionModalProps> = ({
  visible,
  editingPosition,
  initialData,
  isEdit = false,
  onCancel,
  onSubmit,
  loading,
}) => {
  const { t } = useLanguage();
  const [form] = Form.useForm<PositionFormData>();
  const [buyPrice, setBuyPrice] = useState<number>(30.0);
  const [tpPct, setTpPct] = useState<number>(7.0);
  const [slPct, setSlPct] = useState<number>(5.0);

  useEffect(() => {
    if (visible) {
      if (isEdit && editingPosition) {
        const bp = editingPosition.buy_price || 30.0;
        const tp = editingPosition.tp_pct || 7.0;
        const sl = editingPosition.sl_pct || 5.0;
        form.setFieldsValue({
          ticker: editingPosition.ticker,
          company_name: editingPosition.company_name || '',
          buy_price: bp,
          quantity: editingPosition.quantity ?? 100,
          tp_pct: tp,
          sl_pct: sl,
          is_active: editingPosition.is_active ?? true,
        });
        setBuyPrice(bp);
        setTpPct(tp);
        setSlPct(sl);
      } else if (initialData) {
        // Prefilled from Screener or quick add
        const bp = initialData.buy_price || 30.0;
        const tp = initialData.tp_pct || 7.0;
        const sl = initialData.sl_pct || 5.0;
        form.setFieldsValue({
          ticker: initialData.ticker || '',
          company_name: initialData.company_name || '',
          buy_price: bp,
          quantity: initialData.quantity ?? 100,
          tp_pct: tp,
          sl_pct: sl,
          is_active: initialData.is_active ?? true,
        });
        setBuyPrice(bp);
        setTpPct(tp);
        setSlPct(sl);
      } else {
        form.resetFields();
        form.setFieldsValue({
          ticker: '',
          company_name: '',
          buy_price: 30.0,
          quantity: 100,
          tp_pct: 7.0,
          sl_pct: 5.0,
          is_active: true,
        });
        setBuyPrice(30.0);
        setTpPct(7.0);
        setSlPct(5.0);
      }
    }
  }, [visible, isEdit, editingPosition, initialData, form]);

  const targetTpPrice = buyPrice ? buyPrice * (1 + tpPct / 100) : 0;
  const targetSlPrice = buyPrice ? buyPrice * (1 - slPct / 100) : 0;

  const handleFinish = async (values: any) => {
    const finalBuyPrice = Number(values.buy_price) || buyPrice || 25.0;
    const finalQty = Number(values.quantity) >= 0 ? Number(values.quantity) : 100;
    const finalTp = Number(values.tp_pct) || tpPct || 7.0;
    const finalSl = Number(values.sl_pct) || slPct || 5.0;
    const finalActive = values.is_active !== undefined ? Boolean(values.is_active) : true;

    await onSubmit(
      {
        ticker: String(values.ticker || '').trim().toUpperCase(),
        company_name: values.company_name ? String(values.company_name).trim() : undefined,
        buy_price: finalBuyPrice,
        quantity: finalQty,
        tp_pct: finalTp,
        sl_pct: finalSl,
        is_active: finalActive,
      },
      isEdit
    );
  };

  return (
    <Modal
      title={
        <span className="text-lg font-bold">
          {isEdit && editingPosition
            ? `${t('positionModal.editTitle')} ${editingPosition.ticker}`
            : initialData?.ticker
              ? `${t('positionModal.addTitle')} (${initialData.ticker})`
              : t('positionModal.addTitle')}
        </span>
      }
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? t('positionModal.submitEdit') : t('positionModal.submitAdd')}
      cancelText={t('common.cancel')}
      width={600}
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
            label={<span className="font-medium">{t('positionModal.tickerLabel')}</span>}
            rules={[
              { required: true, message: t('positionModal.tickerRequired') },
              { min: 3, max: 10, message: t('positionModal.tickerLength') },
            ]}
          >
            <Input
              placeholder={t('positionModal.tickerPlaceholder')}
              disabled={isEdit}
              className="uppercase font-bold mono-font"
              onChange={(e) => {
                form.setFieldValue('ticker', e.target.value.toUpperCase());
              }}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={<span className="font-medium">{t('positionModal.quantityLabel')}</span>}
            rules={[{ required: true, message: t('positionModal.quantityRequired') }]}
          >
            <InputNumber
              min={0}
              step={1}
              placeholder={t('positionModal.quantityPlaceholder')}
              className="w-full mono-font"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="buy_price"
            label={<span className="font-medium">{t('positionModal.buyPriceLabel')}</span>}
            rules={[{ required: true, message: t('positionModal.buyPriceRequired') }]}
          >
            <InputNumber
              min={0.1}
              step={0.1}
              placeholder={t('positionModal.buyPricePlaceholder')}
              className="w-full mono-font"
              onChange={(val) => setBuyPrice(Number(val) || 0)}
            />
          </Form.Item>

          <Form.Item
            name="company_name"
            label={<span className="font-medium">{t('positionModal.companyNameLabel')}</span>}
          >
            <Input
              placeholder={t('positionModal.companyNamePlaceholder')}
              className="text-xs"
            />
          </Form.Item>
        </div>

        {/* Take Profit Setting */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-semibold">
              <Target className="w-4 h-4" />
              <span>{t('positionModal.tpLabel')}: +{tpPct}%</span>
            </div>
            <div className="text-xs font-bold mono-font bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-700">
              {t('positionModal.tpPriceEst')}: {targetTpPrice.toFixed(2)} (k VND)
            </div>
          </div>
          <Form.Item name="tp_pct" noStyle>
            <Slider
              min={1}
              max={50}
              step={0.5}
              value={tpPct}
              onChange={(val) => {
                setTpPct(val);
                form.setFieldValue('tp_pct', val);
              }}
            />
          </Form.Item>
        </div>

        {/* Stop Loss Setting */}
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 space-y-2">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>{t('positionModal.slLabel')}: -{slPct}%</span>
            </div>
            <div className="text-xs font-bold mono-font bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-700">
              {t('positionModal.slPriceEst')}: {targetSlPrice.toFixed(2)} (k VND)
            </div>
          </div>
          <Form.Item name="sl_pct" noStyle>
            <Slider
              min={1}
              max={30}
              step={0.5}
              value={slPct}
              onChange={(val) => {
                setSlPct(val);
                form.setFieldValue('sl_pct', val);
              }}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="is_active"
          valuePropName="checked"
          className="mb-0"
        >
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-semibold text-xs text-slate-800 dark:text-white">{t('positionModal.enableMonitoring')}</div>
              <div className="text-[11px] text-slate-500">{t('positionModal.enableMonitoringDesc')}</div>
            </div>
            <Switch />
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
