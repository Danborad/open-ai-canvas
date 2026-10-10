import fs from 'fs';
import path from 'path';

// Let's create a test suite specifically testing the "立体堆叠 / 断裂拼接 / 中心光点" concept
// across A, B, C, D, E, F, G, H, K, N, X, Z

interface LetterItem {
  letter: string;
  name: string;
  desc: string;
  colorSvg: string;
  monoSvg: string;
}

const testLetters: LetterItem[] = [
  // A: 3D Interlocking Chevron & Floating Crossbar with centered dot
  {
    letter: 'A',
    name: '空间折叠金字塔',
    desc: '左右立柱于顶点45°断裂交错咬合，中心悬浮量子横梁与居中核心光点。',
    colorSvg: `
      <defs>
        <linearGradient id="t-a-left" x1="24" y1="104" x2="64" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00F2FE"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
        <linearGradient id="t-a-right" x1="64" y1="20" x2="104" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
        <linearGradient id="t-a-bar" x1="42" y1="72" x2="86" y2="72" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#818CF8"/>
        </linearGradient>
      </defs>
      <!-- Left Stride (Foreground) -->
      <path d="M64 20C61 20 58.2 21.8 57 24.5L25 98C23.8 100.8 25.8 104 28.8 104H45C47.5 104 49.8 102.5 50.8 100.2L55.8 88H68L64 78H59.5L64 66L68 56L64 20Z" fill="url(#t-a-left)"/>
      <!-- Right Stride with 45deg apex slit (Background Overlap) -->
      <path d="M69 26L103 98C104.2 100.8 102.2 104 99.2 104H83C80.5 104 78.2 102.5 77.2 100.2L72.2 88H60L64 78H68.5L64 66L60 56L69 26Z" fill="url(#t-a-right)"/>
      <!-- Pure Clean Integrated Shape for A with precision cut -->
      <!-- Let's do a pure clean path for A with floating bar -->
      <path d="M57 25L25 98C23.8 100.8 25.8 104 28.8 104H45C47.5 104 49.8 102.5 50.8 100.2L57.5 84H70.5L77.2 100.2C78.2 102.5 80.5 104 83 104H99.2C102.2 104 104.2 100.8 103 98L71 25C69.5 22 66.5 20 63 20H65C61.5 20 58.5 22 57 25ZM64 42L70 68H58L64 42Z" fill="none"/>
    `,
    monoSvg: ``
  }
];
