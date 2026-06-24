(function () {
  const storageKey = 'yycl_v2_admin_token';
  const state = {
    token: localStorage.getItem(storageKey) || '',
    profile: null,
    dashboard: null,
    users: [],
    topics: [],
    activeTab: 'dashboard',
    editingTopicId: '',
    editingScenarioId: '',
  };

  const nodes = {
    authScreen: document.getElementById('adminAuthScreen'),
    workspace: document.getElementById('adminWorkspace'),
    loginForm: document.getElementById('adminLoginForm'),
    loginStatus: document.getElementById('adminLoginStatus'),
    profileChip: document.getElementById('adminProfileChip'),
    metrics: document.getElementById('adminMetrics'),
    recentSessions: document.getElementById('adminRecentSessions'),
    teacherList: document.getElementById('adminTeacherList'),
    teacherForm: document.getElementById('adminTeacherForm'),
    teacherStatus: document.getElementById('adminTeacherStatus'),
    teacherImportForm: document.getElementById('adminTeacherImportForm'),
    teacherImportStatus: document.getElementById('adminTeacherImportStatus'),
    teacherImportResults: document.getElementById('adminTeacherImportResults'),
    topicStudio: document.getElementById('adminTopicStudio'),
    topicForm: document.getElementById('adminTopicForm'),
    topicFormTitle: document.getElementById('topicFormTitle'),
    topicStatus: document.getElementById('adminTopicStatus'),
    topicResetButton: document.getElementById('adminTopicResetButton'),
    scenarioForm: document.getElementById('adminScenarioForm'),
    scenarioStatus: document.getElementById('adminScenarioStatus'),
    scenarioFormTitle: document.getElementById('scenarioFormTitle'),
    scenarioTopicSelect: document.getElementById('adminScenarioTopicSelect'),
    stepEditorList: document.getElementById('adminStepEditorList'),
    addStepButton: document.getElementById('adminAddStepButton'),
    scenarioResetButton: document.getElementById('adminScenarioResetButton'),
    refreshButton: document.getElementById('adminRefreshButton'),
    logoutButton: document.getElementById('adminLogoutButton'),
    tabButtons: Array.from(document.querySelectorAll('[data-tab]')),
    tabDashboard: document.getElementById('adminTabDashboard'),
    tabTeachers: document.getElementById('adminTabTeachers'),
    tabTopics: document.getElementById('adminTabTopics'),
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

  function difficultyLabel(value) {
    const map = {
      BASIC: '基础',
      STANDARD: '标准',
      ADVANCED: '进阶',
    };
    return map[value] || value;
  }

  function statusLabel(value) {
    const map = {
      ACTIVE: '启用',
      INACTIVE: '停用',
      COMPLETED: '已完成',
      ENDED: '已结束',
    };
    return map[value] || value;
  }

  function renderTabs() {
    const map = {
      dashboard: nodes.tabDashboard,
      teachers: nodes.tabTeachers,
      topics: nodes.tabTopics,
    };

    nodes.tabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-tab') === state.activeTab;
      button.classList.toggle('active', isActive);
    });

    Object.entries(map).forEach(([key, node]) => {
      node.classList.toggle('visible', key === state.activeTab);
    });
  }

  function renderDashboard() {
    if (!state.dashboard) return;

    const items = [
      ['教师总数', state.dashboard.totalTeachers, '当前系统内可训练教师数量'],
      ['训练主题', state.dashboard.totalTopics, '可供配置与复用的主题总量'],
      ['训练场景', state.dashboard.totalScenarios, '所有主题下的场景数量'],
      ['训练记录', state.dashboard.totalSessions, `近 7 天活跃教师 ${state.dashboard.activeTeachersLast7Days}`],
    ];

    nodes.metrics.innerHTML = items
      .map(
        ([label, value, description]) => `
          <article class="metric-card">
            <p class="eyebrow">${escapeHtml(label)}</p>
            <strong>${escapeHtml(value)}</strong>
            <p>${escapeHtml(description)}</p>
          </article>
        `
      )
      .join('');

    const recentSessions = state.dashboard.recentSessions || [];
    if (!recentSessions.length) {
      nodes.recentSessions.innerHTML = renderEmptyState('最近还没有训练记录。');
      return;
    }

    nodes.recentSessions.innerHTML = recentSessions
      .map(
        (session) => `
          <article class="activity-card">
            <p class="eyebrow">${escapeHtml(statusLabel(session.status))}</p>
            <h3>${escapeHtml(session.teacherName)}</h3>
            <p>训练场景：${escapeHtml(session.scenarioTitle)}</p>
            <div class="row-actions">
              <div class="chip-row">
                <span class="chip">开始于 ${escapeHtml(formatDate(session.startedAt))}</span>
                <span class="chip-warn">得分 ${escapeHtml(session.score ?? '--')}</span>
              </div>
            </div>
          </article>
        `
      )
      .join('');
  }

  function renderTeachers() {
    if (!state.users.length) {
      nodes.teacherList.innerHTML = renderEmptyState('当前还没有账号。');
      return;
    }

    nodes.teacherList.innerHTML = state.users
      .map(
        (user) => `
          <article class="teacher-card">
            <p class="eyebrow">${escapeHtml(formatRole(user.role))}</p>
            <h3>${escapeHtml(user.displayName || user.username)}</h3>
            <p>账号：${escapeHtml(user.username)}</p>
            <div class="row-actions">
              <div class="chip-row">
                <span class="${user.isActive ? 'chip-good' : 'chip-warn'}">${user.isActive ? '启用中' : '已停用'}</span>
                <span class="chip">训练 ${escapeHtml(user.sessionCount)}</span>
                <span class="chip">均分 ${escapeHtml(user.averageScore ?? '--')}</span>
              </div>
              ${
                user.role === 'TEACHER'
                  ? `
                    <button
                      class="secondary-btn compact-btn"
                      type="button"
                      data-toggle-user="${escapeHtml(user.id)}"
                      data-next-active="${user.isActive ? 'false' : 'true'}"
                    >
                      ${user.isActive ? '停用' : '启用'}
                    </button>
                  `
                  : ''
              }
            </div>
          </article>
        `
      )
      .join('');

    nodes.teacherList.querySelectorAll('[data-toggle-user]').forEach((button) => {
      button.addEventListener('click', async () => {
        const userId = button.getAttribute('data-toggle-user');
        const isActive = button.getAttribute('data-next-active') === 'true';
        await api(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive }),
        });
        await Promise.all([loadUsers(), loadDashboard()]);
      });
    });
  }

  function parseTeacherImportRows(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^账号[\s,，\t]+姓名[\s,，\t]+/.test(line))
      .map((line, index) => {
        const columns = line
          .split(/\t|,|，/)
          .map((column) => column.trim())
          .filter(Boolean);

        if (columns.length !== 3) {
          throw new Error(`第 ${index + 1} 行格式不正确，请使用：账号,姓名,初始密码`);
        }

        return {
          username: columns[0],
          displayName: columns[1],
          password: columns[2],
        };
      });
  }

  function renderTeacherImportResults(results) {
    if (!results.length) {
      nodes.teacherImportResults.innerHTML = '';
      return;
    }

    nodes.teacherImportResults.innerHTML = results
      .map(
        (result) => `
          <article class="import-result-card">
            <div class="row-actions">
              <div>
                <p class="eyebrow">${escapeHtml(result.status === 'CREATED' ? 'Created' : 'Skipped')}</p>
                <h3>${escapeHtml(result.displayName || result.username)}</h3>
                <p>账号：${escapeHtml(result.username)}</p>
              </div>
              <span class="${result.status === 'CREATED' ? 'chip-good' : 'chip-warn'}">
                ${escapeHtml(result.status === 'CREATED' ? '已创建' : result.reason || '已跳过')}
              </span>
            </div>
          </article>
        `
      )
      .join('');
  }

  function renderTopicStudio() {
    if (!state.topics.length) {
      nodes.topicStudio.innerHTML = renderEmptyState('还没有主题，先在右侧创建一个主题。');
      return;
    }

    nodes.topicStudio.innerHTML = state.topics
      .map(
        (topic) => `
          <div class="topic-block">
            <article class="topic-card">
              <div class="row-actions">
                <div>
                  <p class="eyebrow">${escapeHtml(statusLabel(topic.status))}</p>
                  <h3>${escapeHtml(topic.title)}</h3>
                </div>
                <div class="chip-row">
                  <span class="chip">场景 ${escapeHtml(topic.scenarioCount)}</span>
                  <button class="secondary-btn compact-btn" type="button" data-edit-topic="${escapeHtml(topic.id)}">
                    编辑主题
                  </button>
                  <button class="secondary-btn compact-btn" type="button" data-delete-topic="${escapeHtml(topic.id)}">
                    删除主题
                  </button>
                </div>
              </div>
              <p>${escapeHtml(topic.description)}</p>
            </article>
            <div class="scenario-list">
              ${topic.scenarios
                .map(
                  (scenario) => `
                    <article class="scenario-card">
                      <div class="scenario-actions">
                        <div>
                          <p class="eyebrow">${escapeHtml(difficultyLabel(scenario.difficulty))} · ${escapeHtml(
                            statusLabel(scenario.status)
                          )}</p>
                          <h3>${escapeHtml(scenario.title)}</h3>
                        </div>
                        <div class="chip-row">
                          <button
                            class="secondary-btn compact-btn"
                            type="button"
                            data-edit-scenario="${escapeHtml(scenario.id)}"
                          >
                            编辑场景
                          </button>
                          <button
                            class="secondary-btn compact-btn"
                            type="button"
                            data-delete-scenario="${escapeHtml(scenario.id)}"
                          >
                            删除场景
                          </button>
                        </div>
                      </div>
                      <p>${escapeHtml(scenario.description)}</p>
                      <div class="chip-row">
                        ${scenario.steps
                          .map(
                            (step) => `
                              <span class="chip-warn">Step ${escapeHtml(step.order)} · ${escapeHtml(step.title)}</span>
                            `
                          )
                          .join('')}
                      </div>
                    </article>
                  `
                )
                .join('')}
            </div>
          </div>
        `
      )
      .join('');

    nodes.topicStudio.querySelectorAll('[data-edit-topic]').forEach((button) => {
      button.addEventListener('click', () => {
        fillTopicForm(button.getAttribute('data-edit-topic'));
      });
    });

    nodes.topicStudio.querySelectorAll('[data-delete-topic]').forEach((button) => {
      button.addEventListener('click', async () => {
        const topicId = button.getAttribute('data-delete-topic');
        if (!confirm('确认删除该主题？如果主题下仍有场景，系统会阻止删除。')) return;
        await api(`/api/admin/topics/${topicId}`, { method: 'DELETE' });
        await Promise.all([loadTopics(), loadDashboard()]);
      });
    });

    nodes.topicStudio.querySelectorAll('[data-edit-scenario]').forEach((button) => {
      button.addEventListener('click', () => {
        fillScenarioForm(button.getAttribute('data-edit-scenario'));
      });
    });

    nodes.topicStudio.querySelectorAll('[data-delete-scenario]').forEach((button) => {
      button.addEventListener('click', async () => {
        const scenarioId = button.getAttribute('data-delete-scenario');
        if (!confirm('确认删除该场景？')) return;
        await api(`/api/admin/scenarios/${scenarioId}`, { method: 'DELETE' });
        await Promise.all([loadTopics(), loadDashboard()]);
      });
    });
  }

  function refreshScenarioTopicSelect() {
    nodes.scenarioTopicSelect.innerHTML = state.topics
      .map((topic) => `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</option>`)
      .join('');
  }

  function createStepEditorRow(step) {
    const stepData = step || { order: 1, title: '', objectionText: '', evaluationFocus: '' };
    const row = document.createElement('div');
    row.className = 'step-editor-card';
    row.innerHTML = `
      <div class="step-editor-head">
        <h3>步骤 ${escapeHtml(stepData.order)}</h3>
        <button class="secondary-btn compact-btn" type="button">移除</button>
      </div>
      <div class="form-grid">
        <label>
          <span>顺序</span>
          <input type="number" name="order" min="1" value="${escapeHtml(stepData.order)}" />
        </label>
        <label>
          <span>步骤标题</span>
          <input
            type="text"
            name="title"
            value="${escapeHtml(stepData.title)}"
            placeholder="第一异议：价格偏高"
          />
        </label>
      </div>
      <label>
        <span>异议内容</span>
        <textarea name="objectionText" placeholder="你们课程有点贵。">${escapeHtml(stepData.objectionText)}</textarea>
      </label>
      <label>
        <span>点评关注点</span>
        <textarea name="evaluationFocus" placeholder="先共情，再解释价值，最后推动下一步。">${escapeHtml(
          stepData.evaluationFocus
        )}</textarea>
      </label>
    `;

    row.querySelector('button').addEventListener('click', () => {
      row.remove();
      ensureStepRows();
      renumberStepRows();
    });

    return row;
  }

  function ensureStepRows() {
    if (!nodes.stepEditorList.children.length) {
      nodes.stepEditorList.appendChild(createStepEditorRow());
    }
  }

  function renumberStepRows() {
    Array.from(nodes.stepEditorList.children).forEach((row, index) => {
      const orderInput = row.querySelector('[name="order"]');
      const titleNode = row.querySelector('.step-editor-head h3');
      if (orderInput && !orderInput.value) {
        orderInput.value = String(index + 1);
      }
      if (titleNode) {
        titleNode.textContent = `步骤 ${index + 1}`;
      }
    });
  }

  function collectStepRows() {
    return Array.from(nodes.stepEditorList.children).map((row) => ({
      order: Number(row.querySelector('[name="order"]').value),
      title: row.querySelector('[name="title"]').value.trim(),
      objectionText: row.querySelector('[name="objectionText"]').value.trim(),
      evaluationFocus: row.querySelector('[name="evaluationFocus"]').value.trim(),
    }));
  }

  function resetTopicForm() {
    state.editingTopicId = '';
    nodes.topicForm.reset();
    nodes.topicForm.querySelector('[name="topicId"]').value = '';
    nodes.topicFormTitle.textContent = '新增主题';
    nodes.topicStatus.textContent = '';
    nodes.topicForm.querySelector('[name="status"]').value = 'ACTIVE';
  }

  function resetScenarioForm() {
    state.editingScenarioId = '';
    nodes.scenarioForm.reset();
    nodes.scenarioForm.querySelector('[name="scenarioId"]').value = '';
    nodes.scenarioFormTitle.textContent = '新增场景';
    nodes.scenarioStatus.textContent = '';
    nodes.stepEditorList.innerHTML = '';
    nodes.stepEditorList.appendChild(createStepEditorRow());
    if (state.topics.length) {
      nodes.scenarioTopicSelect.value = state.topics[0].id;
    }
  }

  function fillTopicForm(topicId) {
    const topic = state.topics.find((item) => item.id === topicId);
    if (!topic) return;

    state.editingTopicId = topic.id;
    nodes.topicFormTitle.textContent = `编辑主题 · ${topic.title}`;
    nodes.topicForm.querySelector('[name="topicId"]').value = topic.id;
    nodes.topicForm.querySelector('[name="title"]').value = topic.title;
    nodes.topicForm.querySelector('[name="description"]').value = topic.description;
    nodes.topicForm.querySelector('[name="status"]').value = topic.status;
    nodes.topicStatus.textContent = '已载入主题，可直接修改并保存。';
    state.activeTab = 'topics';
    renderTabs();
  }

  function fillScenarioForm(scenarioId) {
    for (const topic of state.topics) {
      const scenario = topic.scenarios.find((item) => item.id === scenarioId);
      if (!scenario) continue;

      state.editingScenarioId = scenario.id;
      nodes.scenarioFormTitle.textContent = `编辑场景 · ${scenario.title}`;
      nodes.scenarioForm.querySelector('[name="scenarioId"]').value = scenario.id;
      nodes.scenarioForm.querySelector('[name="topicId"]').value = topic.id;
      nodes.scenarioForm.querySelector('[name="title"]').value = scenario.title;
      nodes.scenarioForm.querySelector('[name="description"]').value = scenario.description;
      nodes.scenarioForm.querySelector('[name="parentPersona"]').value = scenario.parentPersona;
      nodes.scenarioForm.querySelector('[name="openingLine"]').value = scenario.openingLine;
      nodes.scenarioForm.querySelector('[name="difficulty"]').value = scenario.difficulty;
      nodes.scenarioForm.querySelector('[name="status"]').value = scenario.status;
      nodes.stepEditorList.innerHTML = '';
      scenario.steps.forEach((step) => {
        nodes.stepEditorList.appendChild(createStepEditorRow(step));
      });
      renumberStepRows();
      state.activeTab = 'topics';
      renderTabs();
      return;
    }
  }

  async function loadProfile() {
    state.profile = await api('/api/admin/me');
    nodes.profileChip.textContent = `${state.profile.displayName || state.profile.username} · ${formatRole(
      state.profile.role
    )}`;
  }

  async function loadDashboard() {
    state.dashboard = await api('/api/admin/dashboard');
    renderDashboard();
  }

  async function loadUsers() {
    state.users = await api('/api/admin/users');
    renderTeachers();
  }

  async function loadTopics() {
    state.topics = await api('/api/admin/topics');
    refreshScenarioTopicSelect();
    renderTopicStudio();
    if (!state.editingTopicId) {
      resetTopicForm();
    }
    if (!state.editingScenarioId) {
      resetScenarioForm();
    }
  }

  async function refreshAll() {
    await Promise.all([loadProfile(), loadDashboard(), loadUsers(), loadTopics()]);
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

      if (result.user.role !== 'TRAINER') {
        throw new Error('当前账号不是培训主管，无法进入管理台。');
      }

      setToken(result.token);
      toggleApp(true);
      nodes.loginStatus.textContent = '';
      await refreshAll();
    } catch (error) {
      nodes.loginStatus.textContent = error.message;
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    nodes.teacherStatus.textContent = '正在创建...';
    const formData = new FormData(nodes.teacherForm);

    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: String(formData.get('username') || ''),
          displayName: String(formData.get('displayName') || ''),
          password: String(formData.get('password') || ''),
          role: String(formData.get('role') || 'TEACHER'),
        }),
      });
      nodes.teacherForm.reset();
      nodes.teacherStatus.textContent = '账号创建成功。';
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (error) {
      nodes.teacherStatus.textContent = error.message;
    }
  }

  async function handleImportTeachers(event) {
    event.preventDefault();
    nodes.teacherImportStatus.textContent = '正在解析导入内容...';
    nodes.teacherImportResults.innerHTML = '';

    try {
      const formData = new FormData(nodes.teacherImportForm);
      const users = parseTeacherImportRows(formData.get('users'));

      if (!users.length) {
        throw new Error('请先粘贴需要导入的教师账号。');
      }

      nodes.teacherImportStatus.textContent = `正在导入 ${users.length} 个教师账号...`;
      const result = await api('/api/admin/users/import', {
        method: 'POST',
        body: JSON.stringify({ users }),
      });

      nodes.teacherImportStatus.textContent = `导入完成：成功 ${result.created} 个，跳过 ${result.skipped} 个。`;
      renderTeacherImportResults(result.results || []);
      nodes.teacherImportForm.reset();
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (error) {
      nodes.teacherImportStatus.textContent = error.message;
    }
  }

  async function handleSaveTopic(event) {
    event.preventDefault();
    nodes.topicStatus.textContent = '正在保存...';
    const formData = new FormData(nodes.topicForm);
    const payload = {
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || ''),
      status: String(formData.get('status') || 'ACTIVE'),
    };

    try {
      if (state.editingTopicId) {
        await api(`/api/admin/topics/${state.editingTopicId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        nodes.topicStatus.textContent = '主题已更新。';
      } else {
        await api('/api/admin/topics', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        nodes.topicStatus.textContent = '主题创建成功。';
      }

      await Promise.all([loadTopics(), loadDashboard()]);
      resetTopicForm();
    } catch (error) {
      nodes.topicStatus.textContent = error.message;
    }
  }

  async function handleSaveScenario(event) {
    event.preventDefault();
    nodes.scenarioStatus.textContent = '正在保存...';
    const formData = new FormData(nodes.scenarioForm);
    const payload = {
      topicId: String(formData.get('topicId') || ''),
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || ''),
      parentPersona: String(formData.get('parentPersona') || ''),
      openingLine: String(formData.get('openingLine') || ''),
      difficulty: String(formData.get('difficulty') || 'STANDARD'),
      status: String(formData.get('status') || 'ACTIVE'),
      steps: collectStepRows(),
    };

    try {
      if (state.editingScenarioId) {
        await api(`/api/admin/scenarios/${state.editingScenarioId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        nodes.scenarioStatus.textContent = '场景已更新。';
      } else {
        await api('/api/admin/scenarios', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        nodes.scenarioStatus.textContent = '场景创建成功。';
      }

      await Promise.all([loadTopics(), loadDashboard()]);
      resetScenarioForm();
    } catch (error) {
      nodes.scenarioStatus.textContent = error.message;
    }
  }

  async function bootstrap() {
    nodes.loginForm.addEventListener('submit', handleLogin);
    nodes.teacherForm.addEventListener('submit', handleCreateUser);
    nodes.teacherImportForm.addEventListener('submit', handleImportTeachers);
    nodes.topicForm.addEventListener('submit', handleSaveTopic);
    nodes.scenarioForm.addEventListener('submit', handleSaveScenario);
    nodes.topicResetButton.addEventListener('click', resetTopicForm);
    nodes.scenarioResetButton.addEventListener('click', resetScenarioForm);
    nodes.addStepButton.addEventListener('click', () => {
      nodes.stepEditorList.appendChild(
        createStepEditorRow({
          order: nodes.stepEditorList.children.length + 1,
          title: '',
          objectionText: '',
          evaluationFocus: '',
        })
      );
      renumberStepRows();
    });
    nodes.refreshButton.addEventListener('click', refreshAll);
    nodes.logoutButton.addEventListener('click', () => {
      setToken('');
      state.profile = null;
      state.dashboard = null;
      state.users = [];
      state.topics = [];
      state.editingTopicId = '';
      state.editingScenarioId = '';
      resetTopicForm();
      resetScenarioForm();
      toggleApp(false);
    });

    nodes.tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.getAttribute('data-tab');
        renderTabs();
      });
    });

    ensureStepRows();
    renderTabs();

    if (!state.token) {
      toggleApp(false);
      return;
    }

    try {
      toggleApp(true);
      await refreshAll();
    } catch (error) {
      console.error(error);
      setToken('');
      toggleApp(false);
    }
  }

  bootstrap();
})();
