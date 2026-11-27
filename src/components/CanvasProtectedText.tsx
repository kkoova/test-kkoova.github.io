import React, { useEffect, useRef, useState } from 'react';

interface CanvasProtectedTextProps {
  text: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: 'normal' | '600' | '700';
  monospace?: boolean;
  color?: string;
  className?: string;
  singleLine?: boolean;
}

export const CanvasProtectedText: React.FC<CanvasProtectedTextProps> = ({
  text,
  fontSize = 14,
  lineHeight = 22,
  fontWeight = 'normal',
  monospace = false,
  color = '#E6EDF3',
  className = '',
  singleLine = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState<number>(600);
  const [height, setHeight] = useState<number>(lineHeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = Math.max(120, Math.floor(el.clientWidth));
      setWidth(w);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const family = monospace
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      : 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const fontStr = `${fontWeight} ${fontSize}px ${family}`;
    ctx.font = fontStr;

    const wrappedLines: string[] = [];
    if (singleLine) {
      wrappedLines.push(text || ' ');
    } else {
      const paragraphs = (text || '').split('\n');
      for (const para of paragraphs) {
        if (para === '') {
          wrappedLines.push('');
          continue;
        }
        const words = para.split(/(\s+)/);
        let current = '';
        for (const token of words) {
          const testLine = current + token;
          if (ctx.measureText(testLine).width > width - 4 && current.trim().length > 0) {
            wrappedLines.push(current.trimEnd());
            current = token.trimStart();
          } else {
            current = testLine;
          }
        }
        if (current.length > 0) {
          wrappedLines.push(current);
        }
      }
      if (wrappedLines.length === 0) wrappedLines.push(' ');
    }

    const totalH = Math.max(lineHeight, wrappedLines.length * lineHeight + 2);
    setHeight(totalH);

    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(totalH * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, totalH);
    ctx.font = fontStr;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    wrappedLines.forEach((line, idx) => {
      const y = idx * lineHeight + lineHeight / 2;
      ctx.fillText(line, 0, y);
    });
  }, [text, width, fontSize, lineHeight, fontWeight, monospace, color, singleLine]);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`w-full select-none pointer-events-none ${className}`}
      style={{ height: `${height}px` }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};
