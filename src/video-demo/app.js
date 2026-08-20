const app = document.querySelector('#app');
const videos = [...document.querySelectorAll('.dragon-video')];
const launchButton = document.querySelector('#launch-button');
const soundButton = document.querySelector('#sound-control');
const retryButton = document.querySelector('#retry-button');
const loadingDetail = document.querySelector('#loading-detail');
const actionLabel = document.querySelector('#action-label');
const actionStep = document.querySelector('#action-step');
const actionProgress = document.querySelector('#action-progress');
const deckState = document.querySelector('#deck-state');
const completionToast = document.querySelector('#completion-toast');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clipLabels = ['入场', '呼吸待机', '腾空', '净化归位'];
const actionIndices = [2, 3];
const mediaBuildVersion = '20260819-3';

let activeIndex = 0;
let phase = 'loading';
let soundEnabled = false;
let transitionLocked = false;
let frameLoopToken = 0;
let completionTimer = 0;

for (const video of videos) {
  const index = Number(video.dataset.video);
  video.loop = index === 1;
  video.src = `${import.meta.env.BASE_URL}${video.dataset.file}?v=${mediaBuildVersion}`;
  video.load();
}

function waitFor(video, eventName, timeout = 12000) {
  if (eventName === 'loadeddata' && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${video.dataset.file}`));
    }, timeout);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(video.error || new Error(`Unable to load ${video.dataset.file}`));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function waitForFirstFrame(video) {
  return new Promise((resolve) => {
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(() => resolve());
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function setPhase(nextPhase) {
  phase = nextPhase;
  app.dataset.phase = nextPhase;
  app.dataset.activeClip = videos[activeIndex]?.dataset.file || '';
}

function setSound(enabled) {
  soundEnabled = enabled;
  videos.forEach((video) => {
    video.muted = !enabled;
    video.volume = enabled ? 0.82 : 0;
  });
  soundButton.setAttribute('aria-pressed', String(enabled));
  soundButton.querySelector('strong').textContent = enabled ? '开' : '关';
}

function showCompletion() {
  window.clearTimeout(completionTimer);
  completionToast.classList.add('is-visible');
  completionTimer = window.setTimeout(() => {
    completionToast.classList.remove('is-visible');
  }, 2400);
}

function updateActionCopy(index) {
  actionStep.textContent = clipLabels[index];
  if (index === 2) actionLabel.textContent = '龙震引擎腾空启动';
  if (index === 3) actionLabel.textContent = '完成净化并返回工作台';
}

function calculateSequenceProgress(index, currentTime) {
  const durations = actionIndices.map((clipIndex) => videos[clipIndex].duration || 1);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const position = actionIndices
    .slice(0, Math.max(0, actionIndices.indexOf(index)))
    .reduce((sum, clipIndex) => sum + (videos[clipIndex].duration || 1), 0);
  return Math.min(1, (position + currentTime) / total);
}

function stopFrameLoop() {
  frameLoopToken += 1;
}

function startFrameLoop(video, index) {
  const token = ++frameLoopToken;

  const tick = () => {
    if (token !== frameLoopToken || activeIndex !== index || phase !== 'action') return;

    const progress = calculateSequenceProgress(index, video.currentTime);
    actionProgress.style.transform = `scaleX(${progress})`;

    if (video.duration && video.duration - video.currentTime < 0.11 && !transitionLocked) {
      const sequencePosition = actionIndices.indexOf(index);
      const nextIndex = actionIndices[sequencePosition + 1];
      if (nextIndex !== undefined) {
        void activateVideo(nextIndex);
        return;
      }
    }

    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(tick);
    } else {
      window.requestAnimationFrame(tick);
    }
  };

  tick();
}

async function activateVideo(nextIndex, { returnToIdle = false, completedAction = false } = {}) {
  if (transitionLocked || nextIndex === activeIndex) return;
  transitionLocked = true;

  const previous = videos[activeIndex];
  const next = videos[nextIndex];

  try {
    await waitFor(next, 'loadeddata');
    next.currentTime = 0;
    next.muted = !soundEnabled;
    const playPromise = next.play();
    await Promise.all([playPromise, waitForFirstFrame(next)]);

    next.classList.add('is-active');
    previous.classList.add('is-leaving');
    previous.classList.remove('is-active');
    activeIndex = nextIndex;
    app.dataset.activeClip = next.dataset.file;
    updateActionCopy(nextIndex);

    window.setTimeout(() => {
      previous.pause();
      previous.classList.remove('is-leaving');
    }, 190);

    if (returnToIdle) {
      stopFrameLoop();
      actionProgress.style.transform = completedAction ? 'scaleX(1)' : 'scaleX(0)';
      setPhase('idle');
      deckState.textContent = completedAction ? '启动完成' : '等待启动';
      launchButton.disabled = false;
      launchButton.querySelector('.launch-button__label').textContent = '启动应用';
      if (completedAction) showCompletion();
    } else {
      startFrameLoop(next, nextIndex);
    }
  } catch (error) {
    console.error(error);
    setPhase('error');
  } finally {
    transitionLocked = false;
  }
}

async function startAction() {
  if (phase !== 'idle' || transitionLocked) return;

  launchButton.disabled = true;
  launchButton.querySelector('.launch-button__label').textContent = '任务运行中';
  deckState.textContent = '正在启动';
  actionProgress.style.transform = 'scaleX(0)';
  setPhase('action');

  if (reduceMotion) {
    window.setTimeout(() => {
      setPhase('idle');
      launchButton.disabled = false;
      launchButton.querySelector('.launch-button__label').textContent = '启动应用';
      deckState.textContent = '启动完成';
      showCompletion();
    }, 600);
    return;
  }

  await activateVideo(2);
}

function onClipEnded(index) {
  if (phase === 'intro' && index === 0 && !transitionLocked) {
    void activateVideo(1, { returnToIdle: true });
    return;
  }

  if (phase !== 'action' || activeIndex !== index || transitionLocked) return;

  const position = actionIndices.indexOf(index);
  const nextIndex = actionIndices[position + 1];

  if (nextIndex !== undefined) {
    void activateVideo(nextIndex);
    return;
  }

  if (index === 3) {
    void activateVideo(1, { returnToIdle: true, completedAction: true });
  }
}

async function boot() {
  try {
    videos.forEach((video, index) => {
      video.pause();
      video.currentTime = 0;
      video.classList.toggle('is-active', index === 0);
      video.classList.remove('is-leaving');
    });
    activeIndex = 0;
    app.dataset.activeClip = videos[0].dataset.file;

    loadingDetail.textContent = '正在预载入场画面';
    await waitFor(videos[0], 'loadeddata');

    const preloadRest = Promise.all(videos.slice(1).map((video) => waitFor(video, 'loadeddata')));

    if (reduceMotion) {
      await preloadRest;
      videos[0].classList.remove('is-active');
      videos[1].classList.add('is-active');
      activeIndex = 1;
      videos[1].currentTime = 0.04;
      setPhase('idle');
      launchButton.disabled = false;
      deckState.textContent = '等待启动';
      return;
    }

    await videos[0].play();
    await waitForFirstFrame(videos[0]);
    setPhase('intro');
    deckState.textContent = '龙震入场';
    void preloadRest;
  } catch (error) {
    console.error(error);
    setPhase('error');
  }
}

videos.forEach((video, index) => {
  video.addEventListener('ended', () => onClipEnded(index));
});

launchButton.addEventListener('click', () => void startAction());
soundButton.addEventListener('click', () => setSound(!soundEnabled));
retryButton.addEventListener('click', () => window.location.reload());

void boot();
