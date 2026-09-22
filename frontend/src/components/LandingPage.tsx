import React, { useState } from 'react';
import { Button, Card, Badge, Tag, Tooltip, Dropdown, MenuProps } from 'antd';
import {
  TrendingUp,
  Shield,
  Zap,
  Bot,
  Activity,
  Send,
  Sparkles,
  PieChart,
  BarChart3,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Clock,
  Layers,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { AuthModal } from './AuthModal';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS, THEME_MODES } from '../constants';

interface LandingPageProps {
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  themeMode,
  onToggleTheme,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const isDark = themeMode === THEME_MODES.DARK;

  const currentLangOption = LANGUAGE_OPTIONS.find((opt) => opt.code === language) || LANGUAGE_OPTIONS[0];

  const langMenuItems: MenuProps['items'] = LANGUAGE_OPTIONS.map((opt) => ({
    key: opt.code,
    label: (
      <div className="flex items-center gap-2 font-medium">
        <span className="text-base">{opt.flag}</span>
        <span>{opt.label}</span>
        {language === opt.code && <span className="ml-auto text-blue-600 font-bold">✓</span>}
      </div>
    ),
    onClick: () => setLanguage(opt.code),
  }));

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setAuthModalVisible(true);
  };

  const sampleStocks = [
    { ticker: 'TAL', name: 'Bất động sản Taseco', price: '23.15', change: '-0.22%', isUp: false, vol: '34,900' },
    { ticker: 'FPT', name: 'Tập đoàn FPT', price: '136.50', change: '+2.40%', isUp: true, vol: '2,840,000' },
    { ticker: 'HPG', name: 'Tập đoàn Hòa Phát', price: '28.90', change: '+1.75%', isUp: true, vol: '14,200,000' },
    { ticker: 'SSI', name: 'Chứng khoán SSI', price: '34.20', change: '+0.88%', isUp: true, vol: '8,650,000' },
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: t('landing.feat1Title'),
      description: t('landing.feat1Desc'),
      badge: t('landing.feat1Badge'),
    },
    {
      icon: <Send className="w-6 h-6 text-blue-500" />,
      title: t('landing.feat2Title'),
      description: t('landing.feat2Desc'),
      badge: t('landing.feat2Badge'),
    },
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
      title: t('landing.feat3Title'),
      description: t('landing.feat3Desc'),
      badge: t('landing.feat3Badge'),
    },
    {
      icon: <Lock className="w-6 h-6 text-emerald-500" />,
      title: t('landing.feat4Title'),
      description: t('landing.feat4Desc'),
      badge: t('landing.feat4Badge'),
    },
    {
      icon: <Clock className="w-6 h-6 text-cyan-500" />,
      title: t('landing.feat5Title'),
      description: t('landing.feat5Desc'),
      badge: t('landing.feat5Badge'),
    },
    {
      icon: <Layers className="w-6 h-6 text-rose-500" />,
      title: t('landing.feat6Title'),
      description: t('landing.feat6Desc'),
      badge: t('landing.feat6Badge'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                TradeWatch Pro
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                VN STOCK REALTIME
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector */}
            <Dropdown menu={{ items: langMenuItems }} placement="bottomRight" arrow>
              <Button
                type="text"
                className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg"
              >
                <Globe className="w-4 h-4 text-blue-500" />
                <span>{currentLangOption.shortLabel}</span>
              </Button>
            </Dropdown>

            <Tooltip title={isDark ? t('header.themeLight') : t('header.themeDark')}>
              <Button
                type="text"
                shape="circle"
                icon={isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                onClick={onToggleTheme}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              />
            </Tooltip>

            <Button
              type="default"
              onClick={() => openAuth('login')}
              className="font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-blue-500 bg-white/50 dark:bg-slate-900/50"
            >
              {t('common.login')}
            </Button>

            <Button
              type="primary"
              onClick={() => openAuth('register')}
              className="bg-blue-600 hover:bg-blue-500 font-semibold shadow-lg shadow-blue-600/30"
            >
              {t('landing.getStartedBtn')}
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 sm:pb-24">
        {/* Background Glowing Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-500/15 via-indigo-500/15 to-emerald-500/15 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-400 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('landing.heroBadge')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-tight">
            <span>{t('landing.heroTitlePrefix')} </span>
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 bg-clip-text text-transparent">
              {t('landing.heroTitleHighlight')}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroDesc')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="primary"
              size="large"
              onClick={() => openAuth('register')}
              icon={<ArrowRight className="w-4 h-4" />}
              className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold shadow-xl shadow-blue-600/30 flex items-center gap-2 text-base"
            >
              {t('landing.createAccountBtn')}
            </Button>
            <Button
              size="large"
              onClick={() => openAuth('login')}
              className="h-12 px-6 rounded-xl border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 bg-white dark:bg-slate-900 text-base"
            >
              {t('landing.demoBtn')}
            </Button>
          </div>

          {/* Live Preview Ticker Board */}
          <div className="pt-8 sm:pt-12 max-w-4xl mx-auto">
            <div className="p-4 sm:p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {t('landing.liveBoardTitle')}
                  </span>
                </div>
                <Tag color="blue" className="text-[11px] font-semibold">{t('landing.autoScan')}</Tag>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {sampleStocks.map((stock) => (
                  <div
                    key={stock.ticker}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-slate-900 dark:text-white mono-font">{stock.ticker}</span>
                      <span className={`text-xs font-bold ${stock.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {stock.change}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{stock.name}</p>
                    <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                      <span className="text-lg font-bold text-slate-900 dark:text-white mono-font">{stock.price}</span>
                      <span className="text-[10px] text-slate-400 mono-font">Vol: {stock.vol}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Key Feature Pillars */}
      <section className="py-16 sm:py-24 bg-white/60 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              {t('landing.featureSectionTitle')}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              {t('landing.featureSectionDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feat, idx) => (
              <Card
                key={idx}
                className="bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800/80 hover:border-blue-500/50 dark:hover:border-blue-500/40 transition-all rounded-2xl shadow-sm hover:shadow-xl group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform">
                      {feat.icon}
                    </div>
                    <Tag className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-0">
                      {feat.badge}
                    </Tag>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Call to Action Banner */}
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 text-white shadow-2xl text-center space-y-6 relative overflow-hidden">
            <h2 className="text-2xl sm:text-4xl font-black">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-sm sm:text-base text-blue-100 max-w-xl mx-auto">
              {t('landing.ctaDesc')}
            </p>
            <div className="pt-2">
              <Button
                size="large"
                onClick={() => openAuth('register')}
                className="h-12 px-8 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-extrabold shadow-lg border-0 text-base"
              >
                {t('landing.ctaRegisterBtn')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>TradeWatch Pro • {t('landing.footerTagline')}</span>
          </div>
          <div>
            © {new Date().getFullYear()} TradeWatch. {t('landing.footerTimezone')}.
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        visible={authModalVisible}
        defaultTab={authTab}
        onClose={() => setAuthModalVisible(false)}
      />
    </div>
  );
};
