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
    },
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
    trainingPicker: document.getElementById('trainingPicker'),
    trainingScenarioList: document.getElementById('trainingScenarioList'),
    trainingLoadStatus: document.getElementById('trainingLoadStatus'),
    trainingChat: document.getElementById('trainingChat'),
    trainingScenarioTitle: document.getElementById('trainingScenarioTitle'),
    trainingContextList: document.getElementById('trainingContextList'),
    trainingBackButton: document.getElementById('trainingBackButton'),
    trainingEndButton: document.getElementById('trainingEndButton'),
    trainingStatusChip: document.getElementById('trainingStatusChip'),
    trainingMessageList: document.getElementById('trainingMessageList'),
    trainingReplyWait: document.getElementById('trainingReplyWait'),
    trainingMessageForm: document.getElementById('trainingMessageForm'),
    trainingMessageInput: document.getElementById('trainingMessageInput'),
    trainingForceReplyButton: document.getElementById('trainingForceReplyButton'),
    trainingReviewPanel: document.getElementById('trainingReviewPanel'),
    trainingReviewScore: document.getElementById('trainingReviewScore'),
    trainingReviewContent: document.getElementById('trainingReviewContent'),
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
    const scenarios = flattenTrainingScenarios();
    nodes.trainingPicker.classList.remove('hidden');
    nodes.trainingChat.classList.add('hidden');
    nodes.trainingReviewPanel.classList.add('hidden');

    if (!scenarios.length) {
      nodes.trainingScenarioList.innerHTML = renderEmptyState('当前暂无可训练场景，请管理员先在后台录入训练主题和场景。');
      return;
    }

    nodes.trainingScenarioList.innerHTML = scenarios
      .map(
        (scenario) => `
          <button class="training-scenario-card" type="button" data-training-scenario="${escapeHtml(scenario.id)}">
            <p class="eyebrow">${escapeHtml(scenario.topicTitle || '训练主题')}</p>
            <h3>${escapeHtml(scenario.title)}</h3>
            <p>${escapeHtml(scenario.description)}</p>
            <div class="tag-row">
              <span class="tag">${escapeHtml(scenario.difficulty || '标准')}</span>
              <span class="${scenario.sopConfigured ? 'tag-good' : 'tag-warn'}">${scenario.sopConfigured ? '已导入 SOP' : '暂无 SOP'}</span>
            </div>
          </button>
        `
      )
      .join('');

    nodes.trainingScenarioList.querySelectorAll('[data-training-scenario]').forEach((button) => {
      button.addEventListener('click', async () => {
        const scenarioId = button.getAttribute('data-training-scenario') || '';
        await startTrainingScenario(scenarioId);
      });
    });
  }

  async function loadTrainingTopics() {
    nodes.trainingLoadStatus.textContent = '正在加载训练场景...';
    state.training.topics = await api('/api/topics');
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
      <article class="context-card">
        <p class="eyebrow">练习提示</p>
        <p>老师可以连续发送多段话，系统会等待你说完后再让家长回复。需要发送物料时，可在话术里写 +物料、+案例、+图片 或 +链接。</p>
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
      nodes.trainingStatusChip.textContent =
        result.status === 'COMPLETED' ? '已完成，可生成复盘' : `${result.emotionState || '家长'} · ${result.resolutionScore ?? 0}分`;
      renderTrainingMessages();
      if (result.status === 'COMPLETED') {
        completed = true;
        nodes.trainingMessageInput.disabled = true;
        nodes.trainingForceReplyButton.disabled = true;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      state.training.replyInFlight = false;
      nodes.trainingForceReplyButton.disabled = completed;
      setReplyWait('');
    }
  }

  function renderTrainingReview(review) {
    if (!review) return;
    const dimensions = review.dimensions || {};
    const dimensionLabels = [
      ['empathy', '共情'],
      ['standard', '建立标准'],
      ['enablement', '赋能'],
      ['caseProof', '给案例'],
      ['close', '缔结'],
    ];

    nodes.trainingReviewPanel.classList.remove('hidden');
    nodes.trainingReviewScore.textContent = `${review.overallScore || 0} 分`;
    nodes.trainingReviewContent.innerHTML = `
      <article class="review-summary">
        <h3>${escapeHtml(review.summary || '训练复盘已生成')}</h3>
        <p>${escapeHtml(review.nextAction || '建议继续练习完整沟通节奏。')}</p>
      </article>
      <div class="dimension-list">
        ${dimensionLabels
          .map(([key, label]) => {
            const item = dimensions[key] || {};
            return `
              <article class="dimension-card">
                <div>
                  <h3>${label}</h3>
                  <p>${escapeHtml(item.reason || '暂无扣分说明')}</p>
                  <small>${escapeHtml(item.suggestion || '暂无改进建议')}</small>
                </div>
                <strong>${Number(item.score || 0)}/20</strong>
              </article>
            `;
          })
          .join('')}
      </div>
    `;
  }

  async function endTrainingAndReview() {
    if (!state.training.sessionId) return;
    if (state.training.pendingTeacherCount > 0) {
      await requestParentReply();
    }
    nodes.trainingEndButton.disabled = true;
    nodes.trainingStatusChip.textContent = '生成复盘中';

    try {
      await api(`/api/training/sessions/${state.training.sessionId}/end`, { method: 'POST' });
      const review = await api(`/api/training/sessions/${state.training.sessionId}/review`, { method: 'POST' });
      state.training.review = review;
      nodes.trainingStatusChip.textContent = '复盘完成';
      renderTrainingReview(review);
    } catch (error) {
      alert(error.message);
      nodes.trainingStatusChip.textContent = '训练中';
    } finally {
      nodes.trainingEndButton.disabled = false;
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
    nodes.trainingMessageForm.addEventListener('submit', sendTrainingMessage);
    nodes.trainingForceReplyButton.addEventListener('click', requestParentReply);
    nodes.trainingEndButton.addEventListener('click', endTrainingAndReview);
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
