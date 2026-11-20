import React, { useState } from 'react';
import { Send, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { submitFeedback } from '../services/courseService';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  fallbackName: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  onClose,
  user,
  fallbackName,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await submitFeedback({ user, fallbackName, feedback: text });
    setSending(false);
    if (!res.ok) {
      setError(res.error || 'Не удалось отправить предложение.');
      return;
    }
    setSent(true);
    setText('');
    window.setTimeout(() => {
      setSent(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#344656] bg-[#161E27] p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#24303C] pb-3">
          <h2 className="text-base font-bold text-white">Предложить идею для урока</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sent ? (
          <div className="p-4 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C] text-center">
            Спасибо! Ваше предложение отправлено преподавателю.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
                Ваша идея или отзыв
              </label>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Например: разбор анимации частиц, работа со звуком или мобильный джойстик..."
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
              />
            </div>

            {error && (
              <div className="text-xs text-[#E06C75] bg-[#2D181B] border border-[#E06C75]/40 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 px-4 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Отправка...' : 'Отправить'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
