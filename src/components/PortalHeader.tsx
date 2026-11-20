import React from 'react';
import { LogIn, LogOut, Monitor, Users } from 'lucide-react';

export type PortalSection = 'course' | 'test';

interface PortalHeaderProps {
  activeSection: PortalSection;
  onNavigate: (section: PortalSection) => void;
  isSignedIn: boolean;
  isAdmin: boolean;
  userLabel: string;
  authLoading: boolean;
  onOpenProfile: () => void;
  onOpenFeedback: () => void;
  onOpenAdmin: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  activeSection,
  onNavigate,
  isSignedIn,
  isAdmin,
  userLabel,
  authLoading,
  onOpenProfile,
  onOpenFeedback,
  onOpenAdmin,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="w-full border-b border-[#222D38] bg-[#131A22]">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand */}
        <button
          type="button"
          onClick={() => onNavigate('course')}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-md bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono font-bold text-sm text-[#CBEF9C]">
            G
          </div>
          <span className="text-base font-bold tracking-tight text-[#F1F6FA]">
            Mobile Godot
          </span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9FB0C0]">
          <button
            type="button"
            onClick={() => onNavigate('course')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'course'
                ? 'border-[#9ED164] text-[#F1F6FA]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Карта миссий
          </button>
          <button
            type="button"
            onClick={() => onNavigate('test')}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'test'
                ? 'border-[#9ED164] text-[#F1F6FA]'
                : 'border-transparent hover:text-white'
            }`}
          >
            Тестирование
          </button>
          {isSignedIn && (
            <>
              <button
                type="button"
                onClick={onOpenProfile}
                className="py-1 border-b-2 border-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Профиль
              </button>
              <button
                type="button"
                onClick={onOpenFeedback}
                className="py-1 border-b-2 border-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Идея урока
              </button>
            </>
          )}
          {isAdmin && (
            <a
              href="?view=monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-1 border-b-2 border-transparent hover:text-[#9ED164] transition-colors whitespace-nowrap shrink-0"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>2-й экран</span>
            </a>
          )}
        </nav>

        {/* Zone 3: Primary Account / Admin Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Панель преподавателя</span>
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title="Выйти"
                className="p-2 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white hover:border-[#495F73] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : isSignedIn ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenProfile}
                className="px-3 py-1.5 rounded-md border border-[#2A3744] bg-[#161F28] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors whitespace-nowrap shrink-0 cursor-pointer max-w-[160px] truncate"
              >
                {userLabel}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title="Выйти"
                className="p-2 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white hover:border-[#495F73] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authLoading ? 'Вход...' : 'Войти через GitHub'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden items-center gap-4 px-6 pb-3 overflow-x-auto text-xs font-medium text-[#9FB0C0]">
        <button
          type="button"
          onClick={() => onNavigate('course')}
          className={`whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'course' ? 'text-[#9ED164] font-semibold' : ''
          }`}
        >
          Карта миссий
        </button>
        <button
          type="button"
          onClick={() => onNavigate('test')}
          className={`whitespace-nowrap shrink-0 cursor-pointer ${
            activeSection === 'test' ? 'text-[#9ED164] font-semibold' : ''
          }`}
        >
          Тестирование
        </button>
        {isSignedIn && (
          <>
            <button
              type="button"
              onClick={onOpenProfile}
              className="whitespace-nowrap shrink-0 cursor-pointer"
            >
              Профиль
            </button>
            <button
              type="button"
              onClick={onOpenFeedback}
              className="whitespace-nowrap shrink-0 cursor-pointer"
            >
              Идея урока
            </button>
          </>
        )}
      </div>
    </header>
  );
};
