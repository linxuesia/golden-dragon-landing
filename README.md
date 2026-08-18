# Golden Dragon Landing

龙主题视觉展示站。3D 龙场景 + 烫金 UI + 玻璃拟态，Three.js + GSAP + Vite 写的。

## 技术栈

- **Three.js** — 3D 龙场景渲染（GLTF 模型）
- **GSAP** — 滚动 + 动画时间线
- **Vite** — 打包
- **SCSS** — 暗色 + 烫金视觉系统

## 本地运行

```bash
# 方式 1：跑源码（需要 node_modules）
npm install
npm run dev          # http://localhost:5173

# 方式 2：跑预构建的 dist
cd dist
python3 -m http.server 8080   # 或 npx serve
```

## Build

```bash
npm run build        # 产物在 dist/
```

## 设计要点

- 暗色背景 `#0a0a0a` + 龙鳞金 `#fbbf24` + 中国红 `#dc2626`
- 玻璃拟态卡片 + 龙纹边框
- 滚动驱动 GSAP 动画（pinning + scrub）
- Three.js GLTF 龙模型 + 实时环境光
- 响应式：桌面 1440 / 平板 768 / 移动 375

## 目录

```
src/        源码（HTML / SCSS / JS）
dist/       预构建静态站（已部署到 GH Pages）
dragon/     3D 龙模型 + 贴图
fonts/      龙品牌字体（longwei-brush, longwei-wordmark）
public/     静态资源
```

## License

MIT
