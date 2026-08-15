import { useState } from 'react';
import { TrendingUp, Sun, Moon, Bug, Mail, Copy, Check, X } from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <header className="h-16 bg-slate-900/90 dark:bg-slate-900/90 light:bg-white border-b border-slate-800 dark:border-slate-800 light:border-slate-200 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline space-x-2">
            <h1 className="text-xl font-bold font-outfit text-white tracking-wide">
              R's Indicator Tracker
            </h1>
            <span className="text-xs text-slate-400 font-medium font-mono">v1.0</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* 라이트 / 다크 모드 토글 버튼 */}
          <button
            onClick={onToggleTheme}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 cursor-pointer shadow-sm"
            title="라이트/다크 테마 모드 전환"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>☀️ 라이트 모드</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>🌙 다크 모드</span>
              </>
            )}
          </button>

          {/* 버그 제보 팝업창 모달 버튼 */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer shadow-sm"
            title="버그 제보 및 문의 팝업창 띄우기"
          >
            <Bug className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">버그 제보</span>
          </button>
        </div>
      </header>

      {/* 우측 상단 버그 제보 팝업창 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-slate-900 light:bg-white border border-slate-700 light:border-slate-300 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative text-slate-100 light:text-slate-800">
            {/* 닫기 (X) 버튼 */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 light:hover:bg-slate-100 text-slate-400 hover:text-white light:hover:text-slate-900 transition cursor-pointer"
              title="팝업 닫기"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 헤더 아이콘 & 타이틀 */}
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Bug className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white light:text-slate-900 font-outfit">
                  버그 제보 및 의견 보내기
                </h3>
                <p className="text-xs text-slate-400 light:text-slate-500 mt-0.5">
                  Indicator Tracker 서비스 개선에 참여해 주세요.
                </p>
              </div>
            </div>

            {/* 메인 내용 박스 */}
            <div className="p-4 bg-slate-950/80 light:bg-slate-50 rounded-2xl border border-slate-800 light:border-slate-200 space-y-3.5">
              <p className="text-xs text-slate-300 light:text-slate-700 leading-relaxed">
                서비스 이용 중 발견하신 <span className="text-rose-400 font-bold">오류/버그</span>, 데이터 시각화 개선 의견, 또는 새롭게 추가되길 원하는 지표가 있으시다면 편하게 제보해 주세요!
              </p>

              {/* 이메일 주소 및 복사 버튼 카드 */}
              <div className="flex items-center justify-between p-3 bg-slate-900 light:bg-white rounded-xl border border-slate-700/80 light:border-slate-300 font-mono text-xs shadow-inner">
                <span className="text-amber-400 light:text-amber-600 font-bold flex items-center gap-2 truncate">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  choisw1997@gmail.com
                </span>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText('choisw1997@gmail.com');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                  title="이메일 주소 복사"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-slate-950" />
                      <span>복사됨!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div className="flex items-center justify-end pt-1">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-extrabold shadow-md hover:opacity-95 transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
