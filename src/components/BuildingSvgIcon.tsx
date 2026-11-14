import React from 'react';
import { BuildingType } from '../types';

export const BuildingSvgIcon: React.FC<{ type: BuildingType | 'DARK_TITAN'; className?: string }> = ({ type, className = "w-6 h-6" }) => {
  switch (type) {
    case 'CITY':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 21h18M5 21V7l8-4v18M13 21V9l6-2v14M9 11h2M9 15h2" />
        </svg>
      );
    case 'BARRACKS':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 20h20M4 20V10l6-4v14M10 20v-6h4v6M14 14l6-3v9M7 8h2M7 11h2M16 9h2" />
        </svg>
      );
    case 'PORT':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="5" r="3" />
          <path d="M12 8v13M5 12h2a5 5 0 0 0 10 0h2" />
        </svg>
      );
    case 'MISSILE_SILO':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2s4 4 4 10v7H8v-7c0-6 4-10 4-10zM12 12v6M9 19h6M8 7h8" />
        </svg>
      );
    case 'AIR_DEFENSE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 20h20M7 20v-5l5-7 5 7v5M12 15V8M9 5h6" />
        </svg>
      );
    case 'FORTRESS':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'OIL_RIG':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 3L7 21M12 3l5 18M9 13h6M8 17h8M12 3v-1" />
          <path d="M3 21h18" />
        </svg>
      );
    case 'MINE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 3l7 6-7 12L5 9l7-6z" fill="#38bdf8" fillOpacity="0.2" />
          <path d="M5 9h14M12 3v18" />
        </svg>
      );
    case 'LASER':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2v6M12 8L8 12h8l-4-4z" stroke="#ec4899" fill="#f472b6" fillOpacity="0.25" />
          <circle cx="12" cy="14" r="3.5" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
          <path d="M4 20h16M7 20l2-4h6l2 4" stroke="#f472b6" strokeWidth="2.5" />
          <path d="M4 4l3 3M20 4l-3 3" stroke="#f472b6" strokeWidth="2.2" />
        </svg>
      );
    case 'SUPREME_FORTRESS':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2l8 3v6c0 5.5-3.4 9.7-8 11-4.6-1.3-8-5.5-8-11V5l8-3z" />
          <path d="M9 11l3-3 3 3M12 8v8" />
        </svg>
      );
    case 'GRAND_ACADEMY':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 10l9-5 9 5-9 5-9-5z" />
          <path d="M6 12v6h12v-6M12 15v5M20 11v5" />
        </svg>
      );
    case 'GRAND_ARSENAL':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M4 20h16v-8l-4 2V9l-4 3V7L4 12v8z" />
          <path d="M16 4v4M19 4v6" />
        </svg>
      );
    case 'BUNKER':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 19h18M5 19l2-7h10l2 7M8 12l1-4h6l1 4M8 15h8" />
        </svg>
      );
    case 'DARK_TITAN':
      return (
        <svg viewBox="0 0 24 24" fill="#090d16" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Cấu hình SVG Tà Thần Cổ Đại: Đỏ Đen, Nét Dày, Lớn, Rõ Nét Khi Thu Nhỏ */}
          <path d="M3 3l4 6M21 3l-4 6" stroke="#ef4444" strokeWidth="3.2" />
          <path d="M12 2L5 8v6l7 8 7-8V8L12 2z" fill="#000000" stroke="#dc2626" strokeWidth="2.8" />
          <path d="M8 11h2.5M13.5 11H16" stroke="#ef4444" strokeWidth="3" />
          <circle cx="9.25" cy="11" r="1" fill="#ef4444" />
          <circle cx="14.75" cy="11" r="1" fill="#ef4444" />
          <path d="M9 16l3 2 3-2" stroke="#dc2626" strokeWidth="2.5" />
          <path d="M12 5v3" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
};

