(function () {
  const storageKey = 'yycl_v2_teacher_token';
  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    topics: [],
    sessions: [],
    selectedScenario: null,
    selectedSession: null,
    activeReview: null,
    currentView: 'lobby',
    sendingMessage: false,
  };

  const nodes = {
    authScreen: document.getElementById('teacherAuthScreen'),
    workspace: document.getElementById('teacherWorkspace'),
    headerTitle: document.getElementById('teacherHeaderTitle'),
    lobbyScreen: document.getElementById('teacherLobbyScreen'),
    trainingScreen: document.getElementById('teacherTrainingScreen'),
    loginForm: document.getElementById('teacherLoginForm'),
    loginStatus: document.getElementById('teacherLoginStatus'),
    profileChip: document.getElementById('teacherProfileChip'),
    metrics: document.getElementById('teacherMetrics'),
    topicList: document.getElementById('teacherTopicList'),
    historyList: document.getElementById('teacherHistoryList'),
    scenarioPreviewPanel: document.getElementById('teacherScenarioPreviewPanel'),
    scenarioTitle: document.getElementById('teacherScenarioTitle'),
    scenarioMeta: document.getElementById('teacherScenarioMeta'),
    trainingScenarioMeta: document.getElementById('teacherTrainingScenarioMeta'),
    startSessionButton: document.getElementById('teacherStartSessionButton'),
    sessionTitle: document.getElementById('teacherSessionTitle'),
    sessionStatus: document.getElementById('teacherSessionStatus'),
    chatLog: document.getElementById('teacherChatLog'),
    messageForm: document.getElementById('teacherMessageForm'),
    messageInput: document.getElementById('teacherMessageInput'),
    messageStatus: document.getElementById('teacherMessageStatus'),
    reviewButton: document.getElementById('teacherReviewButton'),
    endSessionButton: document.getElementById('teacherEndSessionButton'),
    reviewPanel: document.getElementById('teacherReviewPanel'),
    reviewContent: document.getElementById('teacherReviewContent'),
    logoutButton: document.getElementById('teacherLogoutButton'),
    refreshButton: document.getElementById('teacherRefreshButton'),
    reloadTopicsButton: document.getElementById('teacherReloadTopicsButton'),
    backToLobbyButton: document.getElementById('teacherBackToLobbyButton'),
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char];
    });
  }

  function renderEmptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderMessageBubble(message) {
    return `
      <article class="message ${escapeHtml(message.role)}${message.pending ? ' pending-message' : ''}">
        <div class="message-meta">
          <span>${message.role === 'teacher' ? '教师' : 'AI 家长'}</span>
          <span>${message.pending ? '家长回复中' : '沟通记录'}</span>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
      </article>
    `;
  }

  function insertTextareaNewline(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = `${value.slice(0, start)}\n${value.slice(end)}`;
    textarea.selectionStart = start + 1;
    textarea.selectionEnd = start + 1;
  }

  function appendChatMessage(message) {
    if (nodes.chatLog.querySelector('.empty-state')) {
      nodes.chatLog.innerHTML = '';
    }

    nodes.chatLog.insertAdjacentHTML('beforeend', renderMessageBubble(message));
    nodes.chatLog.scrollTop = nodes.chatLog.scrollHeight;
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

  function setView(view) {
    state.currentView = view;
    const inTraining = view === 'training';
    nodes.lobbyScreen.classList.toggle('hidden', inTraining);
    nodes.trainingScreen.classList.toggle('hidden', !inTraining);
    nodes.backToLobbyButton.classList.toggle('hidden', !inTraining);
    nodes.headerTitle.textContent = inTraining ? '训练模块' : '场景大厅';
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

  function formatDate(value) {
    if (!value) return '未结束';
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
      2,
      '0'
    )}`;
  }

  function formatRole(role) {
    return role === 'TRAINER' ? '培训主管' : '教师';
  }

  function statusLabel(status) {
    const map = {
      ACTIVE: '进行中',
      COMPLETED: '已完成',
      ENDED: '已结束',
      FAILED: '失败',
    };
    return map[status] || status;
  }

  function difficultyLabel(value) {
    const map = {
      BASIC: '基础',
      STANDARD: '标准',
      ADVANCED: '进阶',
    };
    return map[value] || value;
  }

  function trainingModuleLabel(value) {
    const map = {
      PRE_CLASS: '课前训练',
    };
    return map[value] || value || '课前训练';
  }

  function renderMetrics() {
    const completed = state.sessions.filter((session) => session.status === 'COMPLETED').length;
    const scored = state.sessions.filter((session) => typeof session.reviewScore === 'number');
    const averageScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, session) => sum + (session.reviewScore || 0), 0) / scored.length)
        : '--';

    const metrics = [
      {
        label: '累计训练',
        value: state.sessions.length,
        description: '所有训练记录都会保留，方便随时回看与复盘。',
      },
      {
        label: '已完成',
        value: completed,
        description: '完整走完异议链路的会话次数。',
      },
      {
        label: '平均分',
        value: averageScore,
        description: '已生成点评的训练平均表现。',
      },
    ];

    nodes.metrics.innerHTML = metrics
      .map(
        (item) => `
          <article class="metric-card">
            <p class="eyebrow">${escapeHtml(item.label)}</p>
            <strong>${escapeHtml(item.value)}</strong>
            <p>${escapeHtml(item.description)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderTopics() {
    if (!state.topics.length) {
      nodes.topicList.innerHTML = renderEmptyState('当前还没有可用训练主题，请联系管理员先配置内容。');
      return;
    }

    const topicsByModule = state.topics.reduce((groups, topic) => {
      const key = topic.trainingModule || 'PRE_CLASS';
      groups[key] = groups[key] || [];
      groups[key].push(topic);
      return groups;
    }, {});

    nodes.topicList.innerHTML = Object.entries(topicsByModule)
      .map(([moduleKey, topics]) => {
        const topicCards = topics.map((topic) => {
        const scenarios = topic.scenarios || [];
        return `
          <article class="topic-card">
            <div class="topic-group">
              <div>
                <p class="eyebrow">${escapeHtml(trainingModuleLabel(topic.trainingModule))}</p>
                <h3>${escapeHtml(topic.title)}</h3>
                <p>${escapeHtml(topic.description)}</p>
              </div>
              <div class="tag-row">
                <span class="tag">场景 ${escapeHtml(topic.scenarioCount)}</span>
                ${scenarios.map((scenario) => `<span class="tag-warn">${escapeHtml(scenario.title)}</span>`).join('')}
              </div>
              <div class="scenario-quick-list">
                ${scenarios
                  .map(
                    (scenario) => `
                      <button
                        class="scenario-chip-btn ${state.selectedScenario && state.selectedScenario.id === scenario.id ? 'is-active' : ''}"
                        type="button"
                        data-scenario-id="${escapeHtml(scenario.id)}"
                      >
                        <div>
                          <strong>${escapeHtml(scenario.title)}</strong>
                          <span>${escapeHtml(scenario.description)}</span>
                        </div>
                        <span class="tag">${escapeHtml(difficultyLabel(scenario.difficulty))}</span>
                      </button>
                    `
                  )
                  .join('')}
              </div>
            </div>
          </article>
        `;
        }).join('');

        return `
          <section class="topic-module-block">
            <div class="module-head">
              <p class="eyebrow">Training Module</p>
              <h3>${escapeHtml(trainingModuleLabel(moduleKey))}</h3>
            </div>
            ${topicCards}
          </section>
        `;
      })
      .join('');

    nodes.topicList.querySelectorAll('[data-scenario-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const scenarioId = button.getAttribute('data-scenario-id');
        selectScenario(scenarioId);
      });
    });
  }

  function renderHistory() {
    if (!state.sessions.length) {
      nodes.historyList.innerHTML = renderEmptyState('还没有训练记录，先从左侧挑一个场景开始。');
      return;
    }

    nodes.historyList.innerHTML = state.sessions
      .map(
        (session) => `
          <article class="history-card">
            <p class="eyebrow">${escapeHtml(statusLabel(session.status))}</p>
            <h3>${escapeHtml(session.scenario.title)}</h3>
            <p>${escapeHtml(session.summary || '本次训练暂未生成总结，可重新进入训练模块查看详情。')}</p>
            <div class="tag-row">
              <span class="tag">开始 ${escapeHtml(formatDate(session.startedAt))}</span>
              <span class="tag-warn">得分 ${escapeHtml(session.reviewScore ?? '--')}</span>
            </div>
            <div class="history-actions">
              <span class="status-text">沟通轮次：${escapeHtml(session.currentStepOrder)} 段</span>
              <button class="secondary-btn compact-btn" type="button" data-session-id="${escapeHtml(session.id)}">
                打开训练模块
              </button>
            </div>
          </article>
        `
      )
      .join('');

    nodes.historyList.querySelectorAll('[data-session-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const sessionId = button.getAttribute('data-session-id');
        loadSession(sessionId);
      });
    });
  }

  function renderPreviewScenario() {
    const scenario = state.selectedScenario;
    if (!scenario) {
      nodes.scenarioPreviewPanel.classList.add('hidden');
      return;
    }

    nodes.scenarioPreviewPanel.classList.remove('hidden');
    nodes.scenarioTitle.textContent = scenario.title;
    nodes.scenarioMeta.innerHTML = `
      <article class="meta-card">
        <p class="eyebrow">家长画像</p>
        <p>${escapeHtml(scenario.parentPersona)}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">学生情况</p>
        <p>${escapeHtml(scenario.description)}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">异议场景</p>
        <p>${escapeHtml(difficultyLabel(scenario.difficulty))}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">开场话术</p>
        <p>${escapeHtml(scenario.openingLine)}</p>
      </article>
    `;

    nodes.startSessionButton.classList.remove('hidden');
  }

  function renderTrainingScenario() {
    const scenario = state.selectedScenario;
    if (!scenario) {
      nodes.trainingScenarioMeta.innerHTML = renderEmptyState('尚未选择场景。');
      return;
    }

    nodes.trainingScenarioMeta.innerHTML = `
      <article class="meta-card">
        <p class="eyebrow">家长画像</p>
        <p>${escapeHtml(scenario.parentPersona)}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">学生情况</p>
        <p>${escapeHtml(scenario.description)}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">异议场景</p>
        <p>${escapeHtml(scenario.title)}</p>
      </article>
      <article class="meta-card">
        <p class="eyebrow">训练目标</p>
        <p>像真实沟通一样持续回应家长顾虑，结束后系统会统一生成结构化复盘。</p>
      </article>
    `;
  }

  function renderSession() {
    const session = state.selectedSession;
    if (!session) {
      nodes.sessionTitle.textContent = '训练模块';
      nodes.sessionStatus.innerHTML = renderEmptyState('尚未进入训练模块。');
      nodes.chatLog.innerHTML = renderEmptyState('开始一场训练后，这里会显示完整对话。');
      nodes.messageInput.disabled = true;
      nodes.messageForm.querySelector('button[type="submit"]').disabled = true;
      return;
    }

    nodes.sessionTitle.textContent = session.scenario.title;
    nodes.sessionStatus.innerHTML = `
      <article class="session-tile">
        <p class="eyebrow">状态</p>
        <p>${escapeHtml(statusLabel(session.status))}</p>
      </article>
      <article class="session-tile">
        <p class="eyebrow">沟通轮次</p>
        <p>${escapeHtml(session.messages.filter((message) => message.role === 'teacher').length)} 轮</p>
      </article>
      <article class="session-tile">
        <p class="eyebrow">开始时间</p>
        <p>${escapeHtml(formatDate(session.startedAt))}</p>
      </article>
    `;

    nodes.chatLog.innerHTML = session.messages.length
      ? session.messages.map(renderMessageBubble).join('')
      : renderEmptyState('会话消息为空。');

    const isActive = session.status === 'ACTIVE';
    nodes.messageInput.disabled = !isActive || state.sendingMessage;
    nodes.messageForm.querySelector('button[type="submit"]').disabled = !isActive || state.sendingMessage;
    nodes.messageInput.placeholder = isActive
      ? '输入你的回复，Enter 发送，Shift+Enter 换行。'
      : '当前会话已结束，如需继续训练请返回场景大厅重新选择场景。';
    nodes.chatLog.scrollTop = nodes.chatLog.scrollHeight;

  }

  function renderReview() {
    const review = state.activeReview;
    if (!review) {
      nodes.reviewPanel.classList.add('hidden');
      return;
    }

    nodes.reviewPanel.classList.remove('hidden');
    nodes.reviewContent.innerHTML = `
      <div class="review-hero">
        <article class="score-card">
          <p class="eyebrow">Overall Score</p>
          <strong>${escapeHtml(review.overallScore)}</strong>
          <p class="status-text">综合表现</p>
        </article>
        <article class="review-card">
          <p class="eyebrow">Summary</p>
          <h3>本轮训练结论</h3>
          <p>${escapeHtml(review.summary)}</p>
          <div class="summary-tags">
            ${(review.tags || []).map((tag) => `<span class="tag-warn">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </article>
      </div>
      <div class="review-grid">
        <article class="review-card">
          <p class="eyebrow">Strengths</p>
          <h3>做得好的地方</h3>
          <p>${escapeHtml(review.strengths)}</p>
        </article>
        <article class="review-card">
          <p class="eyebrow">Weaknesses</p>
          <h3>仍需加强的地方</h3>
          <p>${escapeHtml(review.weaknesses)}</p>
        </article>
      </div>
      <article class="review-card" style="margin-top: 16px;">
        <p class="eyebrow">Next Action</p>
        <h3>下次训练建议</h3>
        <p>${escapeHtml(review.nextAction)}</p>
      </article>
      <div class="review-step-list">
        ${(review.steps || [])
          .map(
            (step) => `
              <article class="review-card">
                <div class="review-step-head">
                  <div>
                    <p class="eyebrow">Step ${escapeHtml(step.stepOrder)}</p>
                    <h3>${escapeHtml(step.stepTitle)}</h3>
                  </div>
                  <span class="review-step-score">${escapeHtml(step.score)}</span>
                </div>
                <p><strong>结论：</strong>${escapeHtml(step.verdict)}</p>
                <p><strong>优点：</strong>${escapeHtml(step.strengths)}</p>
                <p><strong>问题：</strong>${escapeHtml(step.issue)}</p>
                <p><strong>建议：</strong>${escapeHtml(step.recommendation)}</p>
              </article>
            `
          )
          .join('')}
      </div>
    `;
  }

  function selectScenario(scenarioId) {
    for (const topic of state.topics) {
      const scenario = topic.scenarios.find((item) => item.id === scenarioId);
      if (!scenario) continue;

      state.selectedScenario = scenario;
      state.selectedSession = null;
      state.activeReview = null;
      nodes.messageStatus.textContent = '';
      renderTopics();
      renderPreviewScenario();
      renderTrainingScenario();
      renderReview();
      return;
    }
  }

  async function loadProfile() {
    state.profile = await api('/api/auth/me');
    nodes.profileChip.textContent = `${state.profile.displayName || state.profile.username} · ${formatRole(
      state.profile.role
    )}`;
  }

  async function loadTopics() {
    state.topics = await api('/api/topics');
    renderTopics();
    renderPreviewScenario();
  }

  async function loadHistory() {
    state.sessions = await api('/api/training/sessions');
    renderMetrics();
    renderHistory();
  }

  async function loadSession(sessionId) {
    const session = await api(`/api/training/sessions/${sessionId}`);
    state.selectedSession = session;
    state.selectedScenario = session.scenario;
    state.activeReview = session.review;
    renderTopics();
    renderPreviewScenario();
    renderTrainingScenario();
    renderSession();
    renderReview();
    setView('training');
  }

  async function refreshWorkspace() {
    await Promise.all([loadProfile(), loadTopics(), loadHistory()]);
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
      setView('lobby');
      nodes.loginStatus.textContent = '';
      await refreshWorkspace();
    } catch (error) {
      nodes.loginStatus.textContent = error.message;
    }
  }

  async function handleStartSession() {
    if (!state.selectedScenario) return;

    const originalText = nodes.startSessionButton.textContent;
    nodes.startSessionButton.textContent = '正在进入...';
    nodes.startSessionButton.disabled = true;

    try {
      const result = await api('/api/training/sessions', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: state.selectedScenario.id }),
      });
      await loadSession(result.sessionId);
      await loadHistory();
    } catch (error) {
      alert(error.message);
    } finally {
      nodes.startSessionButton.textContent = originalText;
      nodes.startSessionButton.disabled = false;
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!state.selectedSession || state.sendingMessage) return;

    const content = nodes.messageInput.value.trim();
    if (!content) return;

    const sessionId = state.selectedSession.id;
    const stepOrder = state.selectedSession.currentStepOrder;
    const submitButton = nodes.messageForm.querySelector('button[type="submit"]');

    state.sendingMessage = true;
    nodes.messageInput.value = '';
    nodes.messageInput.disabled = true;
    submitButton.disabled = true;
    appendChatMessage({ role: 'teacher', content, stepOrder });
    appendChatMessage({
      role: 'ai',
      content: '家长回复中，预计 10 秒左右...',
      stepOrder,
      pending: true,
    });
    nodes.messageStatus.textContent = '家长回复中，预计 10 秒左右...';

    try {
      await api(`/api/training/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      nodes.messageStatus.textContent = '家长已回复';
      await loadSession(sessionId);
      await loadHistory();
    } catch (error) {
      nodes.messageStatus.textContent = error.message;
      nodes.chatLog.querySelector('.pending-message')?.remove();
      appendChatMessage({
        role: 'ai',
        content: `发送失败：${error.message}`,
        stepOrder,
      });
    } finally {
      state.sendingMessage = false;
      if (state.selectedSession?.status === 'ACTIVE') {
        nodes.messageInput.disabled = false;
        submitButton.disabled = false;
        nodes.messageInput.focus();
      }
    }
  }

  async function handleEndSession() {
    if (!state.selectedSession) return;

    const originalText = nodes.endSessionButton.textContent;
    nodes.endSessionButton.textContent = '正在结束...';
    nodes.endSessionButton.disabled = true;

    try {
      await api(`/api/training/sessions/${state.selectedSession.id}/end`, {
        method: 'POST',
      });
      await loadSession(state.selectedSession.id);
      await loadHistory();
    } catch (error) {
      alert(error.message);
    } finally {
      nodes.endSessionButton.textContent = originalText;
      nodes.endSessionButton.disabled = false;
    }
  }

  async function handleReview() {
    if (!state.selectedSession) return;

    const originalText = nodes.reviewButton.textContent;
    nodes.reviewButton.textContent = '生成中...';
    nodes.reviewButton.disabled = true;

    try {
      state.activeReview = await api(`/api/training/sessions/${state.selectedSession.id}/review`, {
        method: 'POST',
      });
      renderReview();
      await loadHistory();
      await loadSession(state.selectedSession.id);
    } catch (error) {
      alert(error.message);
    } finally {
      nodes.reviewButton.textContent = originalText;
      nodes.reviewButton.disabled = false;
    }
  }

  async function bootstrap() {
    nodes.loginForm.addEventListener('submit', handleLogin);
    nodes.startSessionButton.addEventListener('click', handleStartSession);
    nodes.messageForm.addEventListener('submit', handleSendMessage);
    nodes.messageInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      if (event.shiftKey) {
        insertTextareaNewline(nodes.messageInput);
        return;
      }

      nodes.messageForm.requestSubmit();
    });
    nodes.reviewButton.addEventListener('click', handleReview);
    nodes.endSessionButton.addEventListener('click', handleEndSession);
    nodes.backToLobbyButton.addEventListener('click', () => {
      setView('lobby');
    });
    nodes.logoutButton.addEventListener('click', () => {
      setToken('');
      state.profile = null;
      state.topics = [];
      state.sessions = [];
      state.selectedScenario = null;
      state.selectedSession = null;
      state.activeReview = null;
      state.currentView = 'lobby';
      nodes.loginStatus.textContent = '';
      nodes.messageStatus.textContent = '';
      toggleApp(false);
      setView('lobby');
    });
    nodes.refreshButton.addEventListener('click', refreshWorkspace);
    nodes.reloadTopicsButton.addEventListener('click', loadTopics);

    if (!state.token) {
      toggleApp(false);
      setView('lobby');
      return;
    }

    try {
      toggleApp(true);
      setView('lobby');
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      setToken('');
      toggleApp(false);
      setView('lobby');
    }
  }

  bootstrap();
})();
