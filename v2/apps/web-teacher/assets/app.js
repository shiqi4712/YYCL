(function () {
  const storageKey = 'yycl_v2_teacher_token';
  const scenes = [
    { id: 'pre', title: '课前进线', desc: '用户刚进线或预约体验前，重点解决信任、时间、孩子适配和到课意愿。', tone: '轻解释，重确认' },
    { id: 'mid', title: '课中推进', desc: '体验课进行中或刚结束，重点推动家长理解孩子表现和课程价值。', tone: '多观察，少催促' },
    { id: 'close', title: '结转促单', desc: '结转报名阶段，重点处理价格、犹豫、对比、决策人和付款节奏。', tone: '给证据，给下一步' },
  ];

  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    view: 'portal',
    selectedScene: '',
    objections: [],
    selectedObjectionId: '',
  };

  const nodes = {
    authScreen: document.getElementById('teacherAuthScreen'),
    workspace: document.getElementById('teacherWorkspace'),
    headerTitle: document.getElementById('teacherHeaderTitle'),
    hero: document.getElementById('teacherHero'),
    loginForm: document.getElementById('teacherLoginForm'),
    loginStatus: document.getElementById('teacherLoginStatus'),
    profileChip: document.getElementById('teacherProfileChip'),
    portalView: document.getElementById('portalView'),
    repositoryHomeView: document.getElementById('repositoryHomeView'),
    repositoryDetailView: document.getElementById('repositoryDetailView'),
    trainingView: document.getElementById('trainingView'),
    sceneList: document.getElementById('teacherSceneList'),
    objectionTitle: document.getElementById('teacherObjectionTitle'),
    searchInput: document.getElementById('teacherSearchInput'),
    resultCount: document.getElementById('teacherResultCount'),
    objectionList: document.getElementById('teacherObjectionList'),
    detailPanel: document.getElementById('teacherDetailPanel'),
    backButton: document.getElementById('teacherBackButton'),
    backToScenesButton: document.getElementById('teacherBackToScenesButton'),
    refreshButton: document.getElementById('teacherRefreshButton'),
    logoutButton: document.getElementById('teacherLogoutButton'),
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return map[char];
    });
  }

  function renderEmptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function setToken(token) {
    state.token = token;
    if (token) {
      localStorage.setItem(storageKey, token);
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  function toggleApp(isAuthed) {
    nodes.authScreen.classList.toggle('hidden', isAuthed);
    nodes.workspace.classList.toggle('hidden', !isAuthed);
    if (!isAuthed) {
      nodes.loginForm.reset();
    }
  }

  async function api(path, options) {
    const request = options || {};
    const headers = {
      'Content-Type': 'application/json',
      ...(request.headers || {}),
    };

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
      ...request,
      headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.message || '请求失败，请稍后重试');
    }

    return payload.data;
  }

  function sceneName(sceneId) {
    return scenes.find((scene) => scene.id === sceneId)?.title || sceneId;
  }

  function selectedObjection() {
    return state.objections.find((item) => item.id === state.selectedObjectionId) || null;
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(String(url || ''));
  }

  function isImageMaterial(material) {
    const type = String(material?.type || '').toUpperCase();
    const url = String(material?.url || '');
    return type === 'IMAGE' || url.startsWith('/uploads/materials/') || isImageUrl(url);
  }

  function normalizeScript(script) {
    if (typeof script === 'string') {
      const text = script.trim();
      return text ? { text, materials: [] } : null;
    }
    if (!script || typeof script !== 'object') return null;
    const text = String(script.text || '').trim();
    if (!text) return null;
    const materials = Array.isArray(script.materials)
      ? script.materials.filter((material) => material && material.title && material.url)
      : [];
    return { text, materials };
  }

  function renderMaterialCards(materials) {
    if (!materials.length) return '';
    return `
      <div class="script-materials">
        <p class="eyebrow">Materials</p>
        <div class="material-grid">
          ${materials
            .map(
              (material) => `
                <article class="material-card">
                  ${
                    isImageMaterial(material)
                      ? `<img src="${escapeHtml(material.url)}" alt="${escapeHtml(material.title)}" loading="lazy" />`
                      : `<div class="material-file">物</div>`
                  }
                  <div>
                    <h3>${escapeHtml(material.title)}</h3>
                    <p>${escapeHtml(material.description || '可配合当前话术发给家长。')}</p>
                    <div class="inline-actions">
                      <a class="secondary-btn compact-btn" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">打开物料</a>
                      <button class="secondary-btn compact-btn" type="button" data-copy="${escapeHtml(material.url)}" data-copy-label="复制链接">复制链接</button>
                    </div>
                  </div>
                </article>
              `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function setView(view) {
    state.view = view;
    nodes.portalView.classList.toggle('hidden', view !== 'portal');
    nodes.repositoryHomeView.classList.toggle('hidden', view !== 'repository');
    nodes.repositoryDetailView.classList.toggle('hidden', view !== 'repositoryDetail');
    nodes.trainingView.classList.toggle('hidden', view !== 'training');
    nodes.hero.classList.toggle('hidden', view === 'repositoryDetail');
    nodes.backButton.classList.toggle('hidden', view === 'portal');
    const titleMap = {
      portal: '功能首页',
      repository: '异议处理仓库',
      repositoryDetail: sceneName(state.selectedScene),
      training: '异议处理训练',
    };
    nodes.headerTitle.textContent = titleMap[view] || '功能首页';
  }

  function renderScenes() {
    nodes.sceneList.innerHTML = scenes
      .map(
        (scene) => `
          <button class="scene-card" type="button" data-scene="${escapeHtml(scene.id)}">
            <p class="eyebrow">${escapeHtml(scene.tone)}</p>
            <h3>${escapeHtml(scene.title)}</h3>
            <p>${escapeHtml(scene.desc)}</p>
            <div class="tag-row">
              <span class="tag">进入场景</span>
            </div>
          </button>
        `
      )
      .join('');

    nodes.sceneList.querySelectorAll('[data-scene]').forEach((button) => {
      button.addEventListener('click', async () => {
        state.selectedScene = button.getAttribute('data-scene') || 'pre';
        state.searchKeyword = '';
        nodes.searchInput.value = '';
        await loadObjections();
        setView('repositoryDetail');
      });
    });
  }

  async function loadObjections() {
    if (!state.selectedScene) return;
    const keyword = nodes.searchInput.value.trim();
    const params = new URLSearchParams({ scene: state.selectedScene });
    if (keyword) params.set('keyword', keyword);
    state.objections = await api(`/api/objections?${params.toString()}`);
    state.selectedObjectionId = state.objections[0]?.id || '';
    renderObjections();
    renderDetail();
  }

  function renderObjections() {
    nodes.objectionTitle.textContent = `${sceneName(state.selectedScene)}异议问题`;
    nodes.resultCount.textContent = `${state.objections.length} 条`;

    if (!state.objections.length) {
      nodes.objectionList.innerHTML = renderEmptyState('当前场景暂无上架异议，请联系管理员先录入内容。');
      nodes.detailPanel.innerHTML = '';
      return;
    }

    nodes.objectionList.innerHTML = state.objections
      .map(
        (item) => `
          <button class="objection-card ${item.id === state.selectedObjectionId ? 'active' : ''}" type="button" data-objection="${escapeHtml(item.id)}">
            <p class="eyebrow">${escapeHtml(sceneName(item.scene))}</p>
            <h3>${escapeHtml(item.title)}</h3>
            ${item.concern ? `<p>${escapeHtml(item.concern)}</p>` : ''}
            <div class="tag-row">
              ${(item.keywords || []).map((keyword) => `<span class="tag-warn">${escapeHtml(keyword)}</span>`).join('')}
            </div>
          </button>
        `
      )
      .join('');

    nodes.objectionList.querySelectorAll('[data-objection]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedObjectionId = button.getAttribute('data-objection') || '';
        renderObjections();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const item = selectedObjection();
    if (!item) return;

    nodes.detailPanel.innerHTML = `
      <article class="detail-hero">
        <p class="eyebrow">${escapeHtml(sceneName(item.scene))}</p>
        <h2>${escapeHtml(item.title)}</h2>
        ${item.concern ? `<p>${escapeHtml(item.concern)}</p>` : ''}
      </article>

      ${
        (item.thinking || []).length
          ? `
            <div class="flow-list">
              ${(item.thinking || [])
                .map(
                  (step, index) => `
                    <article class="flow-card">
                      <span class="step-num">${index + 1}</span>
                      <div>
                        <h3>${index === 0 ? '先接住' : index === 1 ? '再解释' : '给下一步'}</h3>
                        <p>${escapeHtml(step)}</p>
                      </div>
                    </article>
                  `
                )
                .join('')}
            </div>
          `
          : ''
      }

      ${
        (item.scripts || []).map(normalizeScript).filter(Boolean).length
          ? `
            <div class="script-list">
              ${(item.scripts || [])
                .map(normalizeScript)
                .filter(Boolean)
                .map(
                  (script, index) => `
                    <article class="script-card">
                      <h3>话术 ${index + 1}</h3>
                      <p>${escapeHtml(script.text)}</p>
                      ${renderMaterialCards((script.materials || []).length ? script.materials : index === 0 ? item.materials || [] : [])}
                      <button class="secondary-btn compact-btn" type="button" data-copy="${escapeHtml(script.text)}" data-copy-label="复制话术">复制话术</button>
                    </article>
                  `
                )
                .join('')}
            </div>
          `
          : ''
      }

      ${
        (item.materials || []).length && !(item.scripts || []).map(normalizeScript).filter(Boolean).length
          ? `
            <section class="material-section">
              <p class="eyebrow">Materials</p>
              <h2>话术配套物料</h2>
              <div class="material-grid">
                ${(item.materials || [])
                  .map(
                    (material) => `
                      <article class="material-card">
                        ${
                          isImageMaterial(material)
                            ? `<img src="${escapeHtml(material.url)}" alt="${escapeHtml(material.title)}" loading="lazy" />`
                            : `<div class="material-file">物</div>`
                        }
                        <div>
                          <h3>${escapeHtml(material.title)}</h3>
                          <p>${escapeHtml(material.description || '可配合当前话术发给家长。')}</p>
                          <div class="inline-actions">
                            <a class="secondary-btn compact-btn" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">打开物料</a>
                            <button class="secondary-btn compact-btn" type="button" data-copy="${escapeHtml(material.url)}" data-copy-label="复制链接">复制链接</button>
                          </div>
                        </div>
                      </article>
                    `
                  )
                  .join('')}
              </div>
            </section>
          `
          : ''
      }

      ${
        item.avoid
          ? `
            <article class="script-card">
              <h3>禁忌提醒</h3>
              <p>${escapeHtml(item.avoid)}</p>
              <span class="tag-danger">不要这样说</span>
            </article>
          `
          : ''
      }
    `;

    nodes.detailPanel.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        const text = button.getAttribute('data-copy') || '';
        const label = button.getAttribute('data-copy-label') || '复制';
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = '已复制';
          window.setTimeout(() => {
            button.textContent = label;
          }, 1400);
        } catch {
          alert('当前浏览器不支持自动复制，请手动选中文本复制。');
        }
      });
    });
  }

  async function loadProfile() {
    state.profile = await api('/api/auth/me');
    nodes.profileChip.textContent = `${state.profile.displayName || state.profile.username} · ${
      state.profile.role === 'TRAINER' ? '管理员' : '老师'
    }`;
  }

  async function refreshCurrentView() {
    if (state.view === 'repositoryDetail') {
      await loadObjections();
    } else {
      renderScenes();
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    nodes.loginStatus.textContent = '正在登录...';
    const formData = new FormData(nodes.loginForm);

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: String(formData.get('username') || ''),
          password: String(formData.get('password') || ''),
        }),
      });

      setToken(result.token);
      toggleApp(true);
      await loadProfile();
      renderScenes();
      setView('portal');
      nodes.loginStatus.textContent = '';
    } catch (error) {
      nodes.loginStatus.textContent = error.message;
    }
  }

  async function bootstrap() {
    nodes.loginForm.addEventListener('submit', handleLogin);
    nodes.logoutButton.addEventListener('click', () => {
      setToken('');
      state.profile = null;
      state.objections = [];
      state.selectedScene = '';
      state.selectedObjectionId = '';
      toggleApp(false);
      setView('portal');
    });
    nodes.refreshButton.addEventListener('click', refreshCurrentView);
    nodes.backButton.addEventListener('click', () => {
      if (state.view === 'repositoryDetail') {
        setView('repository');
        return;
      }
      setView('portal');
    });
    nodes.backToScenesButton.addEventListener('click', () => setView('repository'));
    nodes.searchInput.addEventListener('input', () => {
      window.clearTimeout(nodes.searchInput.timer);
      nodes.searchInput.timer = window.setTimeout(loadObjections, 220);
    });
    document.querySelectorAll('[data-entry]').forEach((button) => {
      button.addEventListener('click', async () => {
        const entry = button.getAttribute('data-entry');
        if (entry === 'repository') {
          setView('repository');
          renderScenes();
          return;
        }
        setView('training');
      });
    });

    if (!state.token) {
      toggleApp(false);
      setView('portal');
      return;
    }

    try {
      toggleApp(true);
      await loadProfile();
      renderScenes();
      setView('portal');
    } catch (error) {
      console.error(error);
      setToken('');
      toggleApp(false);
      setView('portal');
    }
  }

  bootstrap();
})();
