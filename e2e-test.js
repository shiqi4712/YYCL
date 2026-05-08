const http = require('http')

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

;(async () => {
  const failures = []
  const ok = (label) => console.log('  OK:', label)
  const fail = (label, detail) => { console.log('  FAIL:', label, detail); failures.push(label) }

  // 1. Login
  let login
  try {
    login = await request({ hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ username: 'admin', password: 'admin123' }))
    if (login.code === 0 && login.data.token) ok('Login admin')
    else fail('Login admin', login)
  } catch (e) { fail('Login admin', e.message) }

  const token = login?.data?.token || ''
  const authHeader = { Authorization: 'Bearer ' + token }

  // 2. List teachers
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/users/teachers', method: 'GET', headers: authHeader })
    if (res.code === 0) ok('List teachers (' + res.data.length + ')')
    else fail('List teachers', res)
  } catch (e) { fail('List teachers', e.message) }

  // 3. Create teacher
  let teacherId
  const uniqueTeacherName = 'e2e_t_' + Date.now()
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/users/teachers', method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' } }, JSON.stringify({ username: uniqueTeacherName, password: 'pass123', realName: 'E2E老师' }))
    if (res.code === 0) { ok('Create teacher'); teacherId = res.data.id }
    else fail('Create teacher', res)
  } catch (e) { fail('Create teacher', e.message) }

  // 4. Update teacher status
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/users/teachers/' + teacherId, method: 'PUT', headers: { ...authHeader, 'Content-Type': 'application/json' } }, JSON.stringify({ status: 'DISABLED' }))
    if (res.code === 0 && res.data.status === 'DISABLED') ok('Update teacher status')
    else fail('Update teacher status', res)
  } catch (e) { fail('Update teacher status', e.message) }

  // 5. List scenarios
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/scenarios', method: 'GET', headers: authHeader })
    if (res.code === 0) ok('List scenarios (' + res.data.length + ')')
    else fail('List scenarios', res)
  } catch (e) { fail('List scenarios', e.message) }

  // 6. Create scenario
  let scenarioId
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/scenarios', method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' } }, JSON.stringify({ title: 'E2E测试场景', category: 'PRICE', difficulty: 'EASY', parentProfile: 'E2E家长画像', initialMessage: 'E2E初始话术' }))
    if (res.code === 0) { ok('Create scenario'); scenarioId = res.data.id }
    else fail('Create scenario', res)
  } catch (e) { fail('Create scenario', e.message) }

  // 7. Update scenario status
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/scenarios/' + scenarioId + '/status', method: 'PATCH', headers: { ...authHeader, 'Content-Type': 'application/json' } }, JSON.stringify({ status: 'INACTIVE' }))
    if (res.code === 0) ok('Update scenario status')
    else fail('Update scenario status', res)
  } catch (e) { fail('Update scenario status', e.message) }

  // 8. Delete scenario
  try {
    const res = await request({ hostname: 'localhost', port: 3001, path: '/api/scenarios/' + scenarioId, method: 'DELETE', headers: authHeader })
    if (res.code === 0) ok('Delete scenario')
    else fail('Delete scenario', res)
  } catch (e) { fail('Delete scenario', e.message) }

  // 9. Backend-AI with valid token (create chat session)
  try {
    const res = await request({ hostname: 'localhost', port: 3002, path: '/api/chat/sessions', method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' } }, JSON.stringify({ scenarioId: 1 }))
    if (res.code === 0 && res.data && res.data.sessionId) ok('Backend-AI create session')
    else fail('Backend-AI create session', res)
  } catch (e) { fail('Backend-AI create session', e.message) }

  // 10. Backend-Data stats
  try {
    const res = await request({ hostname: 'localhost', port: 3003, path: '/api/stats/teacher/overview', method: 'GET' })
    if (res.code === 0 || res.code === 200) ok('Backend-Data teacher overview')
    else fail('Backend-Data teacher overview', res)
  } catch (e) { fail('Backend-Data teacher overview', e.message) }

  // 11. Backend-Data team report
  try {
    const res = await request({ hostname: 'localhost', port: 3003, path: '/api/stats/team/report', method: 'GET' })
    if (res.code === 0 || res.code === 200) ok('Backend-Data team report')
    else fail('Backend-Data team report', res)
  } catch (e) { fail('Backend-Data team report', e.message) }

  console.log('\n' + (failures.length === 0 ? 'All E2E tests passed!' : failures.length + ' test(s) failed: ' + failures.join(', ')))
  process.exit(failures.length === 0 ? 0 : 1)
})()
