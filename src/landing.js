// Landing 入口 - 简单 hover/scroll 增强
const hero = document.querySelector('.landing-hero');
if (hero) {
  // 鼠标移动 - 3D 倾斜效果
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    const blobs = hero.querySelectorAll('.lh-blob');
    blobs.forEach((b, i) => {
      const factor = (i + 1) * 12;
      b.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
    });
  });
  hero.addEventListener('mouseleave', () => {
    hero.querySelectorAll('.lh-blob').forEach((b) => {
      b.style.transform = 'translate(0, 0)';
    });
  });
}

// 视频 hover 播放
document.querySelectorAll('.demo-card video').forEach((v) => {
  // 移动端：点击切换
  v.addEventListener('click', (e) => {
    e.preventDefault();
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  });
});

// 平滑滚动 anchor
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
