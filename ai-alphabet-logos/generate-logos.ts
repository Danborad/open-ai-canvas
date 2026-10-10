import fs from 'fs';
import path from 'path';

export interface LetterDef {
  letter: string;
  name: string;
  desc: string;
  colorGrad: {
    stops: Array<{ offset: string; color: string }>;
    x1: number; y1: number; x2: number; y2: number;
  };
  colorSvg: (id: string) => string;
  monoSvg: () => string;
}

export const letters: LetterDef[] = [
  // A: Solid Bold Delta + Crossbar with Center Dot
  {
    letter: 'A',
    name: '量子三角标',
    desc: '端正加粗无衬线三角架构，水平实心横梁内嵌居中微核心光点，刚劲稳固。',
    colorGrad: {
      x1: 20, y1: 104, x2: 108, y2: 24,
      stops: [
        { offset: '0%', color: '#00F2FE' },
        { offset: '100%', color: '#2563EB' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="20" y1="104" x2="108" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00F2FE"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C60.8 20 57.8 22 56.4 25.2L24.4 97.2C23.2 99.8 25.1 104 28 104H44C46.5 104 48.8 102.5 49.8 100.2L55.5 86H72.5L78.2 100.2C79.2 102.5 81.5 104 84 104H100C102.9 104 104.8 99.8 103.6 97.2L71.6 25.2C70.2 22 67.2 20 64 20ZM64 42L70 68H58L64 42Z" fill="url(#${id}-grad)"/>
      <rect x="52" y="69" width="24" height="10" rx="5" fill="#38BDF8"/>
      <circle cx="64" cy="74" r="2.8" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C60.8 20 57.8 22 56.4 25.2L24.4 97.2C23.2 99.8 25.1 104 28 104H44C46.5 104 48.8 102.5 49.8 100.2L55.5 86H72.5L78.2 100.2C79.2 102.5 81.5 104 84 104H100C102.9 104 104.8 99.8 103.6 97.2L71.6 25.2C70.2 22 67.2 20 64 20ZM64 42L70 68H58L64 42Z" fill="currentColor"/>
      <circle cx="64" cy="74" r="2.8" fill="#0C0E14"/>
    `
  },

  // B: Solid Bold Monolith B (No dots, pure solid rugged)
  {
    letter: 'B',
    name: '双核实心矩阵',
    desc: '端正加粗无衬线实心双环体，左侧垂直基石立柱，结构饱满稳健。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#1D4ED8' },
        { offset: '100%', color: '#38BDF8' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1D4ED8"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C83.5 20 93 28.5 93 39C93 46.5 88.5 53 82 56.5C90.5 60 96 68 96 77.5C96 89.5 85.5 99 73 99H28C25.8 99 24 97.2 24 95V24C24 21.8 25.8 20 28 20ZM44 36V52H69C73.4 52 77 48.4 77 44C77 39.6 73.4 36 69 36H44ZM44 66V83H71C75.9 83 80 78.9 80 74C80 69.1 75.9 66 71 66H44Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C83.5 20 93 28.5 93 39C93 46.5 88.5 53 82 56.5C90.5 60 96 68 96 77.5C96 89.5 85.5 99 73 99H28C25.8 99 24 97.2 24 95V24C24 21.8 25.8 20 28 20ZM44 36V52H69C73.4 52 77 48.4 77 44C77 39.6 73.4 36 69 36H44ZM44 66V83H71C75.9 83 80 78.9 80 74C80 69.1 75.9 66 71 66H44Z" fill="currentColor"/>
    `
  },

  // C: Solid Bold Geometric C (No inner floating bar, no dot)
  {
    letter: 'C',
    name: '粒子加速磁环',
    desc: '大厂经典几何等宽厚截面开环，上下平切末端对称收口，干净硬朗。',
    colorGrad: {
      x1: 96, y1: 24, x2: 24, y2: 104,
      stops: [
        { offset: '0%', color: '#10B981' },
        { offset: '100%', color: '#059669' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="96" y1="24" x2="24" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <path d="M96 38L82 48.5C78 41.5 71.5 37.5 64 37.5C49.5 37.5 37.5 49.5 37.5 64C37.5 78.5 49.5 90.5 64 90.5C71.5 90.5 78 86.5 82 79.5L96 90C88.5 101.5 77 108 64 108C39.7 108 20 88.3 20 64C20 39.7 39.7 20 64 20C77 20 88.5 26.5 96 38Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M96 38L82 48.5C78 41.5 71.5 37.5 64 37.5C49.5 37.5 37.5 49.5 37.5 64C37.5 78.5 49.5 90.5 64 90.5C71.5 90.5 78 86.5 82 79.5L96 90C88.5 101.5 77 108 64 108C39.7 108 20 88.3 20 64C20 39.7 39.7 20 64 20C77 20 88.5 26.5 96 38Z" fill="currentColor"/>
    `
  },

  // D: Solid Bold Monolith D (No dots, pure solid)
  {
    letter: 'D',
    name: '空间半球体',
    desc: '端正垂直立柱与流畅外凸几何半圆，实心厚实体量展现稳固结构。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#0284C7' },
        { offset: '100%', color: '#2563EB' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0284C7"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H62C83.5 20 101 37.5 101 64C101 90.5 83.5 108 62 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 37V91H61C74.8 91 84 80.2 84 64C84 47.8 74.8 37 61 37H44Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H62C83.5 20 101 37.5 101 64C101 90.5 83.5 108 62 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 37V91H61C74.8 91 84 80.2 84 64C84 47.8 74.8 37 61 37H44Z" fill="currentColor"/>
    `
  },

  // E: Solid Bold E with Center Crossbar Node
  {
    letter: 'E',
    name: '阶梯能量频段',
    desc: '端正加粗垂直主干配合三道等宽平行横梁，中心横梁内嵌居中微核心光点。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#EA580C' },
        { offset: '100%', color: '#F59E0B' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EA580C"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H96C98.2 20 100 21.8 100 24V34C100 36.2 98.2 38 96 38H45V55H88C90.2 55 92 56.8 92 59V69C92 71.2 90.2 73 88 73H45V90H96C98.2 90 100 91.8 100 94V104C100 106.2 98.2 108 96 108H30C27.8 108 26 106.2 26 104V24Z" fill="url(#${id}-grad)"/>
      <circle cx="68" cy="64" r="3" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H96C98.2 20 100 21.8 100 24V34C100 36.2 98.2 38 96 38H45V55H88C90.2 55 92 56.8 92 59V69C92 71.2 90.2 73 88 73H45V90H96C98.2 90 100 91.8 100 94V104C100 106.2 98.2 108 96 108H30C27.8 108 26 106.2 26 104V24Z" fill="currentColor"/>
      <circle cx="68" cy="64" r="3" fill="#0C0E14"/>
    `
  },

  // F: Solid Bold F with Center Crossbar Node
  {
    letter: 'F',
    name: '悬浮能量翼',
    desc: '加粗无衬线主立柱支撑双悬臂横梁，中横臂平直内嵌居中微核心光点。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#0891B2' },
        { offset: '100%', color: '#06B6D4' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0891B2"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H96C98.2 20 100 21.8 100 24V34C100 36.2 98.2 38 96 38H45V55H86C88.2 55 90 56.8 90 59V69C90 71.2 88.2 73 86 73H45V104C45 106.2 43.2 108 41 108H30C27.8 108 26 106.2 26 104V24Z" fill="url(#${id}-grad)"/>
      <circle cx="65" cy="64" r="3" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H96C98.2 20 100 21.8 100 24V34C100 36.2 98.2 38 96 38H45V55H86C88.2 55 90 56.8 90 59V69C90 71.2 88.2 73 86 73H45V104C45 106.2 43.2 108 41 108H30C27.8 108 26 106.2 26 104V24Z" fill="currentColor"/>
      <circle cx="65" cy="64" r="3" fill="#0C0E14"/>
    `
  },

  // G: User Favorite (Exactly preserved)
  {
    letter: 'G',
    name: '神经流光',
    desc: '厚实硬朗外圆环配合向心悬浮平直横梁，微核心光点，极具工业质感。',
    colorGrad: {
      x1: 90, y1: 24, x2: 24, y2: 104,
      stops: [
        { offset: '0%', color: '#00F2FE' },
        { offset: '50%', color: '#38BDF8' },
        { offset: '100%', color: '#2563EB' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-top" x1="90" y1="24" x2="20" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00F2FE"/>
          <stop offset="50%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
        <linearGradient id="${id}-btm" x1="24" y1="76" x2="106" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="60%" stop-color="#4F46E5"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
        <linearGradient id="${id}-bar" x1="56" y1="64" x2="102" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
      <path d="M96 42C90.2 30.5 78.4 22 64 22C40.8 22 22 40.8 22 64C22 75.8 26.9 86.4 34.8 94L46.2 82.6C41.2 77.8 38 71.3 38 64C38 49.6 49.6 38 64 38C73.2 38 81.3 43.1 85.5 50.8L96 42Z" fill="url(#${id}-top)"/>
      <path d="M34.8 94C42.4 101.5 52.7 106 64 106C87.2 106 106 87.2 106 64C106 60.5 105.6 57.1 104.8 53.8L89.4 57.8C89.8 59.8 90 61.9 90 64C90 78.4 78.4 90 64 90C57.2 90 51 87.4 46.2 82.6L34.8 94Z" fill="url(#${id}-btm)"/>
      <path d="M58 56C55.8 56 54 57.8 54 60V68C54 70.2 55.8 72 58 72H96C99.3 72 102 69.3 102 66V62C102 58.7 99.3 56 96 56H58Z" fill="url(#${id}-bar)"/>
      <circle cx="68" cy="64" r="3.2" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <path d="M96 42C90.2 30.5 78.4 22 64 22C40.8 22 22 40.8 22 64C22 75.2 26.4 85.4 33.6 93L44 82.6C39.1 77.8 36 71.3 36 64C36 48.5 48.5 36 64 36C73.1 36 81.1 40.8 85.5 48.2L96 42Z" fill="currentColor"/>
      <path d="M37.5 96.5C44.9 102.5 54.1 106 64 106C87.2 106 106 87.2 106 64C106 60.8 105.6 57.7 105 54.8L91 58.5C91.6 60.3 92 62.1 92 64C92 79.5 79.5 92 64 92C57.6 92 51.7 89.8 47 86.2L37.5 96.5Z" fill="currentColor"/>
      <path d="M58 56C55.8 56 54 57.8 54 60V68C54 70.2 55.8 72 58 72H94C97.3 72 100 69.3 100 66V62C100 58.7 97.3 56 94 56H58Z" fill="currentColor"/>
      <circle cx="68" cy="64" r="3.2" fill="#0C0E14"/>
    `
  },

  // H: User Favorite (Exactly preserved)
  {
    letter: 'H',
    name: '量子光桥',
    desc: '双塔垂直能量立柱与平切悬浮光桥，微核心光点，象征端云互联。',
    colorGrad: {
      x1: 28, y1: 104, x2: 100, y2: 24,
      stops: [
        { offset: '0%', color: '#8B5CF6' },
        { offset: '50%', color: '#D946EF' },
        { offset: '100%', color: '#EC4899' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="28" y1="104" x2="100" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#8B5CF6"/>
          <stop offset="50%" stop-color="#D946EF"/>
          <stop offset="100%" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
      <rect x="28" y="24" width="18" height="80" rx="3" fill="url(#${id}-grad)"/>
      <rect x="82" y="24" width="18" height="80" rx="3" fill="url(#${id}-grad)"/>
      <rect x="46" y="56" width="36" height="16" fill="url(#${id}-grad)"/>
      <circle cx="64" cy="64" r="3.2" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <rect x="28" y="24" width="18" height="80" rx="3" fill="currentColor"/>
      <rect x="82" y="24" width="18" height="80" rx="3" fill="currentColor"/>
      <rect x="46" y="56" width="36" height="16" fill="currentColor"/>
      <circle cx="64" cy="64" r="3.2" fill="#0C0E14"/>
    `
  },

  // I: Solid Monolith Pillar (No dots, pure solid)
  {
    letter: 'I',
    name: '奇点光柱',
    desc: '端正挺拔的无衬线厚实立柱，平切两端，极简端正。',
    colorGrad: {
      x1: 44, y1: 20, x2: 84, y2: 108,
      stops: [
        { offset: '0%', color: '#D97706' },
        { offset: '100%', color: '#F59E0B' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="48" y1="20" x2="80" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
      <rect x="48" y="20" width="32" height="88" rx="4" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <rect x="48" y="20" width="32" height="88" rx="4" fill="currentColor"/>
    `
  },

  // J: Solid Bold J (No floating dot in air! Clean curve)
  {
    letter: 'J',
    name: '重力回旋矢',
    desc: '端正垂直立柱平滑过渡到底部饱满回勾，末端平切，形态纯正无多余悬点。',
    colorGrad: {
      x1: 84, y1: 20, x2: 24, y2: 108,
      stops: [
        { offset: '0%', color: '#E11D48' },
        { offset: '100%', color: '#FB7185' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="84" y1="20" x2="24" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#E11D48"/>
          <stop offset="100%" stop-color="#FB7185"/>
        </linearGradient>
      </defs>
      <path d="M82 22C82 20.9 82.9 20 84 20H98C99.1 20 100 20.9 100 22V76C100 93.5 86.5 108 69 108C51.5 108 38 93.5 38 76H56C56 83.5 61.5 89 69 89C76.5 89 82 83.5 82 76V22Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M82 22C82 20.9 82.9 20 84 20H98C99.1 20 100 20.9 100 22V76C100 93.5 86.5 108 69 108C51.5 108 38 93.5 38 76H56C56 83.5 61.5 89 69 89C76.5 89 82 83.5 82 76V22Z" fill="currentColor"/>
    `
  },

  // K: Solid Bold K (No floating dots, pure clean intersection)
  {
    letter: 'K',
    name: '对角聚合梁',
    desc: '端正垂直主柱与上下平切斜向光刃稳固相交，轮廓清晰有力。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#059669' },
        { offset: '100%', color: '#10B981' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10B981"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V57L77.5 23C79 21.2 81.2 20 84 20H98C101 20 102.5 23.5 100.5 26L68 64L102 102C104 104.5 102.2 108 99 108H83C80.5 108 78 106.8 76.5 104.8L48 70V104C48 106.2 46.2 108 44 108H30C27.8 108 26 106.2 26 104V24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V57L77.5 23C79 21.2 81.2 20 84 20H98C101 20 102.5 23.5 100.5 26L68 64L102 102C104 104.5 102.2 108 99 108H83C80.5 108 78 106.8 76.5 104.8L48 70V104C48 106.2 46.2 108 44 108H30C27.8 108 26 106.2 26 104V24Z" fill="currentColor"/>
    `
  },

  // L: Solid Bold L (No dots, pure solid)
  {
    letter: 'L',
    name: '直角基石',
    desc: '端正垂直立柱与平直底梁平整相接，粗细等厚，稳如磐石。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#C2410C' },
        { offset: '100%', color: '#EA580C' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#C2410C"/>
          <stop offset="100%" stop-color="#EA580C"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V90H96C98.2 90 100 91.8 100 94V104C100 106.2 98.2 108 96 108H30C27.8 108 26 106.2 26 104V24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V90H96C98.2 90 100 91.8 100 94V104C100 106.2 98.2 108 96 108H30C27.8 108 26 106.2 26 104V24Z" fill="currentColor"/>
    `
  },

  // M: Solid Bold M (No dot in the empty space! Continuous power)
  {
    letter: 'M',
    name: '双峰算力网络',
    desc: '端正双立柱支撑中央平直深V梁，无多余悬点，极度严谨对称。',
    colorGrad: {
      x1: 20, y1: 104, x2: 108, y2: 24,
      stops: [
        { offset: '0%', color: '#6D28D9' },
        { offset: '100%', color: '#8B5CF6' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="20" y1="104" x2="108" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6D28D9"/>
          <stop offset="100%" stop-color="#8B5CF6"/>
        </linearGradient>
      </defs>
      <path d="M24 24C24 21.8 25.8 20 28 20H42C44.5 20 46.8 21.5 47.8 23.8L64 64L80.2 23.8C81.2 21.5 83.5 20 86 20H100C102.2 20 104 21.8 104 24V104C104 106.2 102.2 108 100 108H86C83.8 108 82 106.2 82 104V52L69.8 82.2C68.8 84.5 66.5 86 64 86C61.5 86 59.2 84.5 58.2 82.2L46 52V104C46 106.2 44.2 108 42 108H28C25.8 108 24 106.2 24 104V24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M24 24C24 21.8 25.8 20 28 20H42C44.5 20 46.8 21.5 47.8 23.8L64 64L80.2 23.8C81.2 21.5 83.5 20 86 20H100C102.2 20 104 21.8 104 24V104C104 106.2 102.2 108 100 108H86C83.8 108 82 106.2 82 104V52L69.8 82.2C68.8 84.5 66.5 86 64 86C61.5 86 59.2 84.5 58.2 82.2L46 52V104C46 106.2 44.2 108 42 108H28C25.8 108 24 106.2 24 104V24Z" fill="currentColor"/>
    `
  },

  // N: User Favorite (Exactly preserved)
  {
    letter: 'N',
    name: '动能双刃',
    desc: '加粗无衬线双立柱贯穿高速对角立体切面，几何中心内嵌高聚能微核。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#10B981' },
        { offset: '50%', color: '#06B6D4' },
        { offset: '100%', color: '#2563EB' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-left" x1="24" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
        <linearGradient id="${id}-right" x1="60" y1="48" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
      <path d="M28 24C28 21.8 29.8 20 32 20H44C47.2 20 50.1 22.1 51.1 25.1L75 97H57L41.9 48.5L42 104C42 106.2 40.2 108 38 108H32C29.8 108 28 106.2 28 104V24Z" fill="url(#${id}-left)"/>
      <path d="M100 104C100 106.2 98.2 108 96 108H84C80.8 108 77.9 105.9 76.9 102.9L53 31H71L86.1 79.5L86 24C86 21.8 87.8 20 90 20H96C98.2 20 100 21.8 100 24V104Z" fill="url(#${id}-right)"/>
      <circle cx="64" cy="64" r="3.5" fill="#FFFFFF"/>
    `,
    monoSvg: () => `
      <path d="M28 24C28 21.8 29.8 20 32 20H44C47.2 20 50.1 22.1 51.1 25.1L75 97H57L41.9 48.5L42 104C42 106.2 40.2 108 38 108H32C29.8 108 28 106.2 28 104V24Z" fill="currentColor"/>
      <path d="M100 104C100 106.2 98.2 108 96 108H84C80.8 108 77.9 105.9 76.9 102.9L53 31H71L86.1 79.5L86 24C86 21.8 87.8 20 90 20H96C98.2 20 100 21.8 100 24V104Z" fill="currentColor"/>
      <circle cx="64" cy="64" r="4" fill="#0C0E14"/>
    `
  },

  // O: Pure Geometric Circle (No dot inside hole, pure solid)
  {
    letter: 'O',
    name: '同心引力环',
    desc: '端正同心正圆，内外壁绝对均匀等距，线条纯粹硬朗。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#D97706' },
        { offset: '100%', color: '#EA580C' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#EA580C"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C39.7 20 20 39.7 20 64C20 88.3 39.7 108 64 108C88.3 108 108 88.3 108 64C108 39.7 88.3 20 64 20ZM64 38C49.6 38 38 49.6 38 64C38 78.4 49.6 90 64 90C78.4 90 90 78.4 90 64C90 49.6 78.4 38 64 38Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C39.7 20 20 39.7 20 64C20 88.3 39.7 108 64 108C88.3 108 108 88.3 108 64C108 39.7 88.3 20 64 20ZM64 38C49.6 38 38 49.6 38 64C38 78.4 49.6 90 64 90C78.4 90 90 78.4 90 64C90 49.6 78.4 38 64 38Z" fill="currentColor"/>
    `
  },

  // P: Solid Bold P (No dot, pure solid)
  {
    letter: 'P',
    name: '单侧神经元',
    desc: '端正加粗立柱与右上侧饱满半圆环，平切底端，纯正工业无衬线。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#DB2777' },
        { offset: '100%', color: '#BE185D' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#DB2777"/>
          <stop offset="100%" stop-color="#BE185D"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C86.5 20 98 31.5 98 46C98 60.5 86.5 72 72 72H44V104C44 106.2 42.2 108 40 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 37V55H71C76 55 80 51 80 46C80 41 76 37 71 37H44Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C86.5 20 98 31.5 98 46C98 60.5 86.5 72 72 72H44V104C44 106.2 42.2 108 40 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 37V55H71C76 55 80 51 80 46C80 41 76 37 71 37H44Z" fill="currentColor"/>
    `
  },

  // Q: Solid Bold Q (No dot in the hole! Bold geometric tail)
  {
    letter: 'Q',
    name: '引力透镜环',
    desc: '端正同心正圆右下角平切45°实心加速短尾，干净利落无杂散点。',
    colorGrad: {
      x1: 24, y1: 20, x2: 108, y2: 112,
      stops: [
        { offset: '0%', color: '#0369A1' },
        { offset: '100%', color: '#0284C7' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="108" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0369A1"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C40.8 20 22 38.8 22 62C22 85.2 40.8 104 64 104C72.5 104 80.5 101.5 87.2 97.2L96 106C97.5 107.5 100.5 107.5 102 106L106 102C107.5 100.5 107.5 97.5 106 96L97.2 87.2C101.5 80.5 104 72.5 104 64C104 40.8 85.2 22 62 22M40 62C40 48.7 50.7 38 64 38C77.3 38 88 48.7 88 62C88 75.3 77.3 86 64 86C50.7 86 40 75.3 40 62Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M64 20C40.8 20 22 38.8 22 62C22 85.2 40.8 104 64 104C72.5 104 80.5 101.5 87.2 97.2L96 106C97.5 107.5 100.5 107.5 102 106L106 102C107.5 100.5 107.5 97.5 106 96L97.2 87.2C101.5 80.5 104 72.5 104 64C104 40.8 85.2 22 62 22M40 62C40 48.7 50.7 38 64 38C77.3 38 88 48.7 88 62C88 75.3 77.3 86 64 86C50.7 86 40 75.3 40 62Z" fill="currentColor"/>
    `
  },

  // R: Solid Bold R (No dot in empty leg space! Pure solid)
  {
    letter: 'R',
    name: '递归发射梁',
    desc: '端正立柱支撑饱满上半圆与强劲斜撑腿，实心加粗无衬线体。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#DC2626' },
        { offset: '100%', color: '#EF4444' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#DC2626"/>
          <stop offset="100%" stop-color="#EF4444"/>
        </linearGradient>
      </defs>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C85.5 20 96 30.5 96 44C96 55.5 88.5 65 77.5 67.5L98.5 102C100 104.5 98.2 108 95 108H80C78 108 76 106.8 75 105L56 70H44V104C44 106.2 42.2 108 40 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 36V54H70C75 54 79 50 79 45C79 40 75 36 70 36H44Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path fill-rule="evenodd" clip-rule="evenodd" d="M28 20H72C85.5 20 96 30.5 96 44C96 55.5 88.5 65 77.5 67.5L98.5 102C100 104.5 98.2 108 95 108H80C78 108 76 106.8 75 105L56 70H44V104C44 106.2 42.2 108 40 108H28C25.8 108 24 106.2 24 104V24C24 21.8 25.8 20 28 20ZM44 36V54H70C75 54 79 50 79 45C79 40 75 36 70 36H44Z" fill="currentColor"/>
    `
  },

  // S: Solid Bold S (Continuous curve with 45deg precision cut in B&W, NOT sliced into pieces!)
  {
    letter: 'S',
    name: '双曲超导流',
    desc: '端正双向回旋厚流线，一体连贯，两端平齐切角，纯正工科现代无衬线。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#059669' },
        { offset: '100%', color: '#10B981' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#10B981"/>
        </linearGradient>
      </defs>
      <path d="M92 38C92 28 83 20 70 20H48C34.7 20 24 30.7 24 44C24 57.3 34.7 66 48 66H80C86.6 66 92 71.4 92 78C92 84.6 86.6 90 80 90H42C35.4 90 30 84.6 30 78H12C12 94.6 25.4 108 42 108H80C96.6 108 110 94.6 110 78C110 63.5 99.5 54.5 86 52L54 52C47.4 52 42 46.6 42 40C42 33.4 47.4 28 54 28H76C82.6 28 88 33.4 88 40H106C106 33.5 100.8 25 92 20V38Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M92 38C92 28 83 20 70 20H48C34.7 20 24 30.7 24 44C24 57.3 34.7 66 48 66H80C86.6 66 92 71.4 92 78C92 84.6 86.6 90 80 90H42C35.4 90 30 84.6 30 78H12C12 94.6 25.4 108 42 108H80C96.6 108 110 94.6 110 78C110 63.5 99.5 54.5 86 52L54 52C47.4 52 42 46.6 42 40C42 33.4 47.4 28 54 28H76C82.6 28 88 33.4 88 40H106C106 33.5 100.8 25 92 20V38Z" fill="currentColor"/>
    `
  },

  // T: Solid Bold T (Pure solid, no dots)
  {
    letter: 'T',
    name: '悬浮能量天平',
    desc: '水平延展横梁与正中央垂直主柱，极简对称，刚劲沉稳。',
    colorGrad: {
      x1: 20, y1: 20, x2: 108, y2: 108,
      stops: [
        { offset: '0%', color: '#0284C7' },
        { offset: '100%', color: '#38BDF8' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0284C7"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <path d="M24 24C24 21.8 25.8 20 28 20H100C102.2 20 104 21.8 104 24V36C104 38.2 102.2 40 100 40H73V104C73 106.2 71.2 108 69 108H59C56.8 108 55 106.2 55 104V40H28C25.8 40 24 38.2 24 36V24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M24 24C24 21.8 25.8 20 28 20H100C102.2 20 104 21.8 104 24V36C104 38.2 102.2 40 100 40H73V104C73 106.2 71.2 108 69 108H59C56.8 108 55 106.2 55 104V40H28C25.8 40 24 38.2 24 36V24Z" fill="currentColor"/>
    `
  },

  // U: Solid Bold U (NO bar in the middle! NO floating dot! Clean smooth thick U)
  {
    letter: 'U',
    name: '势阱谐振腔',
    desc: '端正双垂直壁平滑过渡到底部半圆弧形，开口开阔，容纳力强，无杂散悬件。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#D97706' },
        { offset: '100%', color: '#B45309' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V68C48 76.8 55.2 84 64 84C72.8 84 80 76.8 80 68V24C80 21.8 81.8 20 84 20H98C100.2 20 102 21.8 102 24V68C102 89 85 106 64 106C43 106 26 89 26 68V24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H44C46.2 20 48 21.8 48 24V68C48 76.8 55.2 84 64 84C72.8 84 80 76.8 80 68V24C80 21.8 81.8 20 84 20H98C100.2 20 102 21.8 102 24V68C102 89 85 106 64 106C43 106 26 89 26 68V24Z" fill="currentColor"/>
    `
  },

  // V: Solid Bold V (No dots, pure solid)
  {
    letter: 'V',
    name: '聚束收敛锥',
    desc: '左右加粗厚边利落向底部尖端聚拢，底部端正稳健，刚劲挺拔。',
    colorGrad: {
      x1: 20, y1: 20, x2: 108, y2: 108,
      stops: [
        { offset: '0%', color: '#4F46E5' },
        { offset: '100%', color: '#6366F1' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4F46E5"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
      </defs>
      <path d="M24 24C24 21.8 25.8 20 28 20H44C46.5 20 48.8 21.5 49.8 23.8L64 74L78.2 23.8C79.2 21.5 81.5 20 84 20H100C102.2 20 104 21.8 104 24C104 25 103.5 26 103 27L72 102C70.5 105.5 67.5 108 64 108C60.5 108 57.5 105.5 56 102L25 27C24.5 26 24 25 24 24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M24 24C24 21.8 25.8 20 28 20H44C46.5 20 48.8 21.5 49.8 23.8L64 74L78.2 23.8C79.2 21.5 81.5 20 84 20H100C102.2 20 104 21.8 104 24C104 25 103.5 26 103 27L72 102C70.5 105.5 67.5 108 64 108C60.5 108 57.5 105.5 56 102L25 27C24.5 26 24 25 24 24Z" fill="currentColor"/>
    `
  },

  // W: Solid Bold Continuous W (NOT sliced or fragmented! Powerful monolith)
  {
    letter: 'W',
    name: '世界模型波',
    desc: '四根斜向实心支干一体连贯咬合，厚实平直，拒绝细碎破碎感。',
    colorGrad: {
      x1: 18, y1: 22, x2: 110, y2: 106,
      stops: [
        { offset: '0%', color: '#EA580C' },
        { offset: '100%', color: '#E11D48' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="18" y1="22" x2="110" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#EA580C"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
      </defs>
      <path d="M20 24C20 21.8 21.8 20 24 20H38C40.5 20 42.8 21.5 43.8 23.8L54 62L64.2 23.8C65.2 21.5 67.5 20 70 20H74C76.5 20 78.8 21.5 79.8 23.8L90 62L100.2 23.8C101.2 21.5 103.5 20 106 20H120C122.2 20 124 21.8 124 24C124 25 123.5 26 123 27L104 102C102.5 105.5 99.5 108 96 108C92.5 108 89.5 105.5 88 102L76 56L64 102C62.5 105.5 59.5 108 56 108C52.5 108 49.5 105.5 48 102L21 27C20.5 26 20 25 20 24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M20 24C20 21.8 21.8 20 24 20H38C40.5 20 42.8 21.5 43.8 23.8L54 62L64.2 23.8C65.2 21.5 67.5 20 70 20H74C76.5 20 78.8 21.5 79.8 23.8L90 62L100.2 23.8C101.2 21.5 103.5 20 106 20H120C122.2 20 124 21.8 124 24C124 25 123.5 26 123 27L104 102C102.5 105.5 99.5 108 96 108C92.5 108 89.5 105.5 88 102L76 56L64 102C62.5 105.5 59.5 108 56 108C52.5 108 49.5 105.5 48 102L21 27C20.5 26 20 25 20 24Z" fill="currentColor"/>
    `
  },

  // X: Solid Bold Intersecting X (No dots, pure solid)
  {
    letter: 'X',
    name: '突触交叉核',
    desc: '两道粗细一致的等宽平切实心对角线交叉贯通，对称有力。',
    colorGrad: {
      x1: 20, y1: 20, x2: 108, y2: 108,
      stops: [
        { offset: '0%', color: '#D97706' },
        { offset: '100%', color: '#EF4444' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#D97706"/>
          <stop offset="100%" stop-color="#EF4444"/>
        </linearGradient>
      </defs>
      <path d="M26 26C27.5 24.5 30 24.5 31.5 26L64 58.5L96.5 26C98 24.5 100.5 24.5 102 26L106 30C107.5 31.5 107.5 34 106 35.5L73.5 68L106 100.5C107.5 102 107.5 104.5 106 106L102 110C100.5 111.5 98 111.5 96.5 110L64 77.5L31.5 110C30 111.5 27.5 111.5 26 110L22 106C20.5 104.5 20.5 102 22 100.5L54.5 68L22 35.5C20.5 34 20.5 31.5 22 30L26 26Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M26 26C27.5 24.5 30 24.5 31.5 26L64 58.5L96.5 26C98 24.5 100.5 24.5 102 26L106 30C107.5 31.5 107.5 34 106 35.5L73.5 68L106 100.5C107.5 102 107.5 104.5 106 106L102 110C100.5 111.5 98 111.5 96.5 110L64 77.5L31.5 110C30 111.5 27.5 111.5 26 110L22 106C20.5 104.5 20.5 102 22 100.5L54.5 68L22 35.5C20.5 34 20.5 31.5 22 30L26 26Z" fill="currentColor"/>
    `
  },

  // Y: Solid Bold Y (No dots, pure solid)
  {
    letter: 'Y',
    name: '决策分叉树',
    desc: '对称V形双臂自然汇聚于下部垂直主干，线条纯粹无多余分割。',
    colorGrad: {
      x1: 22, y1: 20, x2: 106, y2: 108,
      stops: [
        { offset: '0%', color: '#65A30D' },
        { offset: '100%', color: '#059669' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="22" y1="20" x2="106" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#65A30D"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <path d="M24 24C24 21.8 25.8 20 28 20H42C44.5 20 46.8 21.5 47.8 23.8L64 56L80.2 23.8C81.2 21.5 83.5 20 86 20H100C102.2 20 104 21.8 104 24C104 25 103.5 26 103 27L74 72V104C74 106.2 72.2 108 70 108H58C55.8 108 54 106.2 54 104V72L25 27C24.5 26 24 25 24 24Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M24 24C24 21.8 25.8 20 28 20H42C44.5 20 46.8 21.5 47.8 23.8L64 56L80.2 23.8C81.2 21.5 83.5 20 86 20H100C102.2 20 104 21.8 104 24C104 25 103.5 26 103 27L74 72V104C74 106.2 72.2 108 70 108H58C55.8 108 54 106.2 54 104V72L25 27C24.5 26 24 25 24 24Z" fill="currentColor"/>
    `
  },

  // Z: Solid Bold Z (Continuous monolithic diagonal, NOT broken! No dots)
  {
    letter: 'Z',
    name: '折返超光速',
    desc: '端正水平顶底梁配合极速倾斜对角梁，实心连贯，结构硬朗有力。',
    colorGrad: {
      x1: 24, y1: 20, x2: 104, y2: 108,
      stops: [
        { offset: '0%', color: '#1D4ED8' },
        { offset: '100%', color: '#0284C7' }
      ]
    },
    colorSvg: (id) => `
      <defs>
        <linearGradient id="${id}-grad" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1D4ED8"/>
          <stop offset="100%" stop-color="#0284C7"/>
        </linearGradient>
      </defs>
      <path d="M26 24C26 21.8 27.8 20 30 20H98C100.2 20 102 21.8 102 24V34C102 36.2 100.2 38 98 38H54L98 90C100.5 92.5 102 95.5 102 98V104C102 106.2 100.2 108 98 108H28C25.8 108 24 106.2 24 104V94C24 91.8 25.8 90 28 90H72L28 38C25.5 35.5 24 32.5 24 30V24H26Z" fill="url(#${id}-grad)"/>
    `,
    monoSvg: () => `
      <path d="M26 24C26 21.8 27.8 20 30 20H98C100.2 20 102 21.8 102 24V34C102 36.2 100.2 38 98 38H54L98 90C100.5 92.5 102 95.5 102 98V104C102 106.2 100.2 108 98 108H28C25.8 108 24 106.2 24 104V94C24 91.8 25.8 90 28 90H72L28 38C25.5 35.5 24 32.5 24 30V24H26Z" fill="currentColor"/>
    `
  }
];

function run() {
  const root = path.resolve(__dirname);
  const colorDir = path.join(root, 'svg', 'color');
  const monoDir = path.join(root, 'svg', 'monochrome');

  fs.mkdirSync(colorDir, { recursive: true });
  fs.mkdirSync(monoDir, { recursive: true });

  letters.forEach((item) => {
    const colorContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
${item.colorSvg(`ai-${item.letter.toLowerCase()}`)}
</svg>`.trim();

    const monoContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none" style="color: currentColor;">
${item.monoSvg()}
</svg>`.trim();

    fs.writeFileSync(path.join(colorDir, `${item.letter}.svg`), colorContent, 'utf-8');
    fs.writeFileSync(path.join(monoDir, `${item.letter}.svg`), monoContent, 'utf-8');
  });

  console.log(`Generated all ${letters.length} solid, rugged, clean letters without misplaced dots or fragmentation!`);
}

run();
