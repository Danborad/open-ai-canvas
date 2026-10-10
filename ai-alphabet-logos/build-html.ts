import fs from 'fs';
import path from 'path';
import { letters } from './generate-logos';

function buildHTML() {
  const root = path.resolve(__dirname);
  const colorDir = path.join(root, 'svg', 'color');
  const monoDir = path.join(root, 'svg', 'monochrome');

  const letterData = letters.map(item => {
    const colorSvg = fs.readFileSync(path.join(colorDir, `${item.letter}.svg`), 'utf-8');
    const monoSvg = fs.readFileSync(path.join(monoDir, `${item.letter}.svg`), 'utf-8');
    return {
      letter: item.letter,
      name: item.name,
      desc: item.desc,
      colorSvg,
      monoSvg
    };
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 无衬线科技品牌字母图标系统 (A - Z)</title>
  <style>
    :root {
      --bg-page: #0A0D14;
      --bg-card: #121520;
      --border-card: #1E2333;
      --border-card-active: #6366F1;
      --bg-box: #171B28;
      --border-box: #242A3D;
      --text-main: #FFFFFF;
      --text-sub: #94A3B8;
      --btn-bg: #1B2030;
      --btn-border: #2A3147;
      --btn-hover: #2E364F;
    }

    body.light-theme {
      --bg-page: #F3F5F9;
      --bg-card: #FFFFFF;
      --border-card: #E2E8F0;
      --border-card-active: #4F46E5;
      --bg-box: #F8FAFC;
      --border-box: #CBD5E1;
      --text-main: #0F172A;
      --text-sub: #64748B;
      --btn-bg: #F1F5F9;
      --btn-border: #E2E8F0;
      --btn-hover: #E2E8F0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      min-height: 100vh;
      padding: 44px 24px 80px;
      transition: background-color 0.25s, color 0.25s;
    }

    .container {
      max-width: 1280px;
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
      padding: 5px 14px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #818CF8;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #FFFFFF 30%, #94A3B8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    body.light-theme h1 {
      background: linear-gradient(135deg, #0F172A 30%, #475569 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p.lead {
      font-size: 15px;
      color: var(--text-sub);
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Controls Bar */
    .controls {
      display: flex;
      justify-content: center;
      gap: 16px;
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

    .theme-btn {
      background: transparent;
      border: none;
      color: var(--text-sub);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .theme-btn:hover {
      color: var(--text-main);
    }

    .theme-btn.active {
      background: #4F46E5;
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
    }

    /* Section Header */
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title::before {
      content: "";
      width: 4px;
      height: 18px;
      background: #6366F1;
      border-radius: 2px;
    }

    /* Cards Grid */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
      gap: 18px;
      margin-bottom: 56px;
    }

    /* Tech Sans Card - Matching user reference */
    .tech-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    }

    .tech-card:hover {
      transform: translateY(-3px);
      border-color: #6366F1;
      box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.4);
    }

    .tech-card.highlight {
      border: 1.5px solid #6366F1;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
    }

    .letter-pill {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: rgba(99, 102, 241, 0.2);
      color: #A5B4FC;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(99, 102, 241, 0.35);
    }

    .dual-preview-row {
      display: flex;
      gap: 12px;
      width: 100%;
      justify-content: center;
      margin-top: 14px;
      margin-bottom: 18px;
    }

    .preview-box {
      flex: 1;
      aspect-ratio: 1;
      max-width: 105px;
      border-radius: 18px;
      background: var(--bg-box);
      border: 1px solid var(--border-box);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      transition: all 0.15s;
    }

    .preview-box:hover {
      border-color: #6366F1;
    }

    .preview-box svg {
      width: 62px;
      height: 62px;
      transition: transform 0.2s ease;
    }

    .preview-box:hover svg {
      transform: scale(1.08);
    }

    .box-label {
      position: absolute;
      bottom: 6px;
      font-size: 8px;
      font-weight: 700;
      color: var(--text-sub);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      opacity: 0.7;
    }

    .card-title {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
      text-align: center;
      color: var(--text-main);
    }

    .card-desc {
      font-size: 12.5px;
      color: var(--text-sub);
      line-height: 1.5;
      text-align: center;
      margin-bottom: 18px;
      min-height: 38px;
    }

    .action-row {
      display: flex;
      gap: 8px;
      width: 100%;
      margin-top: auto;
    }

    .action-btn {
      flex: 1;
      padding: 9px 0;
      font-size: 12px;
      font-weight: 600;
      border-radius: 10px;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--text-main);
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }

    .action-btn:hover {
      background: var(--btn-hover);
      border-color: #6366F1;
      color: #818CF8;
    }

    /* Modal Simulation */
    .mock-modal-section {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 24px;
      padding: 32px 24px;
      margin-bottom: 56px;
    }

    .mock-modal {
      background: #141722;
      border: 1px solid #222738;
      border-radius: 18px;
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    }

    .mock-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 16px;
      font-weight: 700;
      color: #FFFFFF;
    }

    .mock-search {
      width: 100%;
      background: #1A1E2B;
      border: 1px solid #2A3145;
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--text-sub);
      font-size: 13px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mock-icon-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 8px;
      padding-bottom: 18px;
    }

    .mock-slot {
      aspect-ratio: 1;
      background: #1A1E2B;
      border: 1px solid #2A3145;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .mock-slot:hover {
      border-color: #6366F1;
      background: rgba(99, 102, 241, 0.15);
      transform: scale(1.06);
    }

    .mock-slot svg {
      width: 26px;
      height: 26px;
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
        <span>⚡</span> TECH SANS-SERIF AI MONOGRAM SYSTEM
      </div>
      <h1>AI 科技无衬线品牌字母图标系统</h1>
      <p class="lead">
        采用加粗几何无衬线体（Geometric Sans-Serif），纯正直角平切与平直悬浮横梁，搭配高聚能微核心光点，极具科技与工业质感。
      </p>
    </header>

    <!-- Controls -->
    <div class="controls">
      <div class="btn-group">
        <button class="theme-btn active" id="btn-theme-dark" onclick="switchTheme('dark')">🌙 暗夜黑 (Dark UI)</button>
        <button class="theme-btn" id="btn-theme-light" onclick="switchTheme('light')">☀️ 极简白 (Light UI)</button>
      </div>
    </div>

    <!-- Section 1: All 26 Letters Showcase -->
    <div class="section-title">26 个科技无衬线字母图标展台（A ~ Z）</div>
    <div class="cards-grid" id="cards-grid">
      <!-- 26 cards injected by JS -->
    </div>

    <!-- Section 2: Mock Modal (Restoring User Image Context) -->
    <div class="section-title">真实 UI 场景验证 · 放入“选择模型 Logo”对话框</div>
    <div class="mock-modal-section">
      <div class="mock-modal">
        <div class="mock-modal-header">
          <span>选择模型 Logo</span>
          <span style="color: var(--text-sub); cursor: pointer;">✕</span>
        </div>
        <div class="mock-search">
          <span>🔍</span>
          <span>搜索品牌或模型名称 (如 OpenAI, Claude, Google, G-AI, Nexus...)...</span>
        </div>
        <div class="mock-icon-grid" id="modal-grid">
          <!-- 32 slots generated by JS -->
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-sub); margin-top: 12px;">
          <span>共 321 个可用 Logo (26 字母科技无衬线体)</span>
          <div style="display: flex; gap: 8px;">
            <button style="background: #1A1E2B; border: 1px solid #2A3145; color: #FFFFFF; padding: 5px 12px; border-radius: 6px; cursor: pointer;">清除 Logo</button>
            <button style="background: #4F46E5; border: none; color: #FFFFFF; padding: 5px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">完成</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <div id="toast">已复制 SVG 源码到剪贴板！</div>

  <script>
    const alphabetData = ${JSON.stringify(letterData)};

    function initCards() {
      const grid = document.getElementById('cards-grid');
      grid.innerHTML = '';

      alphabetData.forEach(item => {
        const isHighlight = item.letter === 'G' || item.letter === 'H';
        const card = document.createElement('div');
        card.className = 'tech-card' + (isHighlight ? ' highlight' : '');

        card.innerHTML = \`
          <div class="letter-pill">\${item.letter}</div>
          <div class="dual-preview-row">
            <div class="preview-box">
              \${item.colorSvg}
              <span class="box-label">COLOR</span>
            </div>
            <div class="preview-box">
              \${item.monoSvg}
              <span class="box-label">B & W</span>
            </div>
          </div>
          <div class="card-title">\${item.letter} · \${item.name}</div>
          <div class="card-desc">\${item.desc}</div>
          <div class="action-row">
            <button class="action-btn" onclick="copySVG('\${item.letter}', 'color')">彩色版</button>
            <button class="action-btn" onclick="copySVG('\${item.letter}', 'mono')">黑白版</button>
          </div>
        \`;
        grid.appendChild(card);
      });

      renderModalGrid();
    }

    function switchTheme(theme) {
      document.body.className = theme === 'light' ? 'light-theme' : '';
      document.getElementById('btn-theme-dark').classList.toggle('active', theme === 'dark');
      document.getElementById('btn-theme-light').classList.toggle('active', theme === 'light');
    }

    function renderModalGrid() {
      const grid = document.getElementById('modal-grid');
      grid.innerHTML = '';

      const topLogos = [
        { type: 'openai' },
        { type: 'anthropic' },
        { type: 'meta' },
        { type: 'google' }
      ];

      topLogos.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'mock-slot';
        if (item.type === 'openai') {
          slot.innerHTML = \`<svg viewBox="0 0 24 24" fill="none" stroke="#10A37F" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg>\`;
        } else if (item.type === 'anthropic') {
          slot.innerHTML = \`<svg viewBox="0 0 24 24" fill="#D97706"><polygon points="12,4 4,20 20,20"/></svg>\`;
        } else if (item.type === 'meta') {
          slot.innerHTML = \`<svg viewBox="0 0 24 24" fill="#0081FB"><path d="M12 13c-2-3-4-5-7-5a5 5 0 000 10c3 0 5-2 7-5 2 3 4 5 7 5a5 5 0 000-10c-3 0-5 2-7 5z"/></svg>\`;
        } else if (item.type === 'google') {
          slot.innerHTML = \`<svg viewBox="0 0 24 24" fill="#EA4335"><circle cx="12" cy="7" r="7"/></svg>\`;
        }
        grid.appendChild(slot);
      });

      alphabetData.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'mock-slot';
        slot.innerHTML = item.colorSvg;
        grid.appendChild(slot);
      });
    }

    function copySVG(letter, variant) {
      const item = alphabetData.find(x => x.letter === letter);
      if (!item) return;
      const code = variant === 'color' ? item.colorSvg : item.monoSvg;
      navigator.clipboard.writeText(code).then(() => {
        const toast = document.getElementById('toast');
        toast.innerText = \`已复制【\${item.letter} · \${item.name} - \${variant === 'color' ? '彩色版' : '黑白版'}】SVG 代码！\`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
      });
    }

    initCards();
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(root, 'index.html'), html, 'utf-8');
  console.log('Rebuilt index.html in Tech Sans-Serif style!');
}

buildHTML();
