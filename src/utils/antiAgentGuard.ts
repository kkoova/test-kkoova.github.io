import type React from 'react';

export interface AutomationCheckResult {
  suspicious: boolean;
  reasons: string[];
}

export function detectAutomationEnvironment(): AutomationCheckResult {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { suspicious: false, reasons: [] };
  }

  const reasons: string[] = [];
  const nav = navigator as Navigator & { webdriver?: boolean };
  if (nav.webdriver) {
    reasons.push('navigator.webdriver');
  }

  const win = window as unknown as Record<string, unknown>;
  const suspiciousGlobals = [
    '__playwright',
    '__pw_manual',
    '__PW_inspect',
    '_playwright',
    'domAutomation',
    'domAutomationController',
    '__nightmare',
    'callPhantom',
    '_phantom',
    '__selenium_unwrapped',
    '__webdriver_evaluate',
    '__driver_evaluate',
    '__fxdriver_evaluate',
  ];

  for (const key of suspiciousGlobals) {
    if (key in win && win[key] !== undefined) {
      reasons.push(`global:${key}`);
    }
  }

  try {
    const winKeys = Object.keys(win);
    if (winKeys.some((k) => k.startsWith('cdc_') || k.startsWith('$cdc_'))) {
      reasons.push('chromedriver_cdc');
    }
    const docKeys = Object.keys(document as unknown as Record<string, unknown>);
    if (docKeys.some((k) => k.startsWith('cdc_') || k.startsWith('$cdc_'))) {
      reasons.push('doc_cdc');
    }
  } catch {
    // ignore
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length === 0) {
    reasons.push('headless_languages');
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

export function isTrustedUserEvent(
  e: React.SyntheticEvent | Event | undefined | null
): boolean {
  if (!e) return false;
  if ('nativeEvent' in e && e.nativeEvent) {
    return e.nativeEvent.isTrusted === true;
  }
  return (e as Event).isTrusted === true;
}

export function isDevToolsHeuristicTriggered(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!document.fullscreenElement) return false;
  const widthDiff = window.outerWidth - window.innerWidth;
  const heightDiff = window.outerHeight - window.innerHeight;
  return widthDiff > 160 || heightDiff > 160;
}

export function shuffleWithSeed<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let seed = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const nextRand = () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
