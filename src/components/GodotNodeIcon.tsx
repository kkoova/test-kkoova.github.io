import React from 'react';
import { NodeOption } from '../data/questions';

interface GodotNodeIconProps {
  nodeType: NodeOption['nodeType'];
  className?: string;
}

export const GodotNodeIcon: React.FC<GodotNodeIconProps> = ({ nodeType, className = 'w-10 h-10' }) => {
  const strokeColor = '#8DA5F3';

  switch (nodeType) {
    case 'Area2D':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="24"
            height="24"
            rx="4"
            stroke={strokeColor}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <circle cx="16" cy="16" r="5" fill={strokeColor} fillOpacity="0.25" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );
    case 'CharacterBody2D':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <circle cx="16" cy="9" r="4" stroke={strokeColor} strokeWidth="2.2" />
          <path
            d="M9 26v-4a7 7 0 0 1 14 0v4"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d="M7 17h18" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'Sprite2D':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="6" width="24" height="20" rx="3" stroke={strokeColor} strokeWidth="2" />
          <circle cx="11" cy="12" r="2.2" fill={strokeColor} />
          <path
            d="M5 23l6.5-6 4.5 4 4.5-5.5L27 23"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'CollisionShape2D':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <polygon
            points="16,4 27,11 23,26 9,26 5,11"
            fill={strokeColor}
            fillOpacity="0.2"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="4" r="2" fill={strokeColor} />
          <circle cx="27" cy="11" r="2" fill={strokeColor} />
          <circle cx="23" cy="26" r="2" fill={strokeColor} />
          <circle cx="9" cy="26" r="2" fill={strokeColor} />
          <circle cx="5" cy="11" r="2" fill={strokeColor} />
        </svg>
      );
    case 'RigidBody2D':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <rect
            x="6"
            y="8"
            width="16"
            height="16"
            rx="2"
            transform="rotate(-10 14 16)"
            fill={strokeColor}
            fillOpacity="0.2"
            stroke={strokeColor}
            strokeWidth="2"
          />
          <path d="M23 6v10m0 0l-3-3m3 3l3-3" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'Node2D':
    default:
      return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
          <circle cx="16" cy="16" r="9" stroke={strokeColor} strokeWidth="2.4" />
          <circle cx="16" cy="16" r="2.5" fill={strokeColor} />
        </svg>
      );
  }
};
