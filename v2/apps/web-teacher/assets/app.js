(function () {
  const storageKey = 'yycl_v2_teacher_token';
  const scenes = [
    { id: 'pre', title: '课前进线', desc: '用户刚进线或预约体验前，重点解决信任、时间、孩子适配和到课意愿。', tone: '轻解释，重确认' },
    { id: 'mid', title: '课中推进', desc: '体验课进行中或刚结束，重点推动家长理解孩子表现和课程价值。', tone: '多观察，少催促' },
    { id: 'close', title: '结转促单', desc: '结转报名阶段，重点处理价格、犹豫、对比、决策人和付款节奏。', tone: '给证据，给下一步' },
  ];
  const trainingScoringCriteria = [
    {
      title: '共情',
      fullMark: '回应家长的具体顾虑，给到情绪价值，并降低家长的压力。',
      bands: [
        ['0-5', '没有共情，或直接否定家长。'],
        ['6-10', '只有泛泛的“理解”“正常”。'],
        ['11-15', '回应了家长的具体顾虑。'],
        ['16-20', '给到情绪价值，并有效降低压力。'],
      ],
    },
    {
      title: '建立标准',
      fullMark: '给出具体、可观察的判断标准，并连接当前异议和家长决策。',
      bands: [
        ['0-5', '没有标准，只强调课程好。'],
        ['6-10', '提出了标准，但比较模糊。'],
        ['11-15', '给出了清晰、可观察的标准。'],
        ['16-20', '标准具体可观察，并连接异议和决策。'],
      ],
    },
    {
      title: '赋能',
      fullMark: '解释具体的编程价值，并发送物料、资料、图片、链接或作品。',
      hardRule: '没有发送相关物料，最高 15 分。',
      bands: [
        ['0-5', '没有进行赋能。'],
        ['6-10', '泛泛讲编程价值，且没有物料。'],
        ['11-15', '有具体价值解释，但没有物料。'],
        ['16-20', '解释具体价值，并发送了相关物料。'],
      ],
    },
    {
      title: '给案例',
      fullMark: '提供具体案例，并用案例、物料、图片或作品作为证据。',
      hardRule: '没有发送案例证据，最高 15 分。',
      bands: [
        ['0-5', '没有提供案例。'],
        ['6-10', '只有“很多孩子”一类泛泛表达。'],
        ['11-15', '有具体的案例结构。'],
        ['16-20', '案例具体，并发送了相关证据。'],
      ],
    },
    {
      title: '缔结',
      fullMark: '低压力但明确地确认报名、约时间、要单或推进付款。',
      hardRule: '没有清晰的下一步，最高 10 分。',
      bands: [
        ['0-5', '没有提出下一步。'],
        ['6-10', '只有“考虑一下”一类弱提醒。'],
        ['11-15', '提出了清晰的下一步。'],
        ['16-20', '低压力且明确地推进成交。'],
      ],
    },
  ];
  const DRAFT_IDLE_REPLY_DELAY_MS = 12_000;

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
      messageSending: false,
      sendQueuedAfterReply: false,
      pendingImages: [],
      uploadingImages: 0,
      runtimeKey: 0,
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
    trainingImageInput: document.getElementById('trainingImageInput'),
    trainingPendingImageList: document.getElementById('trainingPendingImageList'),
    trainingAddImageButton: document.getElementById('trainingAddImageButton'),
    trainingForceReplyButton: document.getElementById('trainingForceReplyButton'),
    trainingSendButton: document.getElementById('trainingSendButton'),
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

  async function uploadApi(path, formData) {
    const headers = {};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, { method: 'POST', headers, body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.code !== 0) {
      throw new Error(payload.message || '图片上传失败，请稍后重试');
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
    state.training.messageSending = false;
    state.training.sendQueuedAfterReply = false;
    state.training.pendingImages = [];
    state.training.uploadingImages = 0;
    state.training.runtimeKey += 1;
    state.training.review = null;
    if (nodes.trainingMessageInput) {
      nodes.trainingMessageInput.value = '';
    }
    if (nodes.trainingImageInput) nodes.trainingImageInput.value = '';
    if (nodes.trainingSendButton) {
      nodes.trainingSendButton.disabled = false;
      nodes.trainingSendButton.textContent = '发送';
    }
    renderPendingTrainingImages();
    nodes.trainingContextPanel.classList.add('mobile-collapsed');
    nodes.trainingContextToggle.textContent = '查看训练参考';
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
      <section class="training-criteria" aria-labelledby="trainingCriteriaTitle">
        <div class="training-criteria-head">
          <div>
            <p class="eyebrow">Scoring Guide</p>
            <h3 id="trainingCriteriaTitle">训练评分标准</h3>
          </div>
          <strong>100 分</strong>
        </div>
        <p class="training-criteria-intro">五项各 20 分，按完整对话综合评估。此处仅展示标准，不展示本次训练得分。</p>
        <ol class="training-criteria-list">
          ${trainingScoringCriteria
            .map(
              (criterion, index) => `
                <li class="training-criterion">
                  <div class="training-criterion-head">
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <strong>${escapeHtml(criterion.title)}</strong>
                    <small>20 分</small>
                  </div>
                  <p>${escapeHtml(criterion.fullMark)}</p>
                  ${criterion.hardRule ? `<p class="criterion-hard-rule">${escapeHtml(criterion.hardRule)}</p>` : ''}
                  <details class="criterion-bands">
                    <summary>查看分档标准</summary>
                    <ul>
                      ${criterion.bands
                        .map(
                          ([range, description]) => `
                            <li><strong>${escapeHtml(range)}</strong><span>${escapeHtml(description)}</span></li>
                          `
                        )
                        .join('')}
                    </ul>
                  </details>
                </li>
              `
            )
            .join('')}
        </ol>
      </section>
    `;
  }

  function normalizeTrainingMessage(message) {
    return {
      id: message.id || `${message.role}-${Date.now()}-${Math.random()}`,
      role: message.role === 'ai' || message.role === 'AI' ? 'ai' : 'teacher',
      content: message.content || '',
      stepOrder: message.stepOrder || 1,
      createdAt: message.createdAt || new Date().toISOString(),
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    };
  }

  function renderTrainingAttachments(attachments) {
    if (!attachments.length) return '';
    return `
      <div class="chat-attachments">
        ${attachments
          .map((image) =>
            image.url && !image.isExpired
              ? `<a class="chat-attachment" href="${escapeHtml(image.url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(
                  image.url
                )}" alt="${escapeHtml(image.name || '训练图片')}" loading="lazy" /></a>`
              : `<div class="chat-attachment expired-chat-image">图片已按保留规则清理</div>`
          )
          .join('')}
      </div>
    `;
  }

  function renderPendingTrainingImages() {
    if (!nodes.trainingPendingImageList) return;
    const images = state.training.pendingImages;
    nodes.trainingPendingImageList.classList.toggle('hidden', !images.length && state.training.uploadingImages === 0);
    nodes.trainingPendingImageList.innerHTML = `
      ${images
        .map(
          (image) => `
            <article class="pending-image-item">
              <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name || '待发送图片')}" />
              <small>${escapeHtml(image.name || '图片')}</small>
              <button type="button" data-remove-pending-image="${escapeHtml(image.id)}" aria-label="移除图片" title="移除图片">&times;</button>
            </article>
          `
        )
        .join('')}
      ${state.training.uploadingImages ? `<div class="pending-image-item expired-chat-image">正在上传 ${state.training.uploadingImages} 张...</div>` : ''}
    `;
    nodes.trainingPendingImageList.querySelectorAll('[data-remove-pending-image]').forEach((button) => {
      button.addEventListener('click', async () => {
        const imageId = button.dataset.removePendingImage;
        if (!imageId || !state.training.sessionId) return;
        button.disabled = true;
        try {
          await api(`/api/training/sessions/${state.training.sessionId}/images/${imageId}`, { method: 'DELETE' });
          state.training.pendingImages = state.training.pendingImages.filter((image) => image.id !== imageId);
          renderPendingTrainingImages();
        } catch (error) {
          alert(error.message);
          button.disabled = false;
        }
      });
    });
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
            ${message.content ? `<p>${escapeHtml(message.content).replace(/\n/g, '<br />')}</p>` : ''}
            ${renderTrainingAttachments(message.attachments || [])}
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

  function calculateReplyDelay(content, imageCount = 0) {
    const text = String(content || '');
    const base = 6000;
    const lengthDelay = Math.ceil(text.length / 50) * 2000;
    const materialDelay = imageCount > 0 || /\+(物料|案例|图片|链接|资料|作品)/.test(text) ? 4000 : 0;
    const consecutiveDelay = Math.max(0, state.training.pendingTeacherCount - 1) * 2000;
    return Math.min(20000, base + lengthDelay + materialDelay + consecutiveDelay);
  }

  function scheduleParentReply(latestTeacherContent, imageCount = 0) {
    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
    }

    const delay = calculateReplyDelay(latestTeacherContent, imageCount);
    state.training.replyDueAt = Date.now() + delay;
    const seconds = Math.ceil(delay / 1000);
    setReplyWait(`家长正在看消息，约 ${seconds} 秒后回复。你可以继续补充，系统会重新等待。`);
    state.training.replyTimer = window.setTimeout(() => {
      requestParentReply();
    }, delay);
  }

  function deferParentReplyWhileTyping() {
    if (
      !state.training.sessionId ||
      state.training.pendingTeacherCount === 0 ||
      state.training.replyInFlight ||
      state.training.messageSending ||
      state.training.sendQueuedAfterReply
    ) {
      return;
    }

    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
    }
    state.training.replyDueAt = Date.now() + DRAFT_IDLE_REPLY_DELAY_MS;
    setReplyWait('检测到你还在输入，家长会继续等待。');
    state.training.replyTimer = window.setTimeout(() => {
      requestParentReply();
    }, DRAFT_IDLE_REPLY_DELAY_MS);
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
    nodes.trainingImageInput.disabled = false;
    nodes.trainingAddImageButton.disabled = false;
    nodes.trainingForceReplyButton.disabled = false;
    nodes.trainingSubmitButton.disabled = false;
    renderTrainingContext();
    renderTrainingMessages();
  }

  async function sendTrainingMessage(event) {
    event?.preventDefault();
    const content = nodes.trainingMessageInput.value.trim();
    const images = [...state.training.pendingImages];
    if ((!content && !images.length) || !state.training.sessionId) return;
    if (state.training.uploadingImages > 0) {
      alert('图片仍在上传，请上传完成后再发送。');
      return;
    }
    if (state.training.replyInFlight) {
      state.training.sendQueuedAfterReply = true;
      nodes.trainingSendButton.disabled = true;
      nodes.trainingSendButton.textContent = '待发送';
      setReplyWait('家长正在回复，这条消息将在回复后自动发送。');
      return;
    }
    if (state.training.messageSending) {
      setReplyWait('老师消息正在发送，请稍候。');
      return;
    }

    if (state.training.replyTimer) {
      window.clearTimeout(state.training.replyTimer);
      state.training.replyTimer = null;
    }

    state.training.messageSending = true;
    nodes.trainingSendButton.disabled = true;
    nodes.trainingSendButton.textContent = '发送中';
    setReplyWait('老师消息正在发送...');
    let sent = false;
    try {
      const result = await api(`/api/training/sessions/${state.training.sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, imageIds: images.map((image) => image.id) }),
      });
      nodes.trainingMessageInput.value = '';
      state.training.pendingImages = [];
      state.training.messages.push(normalizeTrainingMessage(result.message));
      state.training.pendingTeacherCount += 1;
      renderPendingTrainingImages();
      renderTrainingMessages();
      scheduleParentReply(content, images.length);
      sent = true;
    } catch (error) {
      alert(error.message);
    } finally {
      state.training.messageSending = false;
      nodes.trainingSendButton.disabled = false;
      nodes.trainingSendButton.textContent = '发送';
      if (!sent && state.training.pendingTeacherCount > 0 && !state.training.replyInFlight) {
        scheduleParentReply('', 0);
      }
    }
  }

  async function uploadTrainingImages(files) {
    if (!state.training.sessionId || !files.length) return;
    const sessionId = state.training.sessionId;
    const runtimeKey = state.training.runtimeKey;
    state.training.uploadingImages += files.length;
    nodes.trainingAddImageButton.disabled = true;
    if (state.training.pendingTeacherCount > 0 && !state.training.replyInFlight) {
      scheduleParentReply('', files.length);
    }
    renderPendingTrainingImages();
    const uploaded = new Array(files.length);
    const errors = [];
    let nextIndex = 0;

    async function uploadNext() {
      while (
        nextIndex < files.length &&
        state.training.runtimeKey === runtimeKey &&
        state.training.sessionId === sessionId
      ) {
        const index = nextIndex;
        nextIndex += 1;
        const formData = new FormData();
        formData.set('image', files[index]);
        try {
          uploaded[index] = await uploadApi(`/api/training/sessions/${sessionId}/images`, formData);
        } catch (error) {
          errors.push(`${files[index].name}：${error.message}`);
        } finally {
          if (state.training.runtimeKey === runtimeKey && state.training.sessionId === sessionId) {
            state.training.uploadingImages -= 1;
            renderPendingTrainingImages();
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, files.length) }, () => uploadNext()));
    if (state.training.runtimeKey !== runtimeKey || state.training.sessionId !== sessionId) {
      await Promise.allSettled(
        uploaded
          .filter(Boolean)
          .map((image) => api(`/api/training/sessions/${sessionId}/images/${image.id}`, { method: 'DELETE' }))
      );
      return;
    }
    state.training.pendingImages.push(...uploaded.filter(Boolean));
    nodes.trainingImageInput.value = '';
    nodes.trainingAddImageButton.disabled = false;
    renderPendingTrainingImages();
    if (errors.length) alert(errors.join('\n'));
  }

  async function requestParentReply() {
    if (!state.training.sessionId || state.training.replyInFlight || state.training.pendingTeacherCount === 0) return;
    if (state.training.messageSending || state.training.uploadingImages > 0) {
      scheduleParentReply('', 0);
      return;
    }
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
      nodes.trainingStatusChip.textContent = result.purchaseConfirmed || result.allObjectionsResolved
        ? '家长已决定购买'
        : result.status === 'COMPLETED'
          ? '已完成，可生成复盘'
          : '训练中';
      renderTrainingMessages();
      if (result.status === 'COMPLETED') {
        completed = true;
        nodes.trainingMessageInput.disabled = true;
        nodes.trainingImageInput.disabled = true;
        nodes.trainingAddImageButton.disabled = true;
        nodes.trainingForceReplyButton.disabled = true;
        nodes.trainingSubmitButton.disabled = false;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      state.training.replyInFlight = false;
      nodes.trainingForceReplyButton.disabled = completed;
      setReplyWait('');
      const shouldSendQueuedMessage = state.training.sendQueuedAfterReply;
      state.training.sendQueuedAfterReply = false;
      nodes.trainingSendButton.disabled = completed;
      nodes.trainingSendButton.textContent = '发送';
      if (shouldSendQueuedMessage && !completed) {
        window.setTimeout(() => sendTrainingMessage(), 0);
      } else if (shouldSendQueuedMessage) {
        alert('当前异议已经完成，这条补充内容未发送。你可以提交训练并查看复盘。');
      }
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
    if (state.training.uploadingImages > 0) {
      alert('图片仍在上传，请上传完成后再提交训练。');
      return;
    }
    if (state.training.pendingImages.length > 0) {
      alert('还有未发送的图片，请先发送或移除后再提交训练。');
      return;
    }
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
    nodes.trainingImageInput.disabled = true;
    nodes.trainingAddImageButton.disabled = true;
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
      nodes.trainingContextToggle.textContent = isCollapsed ? '查看训练参考' : '收起训练参考';
      nodes.trainingContextToggle.setAttribute('aria-expanded', String(!isCollapsed));
    });
    nodes.trainingMessageForm.addEventListener('submit', sendTrainingMessage);
    nodes.trainingAddImageButton.addEventListener('click', () => nodes.trainingImageInput.click());
    nodes.trainingImageInput.addEventListener('change', () => {
      uploadTrainingImages(Array.from(nodes.trainingImageInput.files || []));
    });
    nodes.trainingForceReplyButton.addEventListener('click', requestParentReply);
    nodes.trainingEndButton.addEventListener('click', endTrainingAndReview);
    nodes.trainingSubmitButton.addEventListener('click', endTrainingAndReview);
    nodes.trainingMessageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendTrainingMessage(event);
      }
    });
    nodes.trainingMessageInput.addEventListener('input', deferParentReplyWhileTyping);
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
