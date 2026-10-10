// generator.ts: 生成 26 个英文字母的硬朗 AI 大厂风格图标库 (Color & Monochrome) 及完整交互页面
import fs from "fs";
import path from "path";

export interface IconDef {
  letter: string;
  name: string;
  desc: string;
  colorStops: { offset: string; color: string }[];
  accentColor: string;
  renderColor: (id: string) => string;
  renderMono: () => string;
}

const colorDir = path.resolve("ai-alphabet-logos/svg/color");
const monoDir = path.resolve("ai-alphabet-logos/svg/monochrome");

fs.mkdirSync(colorDir, { recursive: true });
fs.mkdirSync(monoDir, { recursive: true });

export const icons: IconDef[] = [
  // A: 拓扑梯形金字塔，悬浮平直横梁，平顶平底
  {
    letter: "A",
    name: "拓扑金字塔",
    desc: "梯形对称立柱与悬浮平直横梁，象征神经网络基底模型。",
    colorStops: [
      { offset: "0%", color: "#06B6D4" },
      { offset: "50%", color: "#3B82F6" },
      { offset: "100%", color: "#6366F1" },
    ],
    accentColor: "#3B82F6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="108" x2="108" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="50%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
      </defs>
      <path d="M57 22C60.5 22 63.5 24 65 27L106 104C107.5 106.8 105.5 110 102 110H84C81.5 110 79.2 108.5 78 106.2L69 88H47L38 106.2C36.8 108.5 34.5 110 32 110H14C10.5 110 8.5 106.8 10 104L51 27C52.5 24 54.5 22 57 22Z" fill="url(#${id})"/>
      <polygon points="58,46 73,76 43,76" fill="#0B0F19"/>
      <rect x="42" y="72" width="32" height="6" rx="2" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <path d="M57 22C60.5 22 63.5 24 65 27L106 104C107.5 106.8 105.5 110 102 110H84C81.5 110 79.2 108.5 78 106.2L69 88H47L38 106.2C36.8 108.5 34.5 110 32 110H14C10.5 110 8.5 106.8 10 104L51 27C52.5 24 54.5 22 57 22Z" fill="currentColor"/>
      <polygon points="58,46 73,76 43,76" fill="#0B0F19"/>
      <rect x="42" y="72" width="32" height="6" rx="2" fill="currentColor"/>
    `,
  },

  // B: 双核矩阵，左侧直立平切立柱，右侧上下双折面科技舱
  {
    letter: "B",
    name: "双核矩阵",
    desc: "垂直能量立柱与上下双折叠共振舱，象征双脑协同。",
    colorStops: [
      { offset: "0%", color: "#3B82F6" },
      { offset: "100%", color: "#8B5CF6" },
    ],
    accentColor: "#6366F1",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#8B5CF6"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <path d="M46 20H76C87 20 96 29 96 40C96 51 87 60 76 60H46V20Z" fill="url(#${id})"/>
      <path d="M46 28H74C80.6 28 86 33.4 86 40C86 46.6 80.6 52 74 52H46V28Z" fill="#0B0F19"/>
      <path d="M46 64H80C91 64 100 73 100 84C100 95 91 104 80 104H46V64Z" fill="url(#${id})"/>
      <path d="M46 72H78C84.6 72 90 77.4 90 84C90 90.6 84.6 96 78 96H46V72Z" fill="#0B0F19"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <path d="M46 20H76C87 20 96 29 96 40C96 51 87 60 76 60H46V20Z" fill="currentColor"/>
      <path d="M46 28H74C80.6 28 86 33.4 86 40C86 46.6 80.6 52 74 52H46V28Z" fill="#0B0F19"/>
      <path d="M46 64H80C91 64 100 73 100 84C100 95 91 104 80 104H46V64Z" fill="currentColor"/>
      <path d="M46 72H78C84.6 72 90 77.4 90 84C90 90.6 84.6 96 78 96H46V72Z" fill="#0B0F19"/>
    `,
  },

  // C: 粒子加速磁环，45度平直切口，厚实平截面
  {
    letter: "C",
    name: "加速磁环",
    desc: "厚实开环磁力加速腔，精密平切端头。",
    colorStops: [
      { offset: "0%", color: "#10B981" },
      { offset: "100%", color: "#06B6D4" },
    ],
    accentColor: "#10B981",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
      </defs>
      <path d="M96 44L82 52C78 43 69.5 38 60 38C45.6 38 34 49.6 34 64C34 78.4 45.6 90 60 90C69.5 90 78 85 82 76L96 84C89 97 75.5 106 60 106C36.8 106 18 87.2 18 64C18 40.8 36.8 22 60 22C75.5 22 89 31 96 44Z" fill="url(#${id})"/>
      <circle cx="94" cy="40" r="3.5" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <path d="M96 44L82 52C78 43 69.5 38 60 38C45.6 38 34 49.6 34 64C34 78.4 45.6 90 60 90C69.5 90 78 85 82 76L96 84C89 97 75.5 106 60 106C36.8 106 18 87.2 18 64C18 40.8 36.8 22 60 22C75.5 22 89 31 96 44Z" fill="currentColor"/>
    `,
  },

  // D: 空间半折叠，左垂直立柱，右半圆厚度外包
  {
    letter: "D",
    name: "隐空投影",
    desc: "笔直立柱与硬挺外拱，象征高维投影空间。",
    colorStops: [
      { offset: "0%", color: "#2563EB" },
      { offset: "100%", color: "#7C3AED" },
    ],
    accentColor: "#3B82F6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <path d="M26 20H66C89 20 106 37 106 64C106 91 89 108 66 108H26V20Z" fill="url(#${id})"/>
      <path d="M44 38H64C78 38 88 48 88 64C88 80 78 90 64 90H44V38Z" fill="#0B0F19"/>
      <rect x="26" y="20" width="16" height="88" rx="2" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M26 20H66C89 20 106 37 106 64C106 91 89 108 66 108H26V20Z" fill="currentColor"/>
      <path d="M44 38H64C78 38 88 48 88 64C88 80 78 90 64 90H44V38Z" fill="#0B0F19"/>
    `,
  },

  // E: 阶梯式光栅，左立柱 + 三根悬浮平切横条
  {
    letter: "E",
    name: "阶梯光栅",
    desc: "多通道频段光栅，平切端头与悬浮切缝。",
    colorStops: [
      { offset: "0%", color: "#FF5E3A" },
      { offset: "100%", color: "#FFA502" },
    ],
    accentColor: "#FF5E3A",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FF5E3A"/>
          <stop offset="100%" stop-color="#FFA502"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <rect x="46" y="20" width="56" height="18" rx="3" fill="url(#${id})"/>
      <rect x="46" y="55" width="44" height="18" rx="3" fill="url(#${id})"/>
      <rect x="46" y="90" width="56" height="18" rx="3" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <rect x="46" y="20" width="56" height="18" rx="3" fill="currentColor"/>
      <rect x="46" y="55" width="44" height="18" rx="3" fill="currentColor"/>
      <rect x="46" y="90" width="56" height="18" rx="3" fill="currentColor"/>
    `,
  },

  // F: 悬浮双翼阶跃脉冲
  {
    letter: "F",
    name: "阶跃脉冲",
    desc: "垂直主干与双悬浮平切翼梁，象征激活函数。",
    colorStops: [
      { offset: "0%", color: "#F43F5E" },
      { offset: "100%", color: "#FB923C" },
    ],
    accentColor: "#F43F5E",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F43F5E"/>
          <stop offset="100%" stop-color="#FB923C"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <rect x="46" y="20" width="58" height="18" rx="3" fill="url(#${id})"/>
      <rect x="46" y="55" width="42" height="18" rx="3" fill="url(#${id})"/>
      <circle cx="102" cy="29" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <rect x="46" y="20" width="58" height="18" rx="3" fill="currentColor"/>
      <rect x="46" y="55" width="42" height="18" rx="3" fill="currentColor"/>
    `,
  },

  // G: 用户圈定的极硬朗平切 G（方案 A 基础深化版，平直悬浮横杠与利落端头）
  {
    letter: "G",
    name: "神经流光",
    desc: "厚实硬朗外圆环配合向心悬浮平直横梁，极具工业质感。",
    colorStops: [
      { offset: "0%", color: "#00F2FE" },
      { offset: "40%", color: "#3B82F6" },
      { offset: "75%", color: "#6366F1" },
      { offset: "100%", color: "#EC4899" },
    ],
    accentColor: "#3B82F6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00F2FE"/>
          <stop offset="40%" stop-color="#3B82F6"/>
          <stop offset="75%" stop-color="#6366F1"/>
          <stop offset="100%" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
      <path d="M96 42L84 50C80 43 72.5 38 64 38C49.6 38 38 49.6 38 64C38 78.4 49.6 90 64 90C76 90 86 82 89 71H62V55H105C106 58 106 61 106 64C106 87.2 87.2 106 64 106C40.8 106 22 87.2 22 64C22 40.8 40.8 22 64 22C77 22 88.5 28 96 42Z" fill="url(#${id})"/>
      <circle cx="68" cy="63" r="3.2" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <path d="M96 42L84 50C80 43 72.5 38 64 38C49.6 38 38 49.6 38 64C38 78.4 49.6 90 64 90C76 90 86 82 89 71H62V55H105C106 58 106 61 106 64C106 87.2 87.2 106 64 106C40.8 106 22 87.2 22 64C22 40.8 40.8 22 64 22C77 22 88.5 28 96 42Z" fill="currentColor"/>
    `,
  },

  // H: 双塔量子桥，两条平直垂直立柱，悬浮中间平梁
  {
    letter: "H",
    name: "量子光桥",
    desc: "双塔垂直能量立柱与平切悬浮光桥，象征端云互联。",
    colorStops: [
      { offset: "0%", color: "#7C3AED" },
      { offset: "100%", color: "#EC4899" },
    ],
    accentColor: "#8B5CF6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <rect x="86" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <rect x="42" y="55" width="44" height="18" rx="2" fill="url(#${id})"/>
      <circle cx="64" cy="64" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <rect x="86" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <rect x="42" y="55" width="44" height="18" rx="2" fill="currentColor"/>
    `,
  },

  // I: 奇点发射柱，垂直粗壮立柱，带有平切量子顶部
  {
    letter: "I",
    name: "奇点光柱",
    desc: "厚实单点光柱与顶部悬浮晶体，象征垂直涌现。",
    colorStops: [
      { offset: "0%", color: "#00F2FE" },
      { offset: "100%", color: "#3B82F6" },
    ],
    accentColor: "#06B6D4",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="50" y1="20" x2="78" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00F2FE"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
      <rect x="52" y="38" width="24" height="70" rx="3" fill="url(#${id})"/>
      <rect x="52" y="20" width="24" height="12" rx="3" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <rect x="52" y="38" width="24" height="70" rx="3" fill="currentColor"/>
      <rect x="52" y="20" width="24" height="12" rx="3" fill="currentColor"/>
    `,
  },

  // J: 引力回旋流，右侧直挺平切立柱，左下平折平切回旋
  {
    letter: "J",
    name: "回旋探针",
    desc: "平直立柱与硬朗平切回弯，强化学习反馈回路。",
    colorStops: [
      { offset: "0%", color: "#0D9488" },
      { offset: "100%", color: "#34D399" },
    ],
    accentColor: "#10B981",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="28" y1="20" x2="100" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0D9488"/>
          <stop offset="100%" stop-color="#34D399"/>
        </linearGradient>
      </defs>
      <path d="M82 20H100V78C100 95 86 108 68 108H54C37 108 24 95 24 78V70H42V78C42 85 47 90 54 90H68C75 90 82 85 82 78V20Z" fill="url(#${id})"/>
      <circle cx="91" cy="28" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <path d="M82 20H100V78C100 95 86 108 68 108H54C37 108 24 95 24 78V70H42V78C42 85 47 90 54 90H68C75 90 82 85 82 78V20Z" fill="currentColor"/>
    `,
  },

  // K: 折射双刃，左直立立柱，右侧上下两条高速倾斜平切刀锋
  {
    letter: "K",
    name: "折射双刃",
    desc: "垂直主干与双斜向平切刀锋，交错咬合。",
    colorStops: [
      { offset: "0%", color: "#F43F5E" },
      { offset: "100%", color: "#A855F7" },
    ],
    accentColor: "#EC4899",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F43F5E"/>
          <stop offset="100%" stop-color="#A855F7"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <polygon points="46,64 88,20 106,20 62,64" fill="url(#${id})"/>
      <polygon points="56,58 104,108 86,108 46,68" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <polygon points="46,64 88,20 106,20 62,64" fill="currentColor"/>
      <polygon points="56,58 104,108 86,108 46,68" fill="currentColor"/>
    `,
  },

  // L: 极坐标直角基底，垂直立柱与右延平托，带倒角内切
  {
    letter: "L",
    name: "矢量基底",
    desc: "平直直角坐标基，转角平切内倒角。",
    colorStops: [
      { offset: "0%", color: "#1D4ED8" },
      { offset: "100%", color: "#38BDF8" },
    ],
    accentColor: "#3B82F6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="26" y1="20" x2="102" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1D4ED8"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <path d="M26 20H44V90H102V108H26V20Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M26 20H44V90H102V108H26V20Z" fill="currentColor"/>
    `,
  },

  // M: 双峰 MoE 架构，两侧平直立柱，中央硬朗平切 V 刀锋汇聚
  {
    letter: "M",
    name: "MoE 双峰",
    desc: "坚挺双立柱与向心交错平切刀锋，代表多专家混合架构。",
    colorStops: [
      { offset: "0%", color: "#06B6D4" },
      { offset: "100%", color: "#3B82F6" },
    ],
    accentColor: "#06B6D4",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
      <path d="M20 20H38L64 72L90 20H108V108H90V52L69 94H59L38 52V108H20V20Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M20 20H38L64 72L90 20H108V108H90V52L69 94H59L38 52V108H20V20Z" fill="currentColor"/>
    `,
  },

  // N: 用户选中的【方案 B · 动能双刃 (Kinetic Pulse)】！平切端头、斜向平行四边形、几何咬合
  {
    letter: "N",
    name: "动能双刃",
    desc: "高速交错的几何平切多边形与中心脉冲枢纽，矩阵算力并发。",
    colorStops: [
      { offset: "0%", color: "#10B981" },
      { offset: "100%", color: "#06B6D4" },
    ],
    accentColor: "#10B981",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}-l" x1="24" y1="20" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
        <linearGradient id="${id}-r" x1="60" y1="48" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
      <path d="M28 24C28 21.8 29.8 20 32 20H44C47.2 20 50.1 22.1 51.1 25.1L75 97H57L41.9 48.5L42 104C42 106.2 40.2 108 38 108H32C29.8 108 28 106.2 28 104V24Z" fill="url(#${id}-l)"/>
      <path d="M100 104C100 106.2 98.2 108 96 108H84C80.8 108 77.9 105.9 76.9 102.9L53 31H71L86.1 79.5L86 24C86 21.8 87.8 20 90 20H96C98.2 20 100 21.8 100 24V104Z" fill="url(#${id}-r)"/>
      <circle cx="64" cy="64" r="3.5" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <path d="M28 24C28 21.8 29.8 20 32 20H44C47.2 20 50.1 22.1 51.1 25.1L75 97H57L41.9 48.5L42 104C42 106.2 40.2 108 38 108H32C29.8 108 28 106.2 28 104V24Z" fill="currentColor"/>
      <path d="M100 104C100 106.2 98.2 108 96 108H84C80.8 108 77.9 105.9 76.9 102.9L53 31H71L86.1 79.5L86 24C86 21.8 87.8 20 90 20H96C98.2 20 100 21.8 100 24V104Z" fill="currentColor"/>
      <circle cx="64" cy="64" r="4.5" fill="#0B0F19"/>
    `,
  },

  // O: 超环体拓扑，硬挺饱满圆角方环/对称厚壁
  {
    letter: "O",
    name: "超环拓扑",
    desc: "厚实圆环与纯净内空腔，自适应闭环大模型系统。",
    colorStops: [
      { offset: "0%", color: "#3B82F6" },
      { offset: "100%", color: "#6366F1" },
    ],
    accentColor: "#3B82F6",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
      </defs>
      <path d="M64 20C40 20 20 40 20 64C20 88 40 108 64 108C88 108 108 88 108 64C108 40 88 20 64 20ZM64 90C49.6 90 38 78.4 38 64C38 49.6 49.6 38 64 38C78.4 38 90 49.6 90 64C90 78.4 78.4 90 64 90Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M64 20C40 20 20 40 20 64C20 88 40 108 64 108C88 108 108 88 108 64C108 40 88 20 64 20ZM64 90C49.6 90 38 78.4 38 64C38 49.6 49.6 38 64 38C78.4 38 90 49.6 90 64C90 78.4 78.4 90 64 90Z" fill="currentColor"/>
    `,
  },

  // P: 单侧神经元，左立柱贯通，右上平直硬朗半回路
  {
    letter: "P",
    name: "神经触发",
    desc: "硬朗立柱与悬浮平回路，提示词前端感知。",
    colorStops: [
      { offset: "0%", color: "#E11D48" },
      { offset: "100%", color: "#FB923C" },
    ],
    accentColor: "#E11D48",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="100" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#E11D48"/>
          <stop offset="100%" stop-color="#FB923C"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <path d="M42 20H76C90 20 100 30 100 44C100 58 90 68 76 68H42V20Z" fill="url(#${id})"/>
      <path d="M42 36H72C77 36 82 40 82 44C82 48 77 52 72 52H42V36Z" fill="#0B0F19"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <path d="M42 20H76C90 20 100 30 100 44C100 58 90 68 76 68H42V20Z" fill="currentColor"/>
      <path d="M42 36H72C77 36 82 40 82 44C82 48 77 52 72 52H42V36Z" fill="#0B0F19"/>
    `,
  },

  // Q: 引力透镜环，硬环 + 45° 倾斜利落平切光刃
  {
    letter: "Q",
    name: "引力透镜",
    desc: "闭合圆环与高速刺穿切线，代表深度研究探索。",
    colorStops: [
      { offset: "0%", color: "#4338CA" },
      { offset: "100%", color: "#38BDF8" },
    ],
    accentColor: "#38BDF8",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="110" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4338CA"/>
          <stop offset="100%" stop-color="#38BDF8"/>
        </linearGradient>
      </defs>
      <path d="M60 20C38 20 20 38 20 60C20 82 38 100 60 100C82 100 100 82 100 60C100 38 82 20 60 20ZM60 84C46.8 84 36 73.2 36 60C36 46.8 46.8 36 60 36C73.2 36 84 46.8 84 60C84 73.2 73.2 84 60 84Z" fill="url(#${id})"/>
      <polygon points="76,74 104,102 92,112 66,86" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M60 20C38 20 20 38 20 60C20 82 38 100 60 100C82 100 100 82 100 60C100 38 82 20 60 20ZM60 84C46.8 84 36 73.2 36 60C36 46.8 46.8 36 60 36C73.2 36 84 46.8 84 60C84 73.2 73.2 84 60 84Z" fill="currentColor"/>
      <polygon points="76,74 104,102 92,112 66,86" fill="currentColor"/>
    `,
  },

  // R: 递归发散流，立柱 + P环 + 45° 支撑平切刀锋
  {
    letter: "R",
    name: "递归发散",
    desc: "主干支撑与倾斜高速能量刀，递归推理解码。",
    colorStops: [
      { offset: "0%", color: "#BE123C" },
      { offset: "100%", color: "#F59E0B" },
    ],
    accentColor: "#F59E0B",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#BE123C"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
      <rect x="24" y="20" width="18" height="88" rx="3" fill="url(#${id})"/>
      <path d="M42 20H74C88 20 98 29 98 42C98 55 88 64 74 64H42V20Z" fill="url(#${id})"/>
      <path d="M42 36H70C74 36 78 39 78 42C78 45 74 48 70 48H42V36Z" fill="#0B0F19"/>
      <polygon points="62,60 102,108 82,108 46,64" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <rect x="24" y="20" width="18" height="88" rx="3" fill="currentColor"/>
      <path d="M42 20H74C88 20 98 29 98 42C98 55 88 64 74 64H42V20Z" fill="currentColor"/>
      <path d="M42 36H70C74 36 78 39 78 42C78 45 74 48 70 48H42V36Z" fill="#0B0F19"/>
      <polygon points="62,60 102,108 82,108 46,64" fill="currentColor"/>
    `,
  },

  // S: 双向超导流，45° 阶梯式硬朗平切双钩
  {
    letter: "S",
    name: "超导流形",
    desc: "阶梯式硬朗折角与对角线平切，流形动态插值。",
    colorStops: [
      { offset: "0%", color: "#06B6D4" },
      { offset: "50%", color: "#3B82F6" },
      { offset: "100%", color: "#6366F1" },
    ],
    accentColor: "#06B6D4",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="50%" stop-color="#3B82F6"/>
          <stop offset="100%" stop-color="#6366F1"/>
        </linearGradient>
      </defs>
      <path d="M96 38L80 44C77 38 72 36 64 36C55 36 48 40 48 46C48 52 54 55 68 59C86 64 98 71 98 84C98 98 84 108 64 108C45 108 32 98 28 84L44 78C47 86 53 91 64 91C73 91 80 87 80 81C80 75 74 71 60 67C42 62 30 56 30 43C30 29 44 20 64 20C80 20 92 27 96 38Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M96 38L80 44C77 38 72 36 64 36C55 36 48 40 48 46C48 52 54 55 68 59C86 64 98 71 98 84C98 98 84 108 64 108C45 108 32 98 28 84L44 78C47 86 53 91 64 91C73 91 80 87 80 81C80 75 74 71 60 67C42 62 30 56 30 43C30 29 44 20 64 20C80 20 92 27 96 38Z" fill="currentColor"/>
    `,
  },

  // T: 悬浮能量天平，顶部宽大平直横梁，正中立柱
  {
    letter: "T",
    name: "能量天平",
    desc: "平直宽梁与正立能量柱，象征优化器收敛权衡。",
    colorStops: [
      { offset: "0%", color: "#38BDF8" },
      { offset: "100%", color: "#818CF8" },
    ],
    accentColor: "#38BDF8",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#38BDF8"/>
          <stop offset="100%" stop-color="#818CF8"/>
        </linearGradient>
      </defs>
      <rect x="18" y="20" width="92" height="18" rx="3" fill="url(#${id})"/>
      <rect x="55" y="44" width="18" height="64" rx="3" fill="url(#${id})"/>
      <circle cx="64" cy="29" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <rect x="18" y="20" width="92" height="18" rx="3" fill="currentColor"/>
      <rect x="55" y="44" width="18" height="64" rx="3" fill="currentColor"/>
    `,
  },

  // U: 势阱谐振腔，硬朗厚壁直下与平切底拱
  {
    letter: "U",
    name: "势阱谐振",
    desc: "厚壁对称直槽与底部平弧，极小值收敛腔。",
    colorStops: [
      { offset: "0%", color: "#059669" },
      { offset: "100%", color: "#06B6D4" },
    ],
    accentColor: "#059669",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="24" y1="20" x2="104" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
      </defs>
      <path d="M24 20H42V72C42 84 52 90 64 90C76 90 86 84 86 72V20H104V72C104 94 86 108 64 108C42 108 24 94 24 72V20Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M24 20H42V72C42 84 52 90 64 90C76 90 86 84 86 72V20H104V72C104 94 86 108 64 108C42 108 24 94 24 72V20Z" fill="currentColor"/>
    `,
  },

  // V: 聚束锥体，两条倾斜平切刀锋在底部平直汇聚
  {
    letter: "V",
    name: "聚束锐锥",
    desc: "对称倾斜平切刀锋向下聚束，象征梯度方向。",
    colorStops: [
      { offset: "0%", color: "#7C3AED" },
      { offset: "100%", color: "#DB2777" },
    ],
    accentColor: "#DB2777",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#DB2777"/>
        </linearGradient>
      </defs>
      <path d="M18 20H38L64 88L90 20H110L74 108H54L18 20Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M18 20H38L64 88L90 20H110L74 108H54L18 20Z" fill="currentColor"/>
    `,
  },

  // W: 多维世界波，四条倾斜平切刀锋，双底部尖峰
  {
    letter: "W",
    name: "世界模型波",
    desc: "四阶倾斜平切刀锋与波形展开，代表世界模型。",
    colorStops: [
      { offset: "0%", color: "#2563EB" },
      { offset: "100%", color: "#22D3EE" },
    ],
    accentColor: "#22D3EE",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="14" y1="20" x2="114" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="100%" stop-color="#22D3EE"/>
        </linearGradient>
      </defs>
      <path d="M14 20H32L46 76L60 20H68L82 76L96 20H114L92 108H76L64 62L52 108H36L14 20Z" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <path d="M14 20H32L46 76L60 20H68L82 76L96 20H114L92 108H76L64 62L52 108H36L14 20Z" fill="currentColor"/>
    `,
  },

  // X: 交叉突触核，双向对角倾斜平切刀锋，中心负空间菱形穿插
  {
    letter: "X",
    name: "交叉突触",
    desc: "双对角平切光束与中心立体交叠，跨模态注意力融合。",
    colorStops: [
      { offset: "0%", color: "#06B6D4" },
      { offset: "100%", color: "#EC4899" },
    ],
    accentColor: "#EC4899",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#06B6D4"/>
          <stop offset="100%" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
      <polygon points="18,20 38,20 110,108 90,108" fill="url(#${id})"/>
      <polygon points="90,20 110,20 74,60 56,42" fill="url(#${id})"/>
      <polygon points="18,108 38,108 72,68 54,86" fill="url(#${id})"/>
      <circle cx="64" cy="64" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <polygon points="18,20 38,20 110,108 90,108" fill="currentColor"/>
      <polygon points="90,20 110,20 74,60 56,42" fill="currentColor"/>
      <polygon points="18,108 38,108 72,68 54,86" fill="currentColor"/>
    `,
  },

  // Y: 分叉决策树，上半部平切 V 构，下半部垂直立柱
  {
    letter: "Y",
    name: "决策分支",
    desc: "V 形分叉与垂直基座，思考链分支探索。",
    colorStops: [
      { offset: "0%", color: "#F59E0B" },
      { offset: "100%", color: "#EF4444" },
    ],
    accentColor: "#F59E0B",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#EF4444"/>
        </linearGradient>
      </defs>
      <polygon points="20,20 40,20 64,58 88,20 108,20 73,72 73,108 55,108 55,72" fill="url(#${id})"/>
    `,
    renderMono: () => `
      <polygon points="20,20 40,20 64,58 88,20 108,20 73,72 73,108 55,108 55,72" fill="currentColor"/>
    `,
  },

  // Z: 超光速折线，上下平行横梁与中间高速倾斜平切折线
  {
    letter: "Z",
    name: "矢量折线",
    desc: "平行平切横梁与对角冲刺光刃，极速推理引擎。",
    colorStops: [
      { offset: "0%", color: "#10B981" },
      { offset: "100%", color: "#3B82F6" },
    ],
    accentColor: "#10B981",
    renderColor: (id) => `
      <defs>
        <linearGradient id="${id}" x1="20" y1="20" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
      </defs>
      <polygon points="22,20 106,20 106,36 48,92 106,92 106,108 22,108 22,92 80,36 22,36" fill="url(#${id})"/>
      <circle cx="98" cy="28" r="3" fill="#FFFFFF"/>
    `,
    renderMono: () => `
      <polygon points="22,20 106,20 106,36 48,92 106,92 106,108 22,108 22,92 80,36 22,36" fill="currentColor"/>
    `,
  },
];

// 写入 52 个 SVG
icons.forEach((icon) => {
  const colorContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
    ${icon.renderColor(`g-${icon.letter.toLowerCase()}`)}
  </svg>`.trim();

  const monoContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
    ${icon.renderMono()}
  </svg>`.trim();

  fs.writeFileSync(path.join(colorDir, `${icon.letter}.svg`), colorContent);
  fs.writeFileSync(path.join(monoDir, `${icon.letter}.svg`), monoContent);
});

// 生成 index.html
const iconsJson = JSON.stringify(
  icons.map((ic) => ({
    letter: ic.letter,
    name: ic.name,
    desc: ic.desc,
    accentColor: ic.accentColor,
    colorSvg: `<svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">${ic.renderColor(`demo-${ic.letter.toLowerCase()}`)}</svg>`,
    monoSvg: `<svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: currentColor;">${ic.renderMono()}</svg>`,
  }))
);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 26 字母品牌图标系统 (硬朗科技几何风格)</title>
  <style>
    :root {
      --bg-main: #0B0F19;
      --bg-card: rgba(255, 255, 255, 0.035);
      --border-card: rgba(255, 255, 255, 0.08);
      --text-main: #F8FAFC;
      --text-sub: #94A3B8;
      --accent: #6366F1;
      --icon-box-bg: #141720;
      --icon-box-border: #222736;
      --tag-bg: rgba(99, 102, 241, 0.12);
      --tag-border: rgba(99, 102, 241, 0.25);
      --tag-color: #818CF8;
      --modal-bg: #13161D;
      --modal-border: #222633;
      --modal-slot-bg: #1A1D26;
      --modal-slot-border: #272B38;
    }

    body.light-theme {
      --bg-main: #F1F5F9;
      --bg-card: #FFFFFF;
      --border-card: #E2E8F0;
      --text-main: #0F172A;
      --text-sub: #64748B;
      --icon-box-bg: #F8FAFC;
      --icon-box-border: #CBD5E1;
      --tag-bg: rgba(99, 102, 241, 0.08);
      --tag-border: rgba(99, 102, 241, 0.2);
      --tag-color: #4F46E5;
      --modal-bg: #FFFFFF;
      --modal-border: #E2E8F0;
      --modal-slot-bg: #F8FAFC;
      --modal-slot-border: #E2E8F0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      padding: 40px 24px 80px;
      transition: background-color 0.25s, color 0.25s;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 36px;
    }

    .badge-top {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: var(--tag-bg);
      border: 1px solid var(--tag-border);
      color: var(--tag-color);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 12px;
    }

    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #FFFFFF 20%, #94A3B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    body.light-theme h1 {
      background: linear-gradient(135deg, #0F172A 20%, #475569 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p.lead {
      font-size: 14.5px;
      color: var(--text-sub);
      max-width: 780px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Controls Bar */
    .controls {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin-bottom: 36px;
      flex-wrap: wrap;
    }

    .btn-group {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      padding: 4px;
      border-radius: 12px;
      display: inline-flex;
      gap: 4px;
    }

    .btn {
      background: transparent;
      border: none;
      color: var(--text-sub);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn:hover {
      color: var(--text-main);
    }

    .btn.active {
      background: var(--accent);
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    }

    /* Section titles */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title::before {
      content: "";
      width: 4px;
      height: 18px;
      background: linear-gradient(180deg, #818CF8, #4F46E5);
      border-radius: 2px;
    }

    /* 26 Grid Layout */
    .alphabet-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 56px;
    }

    .letter-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 18px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.25s ease;
      position: relative;
    }

    .letter-card:hover {
      transform: translateY(-3px);
      border-color: rgba(99, 102, 241, 0.4);
      box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.25);
    }

    .letter-card.highlight {
      border: 1.5px solid #818CF8;
      background: rgba(99, 102, 241, 0.08);
    }

    .badge-letter {
      position: absolute;
      top: 12px;
      left: 12px;
      font-size: 11px;
      font-weight: 800;
      color: var(--accent);
      background: rgba(99, 102, 241, 0.12);
      padding: 2px 7px;
      border-radius: 6px;
    }

    .dual-box {
      display: flex;
      gap: 10px;
      width: 100%;
      justify-content: center;
      margin: 18px 0 12px;
    }

    .box-item {
      flex: 1;
      aspect-ratio: 1;
      max-width: 82px;
      border-radius: 14px;
      background: var(--icon-box-bg);
      border: 1px solid var(--icon-box-border);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: all 0.2s;
    }

    .box-item:hover {
      border-color: #818CF8;
    }

    .box-item svg {
      width: 50px;
      height: 50px;
      transition: transform 0.2s ease;
    }

    .box-item:hover svg {
      transform: scale(1.1);
    }

    .box-tag {
      position: absolute;
      bottom: 4px;
      font-size: 8px;
      font-weight: 700;
      color: var(--text-sub);
      text-transform: uppercase;
      opacity: 0.7;
    }

    .card-meta {
      text-align: center;
      width: 100%;
    }

    .meta-name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .meta-desc {
      font-size: 11.5px;
      color: var(--text-sub);
      line-height: 1.45;
      margin-bottom: 12px;
      height: 34px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .copy-actions {
      display: flex;
      gap: 6px;
      width: 100%;
      margin-top: auto;
    }

    .copy-btn {
      flex: 1;
      padding: 6px 0;
      font-size: 10.5px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--border-card);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-sub);
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }

    .copy-btn:hover {
      background: rgba(99, 102, 241, 0.2);
      color: var(--accent);
      border-color: rgba(99, 102, 241, 0.4);
    }

    /* Modal Simulation Section */
    .mock-section {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 20px;
      padding: 28px 20px;
      margin-bottom: 50px;
    }

    .mock-modal {
      background: var(--modal-bg);
      border: 1px solid var(--modal-border);
      border-radius: 16px;
      padding: 22px;
      max-width: 580px;
      margin: 0 auto;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
    }

    .mock-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
    }

    .mock-search {
      width: 100%;
      background: var(--modal-slot-bg);
      border: 1px solid var(--modal-slot-border);
      border-radius: 8px;
      padding: 8px 12px;
      color: var(--text-sub);
      font-size: 12.5px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mock-icon-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 8px;
      padding-bottom: 16px;
    }

    .mock-slot {
      aspect-ratio: 1;
      background: var(--modal-slot-bg);
      border: 1px solid var(--modal-slot-border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }

    .mock-slot:hover {
      border-color: #6366F1;
      background: rgba(99, 102, 241, 0.12);
      transform: scale(1.05);
    }

    .mock-slot svg {
      width: 25px;
      height: 25px;
    }

    /* Toast */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10B981;
      color: white;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s ease;
      pointer-events: none;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
      z-index: 1000;
    }

    #toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge-top">
        <span>⚡</span> AI HARD-SURFACE ALPHABET (A - Z FULL SUITE)
      </div>
      <h1>AI 大厂硬朗科技风格 26 字母图标套件</h1>
      <p class="lead">
        根据您的要求，全面采用<b>硬朗平切线条（Flat Chamfer & Cut）与扎实几何构型</b>，融合 OpenAI、Anthropic、Copilot、Mistral 等前沿大厂视觉语言。<br/>
        已为 26 个字母（A~Z）全面绘制<b>高光流体彩色版</b>与<b>负空间极简黑白版</b>（共 52 套矢量图形）。
      </p>
    </header>

    <!-- Controls -->
    <div class="controls">
      <div class="btn-group">
        <button class="btn active" id="btn-dark" onclick="switchTheme('dark')">🌙 暗夜主题 (Dark)</button>
        <button class="btn" id="btn-light" onclick="switchTheme('light')">☀️ 浅白主题 (Light)</button>
      </div>
      <div class="btn-group">
        <button class="btn active" id="btn-filter-all" onclick="filterIcons('all')">全套 26 字母 (A - Z)</button>
        <button class="btn" id="btn-filter-gn" onclick="filterIcons('gn')">重点高亮: G & N 字母</button>
      </div>
      <div class="btn-group">
        <button class="btn active" id="btn-modal-color" onclick="switchModalStyle('color')">弹窗: 彩色版</button>
        <button class="btn" id="btn-modal-mono" onclick="switchModalStyle('mono')">弹窗: 黑白版</button>
      </div>
    </div>

    <!-- Section: 26 Alphabet Showcase Grid -->
    <div class="section-header">
      <div class="section-title">26 个英文字母全套展台 (彩色流光 vs 黑白负空间并列)</div>
      <div style="font-size: 12px; color: var(--text-sub);">点击图标或按钮可直接复制矢量源码</div>
    </div>
    <div class="alphabet-grid" id="alphabet-grid"></div>

    <!-- Section: Mock Dialog in Real Context -->
    <div class="section-header">
      <div class="section-title">业务场景还原 · 嵌入“选择模型 Logo”对话框 (32 格矩阵)</div>
    </div>
    <div class="mock-section">
      <div class="mock-modal">
        <div class="mock-modal-header">
          <span>选择模型 Logo</span>
          <span style="color: var(--text-sub); cursor: pointer;">✕</span>
        </div>
        <div class="mock-search">
          <span>🔍</span>
          <span>搜索品牌或模型名称 (如 OpenAI, Claude, Google, G-AI, Nexus...)...</span>
        </div>
        <div class="mock-icon-grid" id="mock-grid"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-sub); margin-top: 10px;">
          <span>共 321 个可用 Logo</span>
          <div style="display: flex; gap: 8px;">
            <button style="background: var(--modal-slot-bg); border: 1px solid var(--modal-slot-border); color: var(--text-main); padding: 4px 10px; border-radius: 6px; cursor: pointer;">清除 Logo</button>
            <button style="background: #4F46E5; border: none; color: #FFFFFF; padding: 4px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">完成</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div id="toast">已复制 SVG 源码到剪贴板！</div>

  <script>
    const ICONS = ${iconsJson};
    let currentFilter = 'all';
    let modalStyle = 'color';

    function renderGrid() {
      const grid = document.getElementById('alphabet-grid');
      grid.innerHTML = '';

      ICONS.forEach(icon => {
        if (currentFilter === 'gn' && icon.letter !== 'G' && icon.letter !== 'N') return;

        const card = document.createElement('div');
        card.className = 'letter-card' + ((icon.letter === 'G' || icon.letter === 'N') ? ' highlight' : '');

        card.innerHTML = \`
          <span class="badge-letter">\${icon.letter}</span>
          <div class="dual-box">
            <div class="box-item" onclick="copySVG('\${icon.letter}', 'color')" title="点击复制彩色 SVG">
              \${icon.colorSvg}
              <span class="box-tag">Color</span>
            </div>
            <div class="box-item" onclick="copySVG('\${icon.letter}', 'mono')" title="点击复制黑白 SVG">
              \${icon.monoSvg}
              <span class="box-tag">B & W</span>
            </div>
          </div>
          <div class="card-meta">
            <div class="meta-name">\${icon.letter} · \${icon.name}</div>
            <div class="meta-desc">\${icon.desc}</div>
          </div>
          <div class="copy-actions">
            <button class="copy-btn" onclick="copySVG('\${icon.letter}', 'color')">彩色版</button>
            <button class="copy-btn" onclick="copySVG('\${icon.letter}', 'mono')">黑白版</button>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function renderMockGrid() {
      const grid = document.getElementById('mock-grid');
      grid.innerHTML = '';
      const isColor = modalStyle === 'color';

      // 32 slots: mix of our generated icons and classic AI placeholders
      const list = ICONS.slice(0, 24); // first 24 letters
      list.forEach(icon => {
        const slot = document.createElement('div');
        slot.className = 'mock-slot';
        slot.innerHTML = isColor ? icon.colorSvg : icon.monoSvg;
        slot.title = \`\${icon.letter} · \${icon.name}\`;
        grid.appendChild(slot);
      });

      // append remaining slots with Y, Z and classic placeholders
      ICONS.slice(24).forEach(icon => {
        const slot = document.createElement('div');
        slot.className = 'mock-slot';
        slot.innerHTML = isColor ? icon.colorSvg : icon.monoSvg;
        grid.appendChild(slot);
      });

      // filler slots to reach 32
      for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'mock-slot';
        slot.innerHTML = \`<svg viewBox="0 0 24 24" fill="none" stroke="\${isColor ? '#6366F1' : '#94A3B8'}" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="4"/><path d="M9 12h6"/></svg>\`;
        grid.appendChild(slot);
      }
    }

    function switchTheme(theme) {
      document.body.className = theme === 'light' ? 'light-theme' : '';
      document.getElementById('btn-dark').classList.toggle('active', theme === 'dark');
      document.getElementById('btn-light').classList.toggle('active', theme === 'light');
    }

    function filterIcons(filter) {
      currentFilter = filter;
      document.getElementById('btn-filter-all').classList.toggle('active', filter === 'all');
      document.getElementById('btn-filter-gn').classList.toggle('active', filter === 'gn');
      renderGrid();
    }

    function switchModalStyle(style) {
      modalStyle = style;
      document.getElementById('btn-modal-color').classList.toggle('active', style === 'color');
      document.getElementById('btn-modal-mono').classList.toggle('active', style === 'mono');
      renderMockGrid();
    }

    function copySVG(letter, variant) {
      const icon = ICONS.find(i => i.letter === letter);
      if (!icon) return;
      const svg = variant === 'color' ? icon.colorSvg : icon.monoSvg;
      navigator.clipboard.writeText(svg).then(() => {
        const toast = document.getElementById('toast');
        toast.innerText = \`已复制【字母 \${letter} - \${variant === 'color' ? '彩色流光版' : '极简黑白版'}】SVG 源码！\`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
      });
    }

    // Init
    const params = new URLSearchParams(window.location.search);
    if (params.get('theme') === 'light') switchTheme('light');
    if (params.get('filter') === 'gn') filterIcons('gn');
    if (params.get('modal') === 'mono') switchModalStyle('mono');

    renderGrid();
    renderMockGrid();
  </script>
</body>
</html>
`.trim();

fs.writeFileSync(path.resolve("ai-alphabet-logos/index.html"), html);
console.log("Successfully compiled ai-alphabet-logos/index.html with full 26-letter suite!");
