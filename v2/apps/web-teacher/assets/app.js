(function () {
  const storageKey = 'yycl_v2_teacher_token';
  const internalAccountLoginUrl = 'https://internal-account.codemao.cn/login';
  const internalAccountInfoUrl = 'https://internal-account-api.codemao.cn/auth/info';
  const scenes = [
    { id: 'pre', title: '课前进线', desc: '用户刚进线或预约体验前，重点解决信任、时间、孩子适配和到课意愿。', tone: '轻解释，重确认' },
    { id: 'mid', title: '课中推进', desc: '体验课进行中或刚结束，重点推动家长理解孩子表现和课程价值。', tone: '多观察，少催促' },
    { id: 'close', title: '结转促单', desc: '结转报名阶段，重点处理价格、犹豫、对比、决策人和付款节奏。', tone: '给证据，给下一步' },
  ];

  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    internalAccountUser: null,
    internalAccountStatus: 'checking',
    view: 'portal',
    selectedScene: '',
    objections: [],
    selectedObjectionId: '',
    training: {
      topics: [],
      selectedScenario: null,
      sessionId: '',
      messages: [],
      pendingTeacherCount: 0,
      replyTimer: null,
      replyDueAt: 0,
      replyInFlight: false,
      review: null,
      sessions: [],
      selectedHistorySessionId: '',
    },
  };

  const nodes = {
    authScreen: document.getElementById('teacherAuthScreen'),
    workspace: document.getElementById('teacherWorkspace'),
    headerTitle: document.getElementById('teacherHeaderTitle'),
    hero: document.getElementById('teacherHero'),
    loginForm: document.getElementById('teacherLoginForm'),
    loginStatus: document.getElementById('teacherLoginStatus'),
    internalLoginButton: document.getElementById('teacherInternalLoginButton'),
    internalLoginStatus: document.getElementById('teacherInternalLoginStatus'),
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
    trainingPicker: document.getElementById('trainingPicker'),
    trainingScenarioList: document.getElementById('trainingScenarioList'),
    trainingLoadStatus: document.getElementById('trainingLoadStatus'),
    trainingChat: document.getElementById('trainingChat'),
    trainingScenarioTitle: document.getElementById('trainingScenarioTitle'),
    trainingContextList: document.getElementById('trainingContextList'),
    trainingContextPanel: document.getElementById('trainingContextPanel'),
    trainingContextToggle: document.getElementById('trainingContextToggle'),
    trainingBackButton: document.getElementById('trainingBackButton'),
    trainingEndButton: document.getElementById('trainingEndButton'),
    trainingStatusChip: document.getElementById('trainingStatusChip'),
    trainingMessageList: document.getElementById('trainingMessageList'),
    trainingReplyWait: document.getElementById('trainingReplyWait'),
    trainingMessageForm: document.getElementById('trainingMessageForm'),
    trainingMessageInput: document.getElementById('trainingMessageInput'),
    trainingForceReplyButton: document.getElementById('trainingForceReplyButton'),
    trainingSubmitButton: document.getElementById('trainingSubmitButton'),
    trainingReviewPanel: document.getElementById('trainingReviewPanel'),
    trainingReviewScore: document.getElementById('trainingReviewScore'),
    trainingReviewContent: document.getElementById('trainingReviewContent'),
    trainingHistoryList: document.getElementById('trainingHistoryList'),
    trainingHistoryDetail: document.getElementById('trainingHistoryDetail'),
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

  function formatDateTime(value) {
    if (!value) return '暂无时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无时间';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(
      date.getHours()
    ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

  function setupInternalAccountLogin() {
    nodes.internalLoginButton.addEventListener('click', () => {
      if (state.internalAccountStatus === 'logged-out') {
        window.location.assign(internalAccountLoginUrl);
        return;
      }
      checkInternalAccount();
    });
  }

  function renderInternalAccountStatus() {
    const status = state.internalAccountStatus;
    nodes.internalLoginButton.disabled = status === 'checking' || status === 'authenticated';

    if (status === 'checking') {
      nodes.internalLoginButton.textContent = '确认中';
      nodes.internalLoginStatus.textContent = '正在确认内部账号...';
      return;
    }
    if (status === 'authenticated') {
      nodes.internalLoginButton.textContent = '已登录';
      nodes.internalLoginStatus.textContent = `已识别老师：${state.internalAccountUser.fullname}`;
      return;
    }
    if (status === 'logged-out') {
      nodes.internalLoginButton.textContent = '去登录';
      nodes.internalLoginStatus.textContent = '请先登录后继续';
      return;
    }

    nodes.internalLoginButton.textContent = '重试';
    nodes.internalLoginStatus.textContent = '暂时无法确认登录状态，请稍后重试';
  }

  async function checkInternalAccount() {
    state.internalAccountStatus = 'checking';
    state.internalAccountUser = null;
    renderInternalAccountStatus();
    console.info('Checking internal account login status', { endpoint: internalAccountInfoUrl });

    try {
      const response = await fetch(internalAccountInfoUrl, { credentials: 'include' });
      console.info('Checked internal account login status', { status: response.status });

      if (response.status === 401) {
        state.internalAccountStatus = 'logged-out';
        renderInternalAccountStatus();
        return null;
      }
      if (!response.ok) {
        throw new Error('internal_account_status_failed');
      }

      const payload = await response.json();
      const fullname = String(payload.fullname || '').trim();
      if (!fullname) {
        throw new Error('internal_account_name_missing');
      }

      state.internalAccountUser = { fullname };
      state.internalAccountStatus = 'authenticated';
      renderInternalAccountStatus();
      return state.internalAccountUser;
    } catch (error) {
      state.internalAccountStatus = 'error';
      renderInternalAccountStatus();
      return null;
    }
  }

  function networkErrorMessage() {
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || window.location.protocol === 'file:';
    return isLocal
      ? '本地请求失败。请确认服务已启动；如需访问内部域名，请使用专用调试 Chrome，并确保登录页和本页面使用同一浏览器 Profile。'
      : '网络请求失败，请检查网络后重试。';
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

    let response;
    try {
      response = await fetch(path, {
        ...request,
        headers,
      });
    } catch {
      throw new Error(networkErrorMessage());
    }

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
    nodes.hero.classList.toggle('hidden', view === 'repositoryDetail' || view === 'training');
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

  function resetTrainingRuntime() {
    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
    }
    state.training.sessionId = '';
    state.training.selectedScenario = null;
    state.training.messages = [];
    state.training.pendingTeacherCount = 0;
    state.training.replyTimer = null;
    state.training.replyDueAt = 0;
    state.training.replyInFlight = false;
    state.training.review = null;
    if (nodes.trainingMessageInput) {
      nodes.trainingMessageInput.value = '';
    }
    nodes.trainingContextPanel.classList.add('mobile-collapsed');
    nodes.trainingContextToggle.textContent = '查看训练信息';
    nodes.trainingContextToggle.setAttribute('aria-expanded', 'false');
  }

  function flattenTrainingScenarios() {
    return state.training.topics.flatMap((topic) =>
      (topic.scenarios || []).map((scenario) => ({
        ...scenario,
        topicTitle: topic.title,
        topicDescription: topic.description,
        sopConfigured: topic.sopConfigured,
      }))
    );
  }

  function renderTrainingPicker() {
    const topics = state.training.topics.filter((topic) => (topic.scenarios || []).length);
    nodes.trainingPicker.classList.remove('hidden');
    nodes.trainingChat.classList.add('hidden');
    nodes.trainingReviewPanel.classList.add('hidden');

    if (!topics.length) {
      nodes.trainingScenarioList.innerHTML = renderEmptyState('当前暂无可训练场景，请管理员先在后台录入训练主题和场景。');
      return;
    }

    nodes.trainingScenarioList.innerHTML = topics
      .map(
        (topic) => `
          <section class="training-topic-group">
            <div class="training-topic-summary">
              <div>
                <p class="eyebrow">训练主题</p>
                <h3>${escapeHtml(topic.title || '未命名主题')}</h3>
                ${topic.description ? `<p>${escapeHtml(topic.description)}</p>` : ''}
              </div>
              <span class="tag">${escapeHtml((topic.scenarios || []).length)} 个场景</span>
            </div>
            <div class="training-scenario-grid">
              ${(topic.scenarios || [])
                .map(
                  (scenario, index) => `
                    <button class="training-scenario-card" type="button" data-training-scenario="${escapeHtml(scenario.id)}">
                      <span class="scenario-index">${String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <h3>${escapeHtml(scenario.title)}</h3>
                        <p>${escapeHtml(scenario.description)}</p>
                      </div>
                      <div class="scenario-meta">
                        <span>${escapeHtml(scenario.difficulty || '标准')}</span>
                        <span>${topic.sopConfigured ? '已配置' : '待完善'}</span>
                      </div>
                    </button>
                  `
                )
                .join('')}
            </div>
          </section>
        `
      )
      .join('');

    nodes.trainingScenarioList.querySelectorAll('[data-training-scenario]').forEach((button) => {
      button.addEventListener('click', async () => {
        const scenarioId = button.getAttribute('data-training-scenario') || '';
        button.disabled = true;
        try {
          await startTrainingScenario(scenarioId);
        } catch (error) {
          nodes.trainingLoadStatus.textContent = error.message || '暂时无法开始训练，请稍后再试';
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function renderTrainingHistory() {
    const reviewedSessions = (state.training.sessions || []).filter((session) => session.reviewGenerated);

    if (!reviewedSessions.length) {
      nodes.trainingHistoryList.innerHTML = renderEmptyState('提交训练后，这里会保存你的复盘记录。');
      nodes.trainingHistoryDetail.innerHTML = renderEmptyState('选择一条复盘记录，查看本次训练的提升建议。');
      return;
    }

    nodes.trainingHistoryList.innerHTML = reviewedSessions
      .map(
        (session) => `
          <button class="training-history-card ${
            session.id === state.training.selectedHistorySessionId ? 'active' : ''
          }" type="button" data-history-session="${escapeHtml(session.id)}">
            <div>
              <p class="eyebrow">${escapeHtml(formatDateTime(session.endedAt || session.startedAt))}</p>
              <h3>${escapeHtml(session.scenario?.title || '未命名训练')}</h3>
              <p>${escapeHtml(session.summary || '点击查看本次提升建议。')}</p>
            </div>
            <span>${typeof session.reviewScore === 'number' ? `${session.reviewScore} 分` : '查看'}</span>
          </button>
        `
      )
      .join('');

    nodes.trainingHistoryList.querySelectorAll('[data-history-session]').forEach((button) => {
      button.addEventListener('click', async () => {
        await loadTrainingReviewDetail(button.getAttribute('data-history-session') || '');
      });
    });

    if (!state.training.selectedHistorySessionId) {
      nodes.trainingHistoryDetail.innerHTML = renderEmptyState('选择一条复盘记录，查看本次训练的提升建议。');
    }
  }

  async function loadTeacherTrainingSessions() {
    state.training.sessions = await api('/api/training/sessions');
    renderTrainingHistory();
  }

  async function loadTrainingTopics() {
    nodes.trainingLoadStatus.textContent = '正在加载训练场景...';
    const [topics] = await Promise.all([api('/api/topics'), loadTeacherTrainingSessions()]);
    state.training.topics = topics;
    nodes.trainingLoadStatus.textContent = '';
    renderTrainingPicker();
  }

  function renderTrainingContext() {
    const scenario = state.training.selectedScenario;
    if (!scenario) return;

    nodes.trainingScenarioTitle.textContent = scenario.title;
    nodes.trainingContextList.innerHTML = `
      <article class="context-card">
        <p class="eyebrow">家长情况 / 学生情况</p>
        <p>${escapeHtml(scenario.parentPersona || '管理员暂未填写家长与学生情况。')}</p>
      </article>
      <article class="context-card">
        <p class="eyebrow">异议场景</p>
        <p>${escapeHtml(scenario.description || '管理员暂未填写场景说明。')}</p>
      </article>
    `;
  }

  function normalizeTrainingMessage(message) {
    return {
      id: message.id || `${message.role}-${Date.now()}-${Math.random()}`,
      role: message.role === 'ai' || message.role === 'AI' ? 'ai' : 'teacher',
      content: message.content || '',
      stepOrder: message.stepOrder || 1,
      createdAt: message.createdAt || new Date().toISOString(),
    };
  }

  function renderTrainingMessages() {
    if (!state.training.messages.length) {
      nodes.trainingMessageList.innerHTML = renderEmptyState('训练开始后，家长会先发来第一条消息。');
      return;
    }

    nodes.trainingMessageList.innerHTML = state.training.messages
      .map(
        (message) => `
          <article class="chat-bubble ${message.role === 'teacher' ? 'teacher-bubble' : 'parent-bubble'}">
            <span>${message.role === 'teacher' ? '老师' : '家长'}</span>
            <p>${escapeHtml(message.content).replace(/\n/g, '<br />')}</p>
          </article>
        `
      )
      .join('');
    nodes.trainingMessageList.scrollTop = nodes.trainingMessageList.scrollHeight;
  }

  function setReplyWait(message) {
    if (!message) {
      nodes.trainingReplyWait.classList.add('hidden');
      nodes.trainingReplyWait.textContent = '';
      return;
    }
    nodes.trainingReplyWait.classList.remove('hidden');
    nodes.trainingReplyWait.textContent = message;
  }

  function calculateReplyDelay(content) {
    const text = String(content || '');
    const base = 6000;
    const lengthDelay = Math.ceil(text.length / 50) * 2000;
    const materialDelay = /\+(物料|案例|图片|链接|资料|作品)/.test(text) ? 4000 : 0;
    const consecutiveDelay = Math.max(0, state.training.pendingTeacherCount - 1) * 2000;
    return Math.min(20000, base + lengthDelay + materialDelay + consecutiveDelay);
  }

  function scheduleParentReply(latestTeacherContent) {
    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
    }

    const delay = calculateReplyDelay(latestTeacherContent);
    state.training.replyDueAt = Date.now() + delay;
    const seconds = Math.ceil(delay / 1000);
    setReplyWait(`家长正在看消息，约 ${seconds} 秒后回复。你可以继续补充，系统会重新等待。`);
    state.training.replyTimer = window.setTimeout(() => {
      requestParentReply();
    }, delay);
  }

  async function startTrainingScenario(scenarioId) {
    const scenario = flattenTrainingScenarios().find((item) => item.id === scenarioId);
    if (!scenario) return;

    resetTrainingRuntime();
    nodes.trainingLoadStatus.textContent = '正在创建训练...';
    const created = await api('/api/training/sessions', {
      method: 'POST',
      body: JSON.stringify({ scenarioId }),
    });

    state.training.selectedScenario = scenario;
    state.training.sessionId = created.sessionId;
    state.training.messages = [
      normalizeTrainingMessage({
        id: 'opening',
        role: 'ai',
        content: created.openingMessage,
        stepOrder: 1,
        createdAt: new Date().toISOString(),
      }),
    ];
    nodes.trainingLoadStatus.textContent = '';
    nodes.trainingPicker.classList.add('hidden');
    nodes.trainingChat.classList.remove('hidden');
    nodes.trainingReviewPanel.classList.add('hidden');
    nodes.trainingStatusChip.textContent = '训练中';
    nodes.trainingMessageInput.disabled = false;
    nodes.trainingForceReplyButton.disabled = false;
    nodes.trainingSubmitButton.disabled = false;
    renderTrainingContext();
    renderTrainingMessages();
  }

  async function sendTrainingMessage(event) {
    event?.preventDefault();
    const content = nodes.trainingMessageInput.value.trim();
    if (!content || !state.training.sessionId || state.training.replyInFlight) return;

    nodes.trainingMessageInput.value = '';
    const result = await api(`/api/training/sessions/${state.training.sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    state.training.messages.push(normalizeTrainingMessage(result.message));
    state.training.pendingTeacherCount += 1;
    renderTrainingMessages();
    scheduleParentReply(content);
  }

  async function requestParentReply() {
    if (!state.training.sessionId || state.training.replyInFlight || state.training.pendingTeacherCount === 0) return;
    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
      state.training.replyTimer = null;
    }

    state.training.replyInFlight = true;
    setReplyWait('家长回复中...');
    nodes.trainingForceReplyButton.disabled = true;
    let completed = false;

    try {
      const result = await api(`/api/training/sessions/${state.training.sessionId}/reply`, {
        method: 'POST',
      });
      state.training.messages.push(normalizeTrainingMessage(result.message));
      state.training.pendingTeacherCount = 0;
      nodes.trainingStatusChip.textContent = result.status === 'COMPLETED' ? '已完成，可生成复盘' : '训练中';
      renderTrainingMessages();
      if (result.status === 'COMPLETED') {
        completed = true;
        nodes.trainingMessageInput.disabled = true;
        nodes.trainingForceReplyButton.disabled = true;
        nodes.trainingSubmitButton.disabled = false;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      state.training.replyInFlight = false;
      nodes.trainingForceReplyButton.disabled = completed;
      setReplyWait('');
    }
  }

  function buildTrainingReviewHtml(review) {
    const dimensions = review.dimensions || {};
    const showScores = typeof review.overallScore === 'number';
    const dimensionLabels = [
      ['empathy', '共情'],
      ['standard', '建立标准'],
      ['enablement', '赋能'],
      ['caseProof', '给案例'],
      ['close', '缔结'],
    ];

    return `
      <article class="review-summary">
        <div class="review-summary-head">
          <h3>${escapeHtml(review.summary || '训练复盘已生成')}</h3>
          ${showScores ? `<strong class="review-total-score">${review.overallScore} 分</strong>` : ''}
        </div>
        <p>${escapeHtml(review.nextAction || '建议继续练习完整沟通节奏。')}</p>
      </article>
      ${
        review.strengths || review.weaknesses
          ? `
            <div class="review-note-grid">
              ${
                review.strengths
                  ? `
                    <article class="review-note-card">
                      <p class="eyebrow">做得好的地方</p>
                      <p>${escapeHtml(review.strengths)}</p>
                    </article>
                  `
                  : ''
              }
              ${
                review.weaknesses
                  ? `
                    <article class="review-note-card">
                      <p class="eyebrow">重点提升方向</p>
                      <p>${escapeHtml(review.weaknesses)}</p>
                    </article>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }
      <div class="dimension-list">
        ${dimensionLabels
          .map(([key, label]) => {
            const item = dimensions[key] || {};
            return `
              <article class="dimension-card">
                <div>
                  <h3>${label}</h3>
                  <p>${escapeHtml(item.reason || '暂无复盘说明')}</p>
                  <small>${escapeHtml(item.suggestion || '暂无改进建议')}</small>
                </div>
                ${typeof item.score === 'number' ? `<strong>${item.score} / 20</strong>` : ''}
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  }

  async function loadTrainingReviewDetail(sessionId) {
    if (!sessionId) return;
    state.training.selectedHistorySessionId = sessionId;
    renderTrainingHistory();
    nodes.trainingHistoryDetail.innerHTML = renderEmptyState('正在加载复盘内容...');

    try {
      const detail = await api(`/api/training/sessions/${sessionId}`);
      if (!detail.review) {
        nodes.trainingHistoryDetail.innerHTML = renderEmptyState('这次训练还没有生成复盘。');
        return;
      }
      nodes.trainingHistoryDetail.innerHTML = buildTrainingReviewHtml(detail.review);
    } catch (error) {
      nodes.trainingHistoryDetail.innerHTML = renderEmptyState(error.message);
    }
  }

  function renderTrainingReview(review) {
    if (!review) return;
    nodes.trainingReviewPanel.classList.remove('hidden');
    nodes.trainingReviewScore.textContent =
      typeof review.overallScore === 'number' ? `${review.overallScore} 分` : '提升建议';
    nodes.trainingReviewContent.innerHTML = buildTrainingReviewHtml(review);
  }

  async function endTrainingAndReview() {
    if (!state.training.sessionId || state.training.review) return;
    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
      state.training.replyTimer = null;
    }
    state.training.pendingTeacherCount = 0;
    state.training.replyInFlight = false;
    setReplyWait('');
    nodes.trainingEndButton.disabled = true;
    nodes.trainingSubmitButton.disabled = true;
    nodes.trainingMessageInput.disabled = true;
    nodes.trainingForceReplyButton.disabled = true;
    nodes.trainingStatusChip.textContent = '生成复盘中';
    let reviewCompleted = false;

    try {
      await api(`/api/training/sessions/${state.training.sessionId}/end`, { method: 'POST' });
      const review = await api(`/api/training/sessions/${state.training.sessionId}/review`, { method: 'POST' });
      state.training.review = review;
      reviewCompleted = true;
      nodes.trainingStatusChip.textContent = '复盘完成';
      renderTrainingReview(review);
      await loadTeacherTrainingSessions();
    } catch (error) {
      alert(error.message);
      nodes.trainingStatusChip.textContent = '训练中';
    } finally {
      nodes.trainingEndButton.disabled = reviewCompleted;
      nodes.trainingSubmitButton.disabled = reviewCompleted;
    }
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
    } else if (state.view === 'training') {
      await loadTrainingTopics();
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
    setupInternalAccountLogin();
    checkInternalAccount();
    nodes.loginForm.addEventListener('submit', handleLogin);
    nodes.logoutButton.addEventListener('click', () => {
      setToken('');
      state.profile = null;
      state.objections = [];
      state.selectedScene = '';
      state.selectedObjectionId = '';
      resetTrainingRuntime();
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
    nodes.trainingBackButton.addEventListener('click', () => {
      resetTrainingRuntime();
      renderTrainingPicker();
    });
    nodes.trainingContextToggle.addEventListener('click', () => {
      const isCollapsed = nodes.trainingContextPanel.classList.toggle('mobile-collapsed');
      nodes.trainingContextToggle.textContent = isCollapsed ? '查看训练信息' : '收起训练信息';
      nodes.trainingContextToggle.setAttribute('aria-expanded', String(!isCollapsed));
    });
    nodes.trainingMessageForm.addEventListener('submit', sendTrainingMessage);
    nodes.trainingForceReplyButton.addEventListener('click', requestParentReply);
    nodes.trainingEndButton.addEventListener('click', endTrainingAndReview);
    nodes.trainingSubmitButton.addEventListener('click', endTrainingAndReview);
    nodes.trainingMessageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendTrainingMessage(event);
      }
    });
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
        await loadTrainingTopics();
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
