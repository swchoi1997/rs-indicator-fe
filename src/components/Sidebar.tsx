import { useEffect, useState } from 'react';
import { Home, Activity, Briefcase, Globe, Layers, ChevronDown, ChevronRight, Bug, Mail, Copy, Check, X, Sun, Moon } from 'lucide-react';
import { getMenuTree } from '../api/menu';
import type { MenuCategory } from '../api/menu';

interface SidebarProps {
  activeCategory: string;
  activeItemCode: string;
  onSelectMenuItem: (categoryCode: string, itemCode: string, targetSymbol?: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const ICON_MAP: Record<string, any> = {
  MARKET: Activity,
  INVESTOR: Briefcase,
  MACRO: Globe,
  STOCK: Layers,
};

export function Sidebar({ activeCategory, activeItemCode, onSelectMenuItem, isMobileOpen, onCloseMobile, theme, onToggleTheme }: SidebarProps) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    INVESTOR: true,
    MARKET: true,
    MACRO: true,
    STOCK: true,
  });

  useEffect(() => {
    getMenuTree()
      .then((data) => setCategories(data))
      .catch((err) => console.error('Failed to load menu tree:', err));
  }, []);

  const toggleCategory = (catCode: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catCode]: !prev[catCode],
    }));
  };

  const handleItemClick = (categoryCode: string, itemCode: string, targetSymbol?: string) => {
    onSelectMenuItem(categoryCode, itemCode, targetSymbol);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const defaultMenuStructure = [
    {
      category_code: 'INVESTOR',
      category_name: '수급 분석',
      icon: 'users',
      items: [
        { id: 1, item_code: 'FOREIGNER_2Y_CUM', item_name: '외국인 2년 누적 (주봉)', target_symbol: 'FOREIGNER' },
        { id: 2, item_code: 'MAIN_3SUB_CUM', item_name: '외국인, 개인, 기관, 연기금 누적 (주봉)', target_symbol: 'FOREIGNER,INDIVIDUAL,INSTITUTION,PENSION' },
        { id: 3, item_code: 'INVESTOR_NET', item_name: '주체별 순매수', target_symbol: 'ALL' },
      ],
    },
    {
      category_code: 'MACRO',
      category_name: '거시 경제',
      icon: 'globe',
      items: [
        { id: 7, item_code: 'USDKRW', item_name: '원/달러 환율', target_symbol: 'USDKRW' },
        { id: 8, item_code: 'US10Y', item_name: '미국채 10년물 금리', target_symbol: 'US10Y' },
        { id: 9, item_code: 'KR_BOND_3Y', item_name: '한국 국고채 3년물 금리', target_symbol: 'KR_BOND_3Y' },
        { id: 10, item_code: 'WTI', item_name: 'WTI 유가 선물', target_symbol: 'WTI' },
      ],
    },
    {
      category_code: 'MARKET',
      category_name: '시장 지수',
      icon: 'chart-line',
      items: [
        { id: 3, item_code: 'KOSPI', item_name: '코스피 (KOSPI)', target_symbol: 'KOSPI' },
        { id: 4, item_code: 'KOSDAQ', item_name: '코스닥 (KOSDAQ)', target_symbol: 'KOSDAQ' },
        { id: 5, item_code: 'NASDAQ', item_name: '나스닥 (NASDAQ)', target_symbol: '^IXIC' },
        { id: 6, item_code: 'S&P500', item_name: 'S&P500', target_symbol: '^GSPC' },
      ],
    },
    {
      category_code: 'STOCK',
      category_name: '관심 종목',
      icon: 'star',
      items: [
        { id: 11, item_code: '005930', item_name: '삼성전자 (005930)', target_symbol: '005930' },
        { id: 12, item_code: '000660', item_name: 'SK하이닉스 (000660)', target_symbol: '000660' },
        { id: 13, item_code: '035420', item_name: 'NAVER (035420)', target_symbol: '035420' },
      ],
    },
  ];

  const menuList = categories.length > 0 ? categories : (defaultMenuStructure as any[]);

  const renderContent = () => (
    <>
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          지표 메뉴 탐색
        </h2>
        {/* 모바일 닫기 버튼 */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {/* HOME 메뉴 */}
        <button
          onClick={() => handleItemClick('HOME', 'HOME')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
            activeCategory === 'HOME'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-3">
            <Home className="w-4 h-4 text-amber-400" />
            <span>HOME</span>
          </div>
        </button>

        {/* 대카테고리 & 소카테고리 리스트 */}
        {menuList.map((cat) => {
          const IconComp = ICON_MAP[cat.category_code] || Activity;
          const isCategoryActive = activeCategory === cat.category_code;
          const isOpen = openCategories[cat.category_code] ?? true;

          return (
            <div key={cat.category_code} className="space-y-1">
              {/* 대카테고리 토글 버튼 */}
              <button
                onClick={() => toggleCategory(cat.category_code)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isCategoryActive
                    ? 'bg-slate-800/80 light:bg-slate-200/90 text-amber-400 light:text-amber-700 font-semibold'
                    : 'text-slate-300 light:text-slate-700 hover:bg-slate-800/40 light:hover:bg-slate-200/60 hover:text-white light:hover:text-slate-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <IconComp className="w-4 h-4 text-amber-400" />
                  <span>{cat.category_name}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-400 light:text-slate-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500 light:text-slate-500" />
                )}
              </button>

              {/* 소카테고리 세부 항목 목록 */}
              {isOpen && cat.items && cat.items.length > 0 && (
                <div className="pl-6 pr-2 py-1 space-y-1 border-l-2 border-slate-800 light:border-slate-300 ml-4">
                  {cat.items.map((item: any) => {
                    const isItemActive = activeItemCode === item.item_code;
                    return (
                      <div
                        key={item.id || item.item_code}
                        onClick={() =>
                          handleItemClick(cat.category_code, item.item_code, item.target_symbol)
                        }
                        className={`text-xs px-3 py-2 rounded-lg cursor-pointer transition font-medium flex items-center justify-between ${
                          isItemActive
                            ? 'bg-amber-500/20 light:bg-amber-500/20 text-amber-300 light:text-amber-800 font-bold border border-amber-500/40 light:border-amber-500/50 shadow-sm'
                            : 'text-slate-400 light:text-slate-600 hover:text-slate-100 light:hover:text-slate-900 hover:bg-slate-800/50 light:hover:bg-slate-200/50'
                        }`}
                      >
                        <span className="truncate">{item.item_name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 라이트 / 다크 테마 전환 토글 버튼 */}
      <div className="px-3 pt-2">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-bold transition bg-slate-800/90 light:bg-slate-200/90 hover:bg-slate-700 light:hover:bg-slate-300 text-slate-200 light:text-slate-800 border border-slate-700 light:border-slate-300 shadow-sm cursor-pointer"
          title="라이트/다크 테마 모드 전환"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>☀️ 라이트 모드로 전환</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-400" />
              <span>🌙 다크 모드로 전환</span>
            </>
          )}
        </button>
      </div>

      {/* 버그 제보 안내 카드 */}
      <div className="p-3.5 m-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
            <Bug className="w-3.5 h-3.5 text-rose-400" /> 버그 제보 & 문의
          </span>
          <span className="text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
            HELP
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          기능 이상 또는 버그 발견 시 아래 이메일로 제보해 주세요.
        </p>
        <div className="flex items-center justify-between pt-1 font-mono text-[11px]">
          <a
            href="mailto:choisw1997@gmail.com"
            className="text-amber-300 hover:text-amber-200 underline underline-offset-2 truncate font-semibold flex items-center gap-1"
            title="이메일 보내기 (choisw1997@gmail.com)"
          >
            <Mail className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">choisw1997@gmail.com</span>
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText('choisw1997@gmail.com');
              setCopiedEmail(true);
              setTimeout(() => setCopiedEmail(false), 2000);
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition flex items-center gap-1 shrink-0 cursor-pointer ml-1"
            title="이메일 주소 복사"
          >
            {copiedEmail ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-bold">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. PC 데스크탑 고정 사이드바 (화면 >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-slate-900/60 border-r border-slate-800 flex-col shrink-0 min-h-[calc(100vh-4rem)]">
        {renderContent()}
      </aside>

      {/* 2. 모바일 슬라이드 드로어 사이드바 (화면 < 1024px) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* 어두운 배경 오버레이 (클릭 시 닫힘) */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          />

          {/* 슬라이드 드로어 본체 */}
          <div className="relative w-72 max-w-[82vw] bg-slate-900 border-r border-slate-800 h-full flex flex-col z-10 shadow-2xl animate-fadeIn">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
}

