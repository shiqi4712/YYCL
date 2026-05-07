import client from './client'

export function getTeachers() {
  return client.get('/users/teachers')
}

export function createTeacher(data: { username: string; password: string; realName?: string }) {
  return client.post('/users/teachers', data)
}

export function updateTeacherStatus(id: number, status: string) {
  return client.put(`/users/teachers/${id}`, { status })
}
