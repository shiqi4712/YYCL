import { z } from 'zod'
import { hashPassword } from '../lib/auth'
import { normalizeSopText } from '../lib/document-parser'
import { prisma } from '../lib/prisma'
import type { AuthUser } from '../types'
import { HttpError } from '../utils/http-error'

const roleSchema = z.enum(['TRAINER', 'TEACHER'])
const difficultySchema = z.enum(['BASIC', 'STANDARD', 'ADVANCED'])
const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])
const trainingModuleSchema = z.enum(['PRE_CLASS'])

const userCreateSchema = z.object({
  username: z.string().min(3).max(24),
  password: z.string().min(6).max(64),
  displayName: z.string().min(1).max(40),
  role: roleSchema.default('TEACHER'),
  teamId: z.string().min(1).optional(),
})

const teacherBulkImportSchema = z.object({
  users: z.array(
    userCreateSchema.omit({ role: true, teamId: true }).extend({
      teamName: z.string().min(1).max(191),
    })
  ).min(1).max(200),
})

const teamCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
})

const userTeamSchema = z.object({
  teamId: z.string().min(1),
})

const topicCreateSchema = z.object({
  trainingModule: trainingModuleSchema.default('PRE_CLASS'),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  sopContent: z.string().max(50000).optional(),
  status: statusSchema.default('ACTIVE'),
})

const topicSopSchema = z.object({
  sopContent: z.string().min(1).max(50000),
})

const scenarioStepSchema = z.object({
  id: z.string().optional(),
  order: z.number().int().min(1).max(20),
  title: z.string().min(1).max(60),
  objectionText: z.string().min(1).max(200),
  evaluationFocus: z.string().min(1).max(200),
})

const scenarioCreateSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  parentPersona: z.string().min(1).max(500),
  openingLine: z.string().min(1).max(300),
  difficulty: difficultySchema,
  status: statusSchema.default('ACTIVE'),
  steps: z.array(scenarioStepSchema).min(1).max(12),
})

const scenarioBulkImportSchema = z.object({
  topicId: z.string().min(1),
  scenarios: z.array(scenarioCreateSchema.omit({ topicId: true })).min(1).max(100),
})

const scenarioBulkDeleteSchema = z.object({
  scenarioIds: z.array(z.string().min(1)).min(1).max(100),
})

function sortSteps<T extends { order: number }>(steps: T[]) {
  return [...steps].sort((a, b) => a.order - b.order)
}

function parseReviewMeta(tagsJson: string) {
  const fallback = { tags: [] as string[], dimensions: null as unknown }

  try {
    const parsed = JSON.parse(tagsJson)
    if (Array.isArray(parsed)) {
      return { tags: parsed, dimensions: null }
    }
    return {
      tags: Array.isArray(parsed?.tags) ? parsed.tags : [],
      dimensions: parsed?.dimensions ?? null,
    }
  } catch {
    return fallback
  }
}

function requireSuperAdmin(actor: AuthUser) {
  if (!actor.isSuperAdmin) {
    throw new HttpError(403, '仅超级管理员可以执行该操作')
  }
}

function requireTeamAdmin(actor: AuthUser) {
  if (!actor.isSuperAdmin && !actor.teamId) {
    throw new HttpError(403, '当前管理员尚未配置所属团队，请联系超级管理员')
  }
}

function canManageUser(
  actor: AuthUser,
  user: { username?: string; role: string; teamId: string | null; isSuperAdmin: boolean }
) {
  if (actor.isSuperAdmin) return !user.isSuperAdmin && user.username !== 'shiqi'
  return user.role === 'TEACHER' && Boolean(actor.teamId) && user.teamId === actor.teamId
}

function mapTopic(topic: {
  id: string
  trainingModule: string
  title: string
  description: string
  sopContent: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  scenarios: Array<{
    id: string
    title: string
    description: string
    parentPersona: string
    openingLine: string
    difficulty: string
    status: string
    createdAt: Date
    updatedAt: Date
    steps: Array<{
      id: string
      order: number
      title: string
      objectionText: string
      evaluationFocus: string
      createdAt: Date
    }>
  }>
}) {
  return {
    id: topic.id,
    trainingModule: topic.trainingModule,
    title: topic.title,
    description: topic.description,
    sopContent: topic.sopContent,
    status: topic.status,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
    scenarioCount: topic.scenarios.length,
    scenarios: topic.scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      parentPersona: scenario.parentPersona,
      openingLine: scenario.openingLine,
      difficulty: scenario.difficulty,
      status: scenario.status,
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
      steps: sortSteps(scenario.steps).map((step) => ({
        id: step.id,
        order: step.order,
        title: step.title,
        objectionText: step.objectionText,
        evaluationFocus: step.evaluationFocus,
        createdAt: step.createdAt,
      })),
    })),
  }
}

export async function getCurrentUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      role: true,
      displayName: true,
      teamId: true,
      isSuperAdmin: true,
      isActive: true,
      createdAt: true,
      team: { select: { name: true } },
    },
  })

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  return {
    ...user,
    teamName: user.team?.name ?? null,
    isSuperAdmin: user.isSuperAdmin || user.username === 'shiqi',
  }
}

export async function listTeams(actor: AuthUser) {
  requireTeamAdmin(actor)
  const teams = await prisma.team.findMany({
    where: actor.isSuperAdmin ? undefined : { id: actor.teamId! },
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        where: { deletedAt: null },
        select: { role: true },
      },
    },
  })

  return teams.map((team: (typeof teams)[number]) => ({
    id: team.id,
    name: team.name,
    isActive: team.isActive,
    teacherCount: team.users.filter((user: (typeof team.users)[number]) => user.role === 'TEACHER').length,
    adminCount: team.users.filter((user: (typeof team.users)[number]) => user.role === 'TRAINER').length,
    createdAt: team.createdAt,
  }))
}

export async function createTeam(actor: AuthUser, payload: unknown) {
  requireSuperAdmin(actor)
  const input = teamCreateSchema.parse(payload)
  const existing = await prisma.team.findUnique({ where: { name: input.name } })
  if (existing) {
    throw new HttpError(409, '团队名称已存在')
  }

  return prisma.team.create({
    data: { name: input.name },
    select: { id: true, name: true, isActive: true, createdAt: true },
  })
}

export async function listUsers(actor: AuthUser, role?: string) {
  requireTeamAdmin(actor)
  if (role) {
    roleSchema.parse(role)
  }

  const effectiveRole = actor.isSuperAdmin ? role : 'TEACHER'
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(effectiveRole ? { role: effectiveRole } : {}),
      ...(actor.isSuperAdmin ? {} : { teamId: actor.teamId! }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      team: { select: { id: true, name: true } },
      sessions: {
        select: { id: true, status: true, totalScore: true, startedAt: true },
      },
    },
  })

  return users.map((user: (typeof users)[number]) => {
    const scored = user.sessions.filter(
      (session: (typeof user.sessions)[number]) => typeof session.totalScore === 'number'
    )
    const averageScore = scored.length
      ? Math.round(
          scored.reduce(
            (sum: number, session: (typeof scored)[number]) => sum + (session.totalScore ?? 0),
            0
          ) / scored.length
        )
      : null
    const completedCount = user.sessions.filter(
      (session: (typeof user.sessions)[number]) => session.status === 'COMPLETED'
    ).length
    const lastTrainedAt = [...user.sessions].sort(
      (a: (typeof user.sessions)[number], b: (typeof user.sessions)[number]) =>
        b.startedAt.getTime() - a.startedAt.getTime()
    )[0]?.startedAt ?? null

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      teamId: user.teamId,
      teamName: user.team?.name ?? null,
      isSuperAdmin: user.isSuperAdmin || user.username === 'shiqi',
      isActive: user.isActive,
      createdAt: user.createdAt,
      sessionCount: user.sessions.length,
      completedCount,
      scoredCount: scored.length,
      averageScore,
      lastTrainedAt,
    }
  })
}

export async function listTeacherTrainingSessions(actor: AuthUser, teacherId: string) {
  requireTeamAdmin(actor)
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, role: true, teamId: true, isSuperAdmin: true },
  })

  if (!teacher || teacher.role !== 'TEACHER' || !canManageUser(actor, teacher)) {
    throw new HttpError(404, 'Teacher not found')
  }

  const sessions = await prisma.trainingSession.findMany({
    where: { teacherId },
    orderBy: { startedAt: 'desc' },
    include: {
      scenario: {
        select: {
          title: true,
          topic: {
            select: { title: true },
          },
        },
      },
      review: {
        select: {
          overallScore: true,
          summary: true,
          strengths: true,
          weaknesses: true,
          nextAction: true,
          tagsJson: true,
          createdAt: true,
          stepReviews: {
            orderBy: { stepOrder: 'asc' },
            select: {
              stepOrder: true,
              stepTitle: true,
              score: true,
              verdict: true,
              strengths: true,
              issue: true,
              recommendation: true,
            },
          },
        },
      },
    },
  })

  return sessions.map((session: (typeof sessions)[number]) => {
    const reviewMeta = session.review ? parseReviewMeta(session.review.tagsJson) : null

    return {
      id: session.id,
      topicTitle: session.scenario.topic.title,
      scenarioTitle: session.scenario.title,
      status: session.status,
      score: session.review?.overallScore ?? session.totalScore ?? null,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      reviewedAt: session.review?.createdAt ?? null,
      review: session.review
        ? {
            summary: session.review.summary,
            strengths: session.review.strengths,
            weaknesses: session.review.weaknesses,
            nextAction: session.review.nextAction,
            tags: reviewMeta?.tags ?? [],
            dimensions: reviewMeta?.dimensions ?? null,
            steps: session.review.stepReviews,
          }
        : null,
    }
  })
}

export async function createUser(actor: AuthUser, payload: unknown) {
  requireTeamAdmin(actor)
  const input = userCreateSchema.parse(payload)
  const role = actor.isSuperAdmin ? input.role : 'TEACHER'
  const teamId = actor.isSuperAdmin ? input.teamId : actor.teamId

  if (!teamId) {
    throw new HttpError(400, '请选择账号所属团队')
  }
  if (!actor.isSuperAdmin && input.role === 'TRAINER') {
    throw new HttpError(403, '仅超级管理员可以创建团队管理员')
  }

  const team = await prisma.team.findFirst({ where: { id: teamId, isActive: true } })
  if (!team) {
    throw new HttpError(400, '所选团队不存在或已停用')
  }
  const existing = await prisma.user.findUnique({ where: { username: input.username } })

  if (existing) {
    throw new HttpError(409, 'Username already exists')
  }

  const passwordHash = await hashPassword(input.password)

  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash,
      role,
      displayName: input.displayName,
      teamId,
      isActive: true,
    },
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    teamId: user.teamId,
    teamName: team.name,
    isSuperAdmin: false,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

export async function importTeacherUsers(actor: AuthUser, payload: unknown) {
  requireTeamAdmin(actor)
  const input = teacherBulkImportSchema.parse(payload)
  const requestedTeamNames = Array.from(new Set(input.users.map((user) => user.teamName.trim())))
  const teams: Array<{ id: string; name: string }> = await prisma.team.findMany({
    where: { name: { in: requestedTeamNames }, isActive: true },
    select: { id: true, name: true },
  })
  const teamsByName = new Map<string, { id: string; name: string }>(
    teams.map((team) => [team.name.toLowerCase(), team])
  )
  const unknownTeams = requestedTeamNames.filter((name) => !teamsByName.has(name.toLowerCase()))
  if (unknownTeams.length) {
    throw new HttpError(400, `以下团队不存在或已停用：${unknownTeams.join('、')}`)
  }
  if (!actor.isSuperAdmin) {
    const actorTeamName = actor.teamName?.trim().toLowerCase()
    const mismatchedTeam = requestedTeamNames.find((name) => name.toLowerCase() !== actorTeamName)
    if (mismatchedTeam) {
      throw new HttpError(403, `只能导入所属团队“${actor.teamName}”的老师账号`)
    }
  }
  const seenUsernames = new Set<string>()
  const existingUsers = await prisma.user.findMany({
    where: {
      username: {
        in: input.users.map((user) => user.username),
      },
    },
    select: { username: true },
  })
  const existingUsernames = new Set<string>(
    existingUsers.map((user: (typeof existingUsers)[number]) => user.username)
  )
  const results: Array<{
    username: string
    displayName: string
    teamName: string
    status: 'CREATED' | 'SKIPPED'
    reason?: string
  }> = []

  for (const user of input.users) {
    if (seenUsernames.has(user.username)) {
      results.push({
        username: user.username,
        displayName: user.displayName,
        teamName: user.teamName,
        status: 'SKIPPED',
        reason: '导入内容中账号重复',
      })
      continue
    }

    seenUsernames.add(user.username)

    if (existingUsernames.has(user.username)) {
      results.push({
        username: user.username,
        displayName: user.displayName,
        teamName: user.teamName,
        status: 'SKIPPED',
        reason: '账号已存在',
      })
      continue
    }

    const passwordHash = await hashPassword(user.password)
    const team = teamsByName.get(user.teamName.trim().toLowerCase())!
    await prisma.user.create({
      data: {
        username: user.username,
        passwordHash,
        role: 'TEACHER',
        displayName: user.displayName,
        teamId: team.id,
        isActive: true,
      },
    })

    results.push({
      username: user.username,
      displayName: user.displayName,
      teamName: team.name,
      status: 'CREATED',
    })
  }

  return {
    total: results.length,
    created: results.filter((result) => result.status === 'CREATED').length,
    skipped: results.filter((result) => result.status === 'SKIPPED').length,
    results,
  }
}

export async function updateUserStatus(actor: AuthUser, userId: string, isActive: boolean) {
  requireTeamAdmin(actor)
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user || !canManageUser(actor, user)) {
    throw new HttpError(404, 'User not found')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  })

  return {
    id: updated.id,
    username: updated.username,
    role: updated.role,
    displayName: updated.displayName,
    isActive: updated.isActive,
  }
}

export async function updateUserTeam(actor: AuthUser, userId: string, payload: unknown) {
  requireSuperAdmin(actor)
  const input = userTeamSchema.parse(payload)
  const [user, team] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
    prisma.team.findFirst({ where: { id: input.teamId, isActive: true } }),
  ])
  if (!user || !canManageUser(actor, user)) {
    throw new HttpError(404, 'User not found')
  }
  if (!team) {
    throw new HttpError(400, '所选团队不存在或已停用')
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { teamId: team.id },
  })
  return {
    id: updated.id,
    teamId: team.id,
    teamName: team.name,
  }
}

export async function deleteUser(actor: AuthUser, userId: string) {
  requireTeamAdmin(actor)
  if (userId === actor.id) {
    throw new HttpError(400, '不能删除当前登录账号')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: { select: { id: true } },
    },
  })

  if (!user || user.deletedAt || !canManageUser(actor, user)) {
    throw new HttpError(404, 'User not found')
  }

  const deletedAt = new Date()
  const originalDisplayName = user.displayName || user.username
  await prisma.$transaction([
    prisma.trainingSession.updateMany({
      where: { teacherId: userId, status: 'ACTIVE' },
      data: { status: 'ENDED', endedAt: deletedAt },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        username: `deleted_${user.id}_${deletedAt.getTime()}`,
        displayName: `（已删除）${originalDisplayName}`.slice(0, 191),
        isActive: false,
        deletedAt,
      },
    }),
  ])

  return {
    id: userId,
    preservedTrainingRecords: user.sessions.length,
  }
}

export async function listTopicsForAdmin() {
  const topics = await prisma.trainingTopic.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      scenarios: {
        orderBy: { createdAt: 'desc' },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  return topics.map(mapTopic)
}

export async function createTopic(createdById: string, payload: unknown) {
  const input = topicCreateSchema.parse(payload)

  const topic = await prisma.trainingTopic.create({
    data: {
      trainingModule: input.trainingModule,
      title: input.title,
      description: input.description,
      sopContent: input.sopContent,
      status: input.status,
      createdById,
    },
    include: {
      scenarios: {
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  return mapTopic(topic)
}

export async function updateTopic(topicId: string, payload: unknown) {
  const input = topicCreateSchema.parse(payload)
  const existing = await prisma.trainingTopic.findUnique({ where: { id: topicId } })

  if (!existing) {
    throw new HttpError(404, 'Topic not found')
  }

  const topic = await prisma.trainingTopic.update({
    where: { id: topicId },
    data: {
      trainingModule: input.trainingModule,
      title: input.title,
      description: input.description,
      sopContent: input.sopContent,
      status: input.status,
    },
    include: {
      scenarios: {
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  return mapTopic(topic)
}

export async function updateTopicSop(topicId: string, payload: unknown) {
  const input = topicSopSchema.parse(payload)
  const existing = await prisma.trainingTopic.findUnique({ where: { id: topicId } })

  if (!existing) {
    throw new HttpError(404, 'Topic not found')
  }

  const topic = await prisma.trainingTopic.update({
    where: { id: topicId },
    data: {
      sopContent: normalizeSopText(input.sopContent),
    },
    include: {
      scenarios: {
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      },
    },
  })

  return mapTopic(topic)
}

export async function deleteTopic(topicId: string) {
  const topic = await prisma.trainingTopic.findUnique({
    where: { id: topicId },
    include: {
      scenarios: {
        include: {
          sessions: {
            select: { id: true },
          },
        },
      },
    },
  })

  if (!topic) {
    throw new HttpError(404, 'Topic not found')
  }

  const scenarioWithSessions = topic.scenarios.find(
    (scenario: (typeof topic.scenarios)[number]) => scenario.sessions.length > 0
  )
  if (scenarioWithSessions) {
    throw new HttpError(400, '该主题下已有训练记录，不能删除，可先下架相关场景')
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.trainingScenario.deleteMany({ where: { topicId } })
    await tx.trainingTopic.delete({ where: { id: topicId } })
  })

  return { id: topicId, deletedScenarios: topic.scenarios.length }
}

export async function createScenario(createdById: string, payload: unknown) {
  const input = scenarioCreateSchema.parse(payload)

  const topic = await prisma.trainingTopic.findUnique({ where: { id: input.topicId } })
  if (!topic) {
    throw new HttpError(404, 'Topic not found')
  }

  const scenario = await prisma.trainingScenario.create({
    data: {
      topicId: input.topicId,
      title: input.title,
      description: input.description,
      parentPersona: input.parentPersona,
      openingLine: input.openingLine,
      difficulty: input.difficulty,
      status: input.status,
      createdById,
      steps: {
        create: sortSteps(input.steps).map((step) => ({
          order: step.order,
          title: step.title,
          objectionText: step.objectionText,
          evaluationFocus: step.evaluationFocus,
        })),
      },
    },
    include: {
      topic: true,
      steps: { orderBy: { order: 'asc' } },
    },
  })

  return {
    id: scenario.id,
    topicId: scenario.topicId,
    title: scenario.title,
    description: scenario.description,
    parentPersona: scenario.parentPersona,
    openingLine: scenario.openingLine,
    difficulty: scenario.difficulty,
    status: scenario.status,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
    steps: scenario.steps,
  }
}

export async function importScenarios(createdById: string, payload: unknown) {
  const input = scenarioBulkImportSchema.parse(payload)
  const topic = await prisma.trainingTopic.findUnique({ where: { id: input.topicId } })

  if (!topic) {
    throw new HttpError(404, 'Topic not found')
  }

  const results: Array<{
    title: string
    status: 'CREATED'
    id: string
  }> = []

  await prisma.$transaction(async (tx: typeof prisma) => {
    for (const item of input.scenarios) {
      const scenario = await tx.trainingScenario.create({
        data: {
          topicId: input.topicId,
          title: item.title,
          description: item.description,
          parentPersona: item.parentPersona,
          openingLine: item.openingLine,
          difficulty: item.difficulty,
          status: item.status,
          createdById,
          steps: {
            create: sortSteps(item.steps).map((step) => ({
              order: step.order,
              title: step.title,
              objectionText: step.objectionText,
              evaluationFocus: step.evaluationFocus,
            })),
          },
        },
      })

      results.push({
        title: scenario.title,
        status: 'CREATED',
        id: scenario.id,
      })
    }
  })

  return {
    total: results.length,
    created: results.length,
    results,
  }
}

export async function updateScenario(scenarioId: string, payload: unknown) {
  const input = scenarioCreateSchema.parse(payload)
  const existing = await prisma.trainingScenario.findUnique({
    where: { id: scenarioId },
    include: { steps: true },
  })

  if (!existing) {
    throw new HttpError(404, 'Scenario not found')
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.trainingScenario.update({
      where: { id: scenarioId },
      data: {
        topicId: input.topicId,
        title: input.title,
        description: input.description,
        parentPersona: input.parentPersona,
        openingLine: input.openingLine,
        difficulty: input.difficulty,
        status: input.status,
      },
    })

    await tx.scenarioStep.deleteMany({
      where: { scenarioId },
    })

    await tx.scenarioStep.createMany({
      data: sortSteps(input.steps).map((step) => ({
        scenarioId,
        order: step.order,
        title: step.title,
        objectionText: step.objectionText,
        evaluationFocus: step.evaluationFocus,
      })),
    })
  })

  const updated = await prisma.trainingScenario.findUnique({
    where: { id: scenarioId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })

  if (!updated) {
    throw new HttpError(404, 'Scenario not found')
  }

  return {
    id: updated.id,
    topicId: updated.topicId,
    title: updated.title,
    description: updated.description,
    parentPersona: updated.parentPersona,
    openingLine: updated.openingLine,
    difficulty: updated.difficulty,
    status: updated.status,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    steps: updated.steps,
  }
}

export async function deleteScenario(scenarioId: string) {
  const scenario = await prisma.trainingScenario.findUnique({
    where: { id: scenarioId },
    include: {
      sessions: {
        select: { id: true },
      },
    },
  })
  if (!scenario) {
    throw new HttpError(404, 'Scenario not found')
  }

  if (scenario.sessions.length > 0) {
    throw new HttpError(400, '已有训练记录，不能删除该场景')
  }

  await prisma.trainingScenario.delete({ where: { id: scenarioId } })
  return { id: scenarioId }
}

export async function deleteScenarios(payload: unknown) {
  const input = scenarioBulkDeleteSchema.parse(payload)
  const scenarios = await prisma.trainingScenario.findMany({
    where: { id: { in: input.scenarioIds } },
    include: {
      sessions: {
        select: { id: true },
      },
    },
  })
  const scenarioMap = new Map<string, (typeof scenarios)[number]>(
    scenarios.map((scenario: (typeof scenarios)[number]) => [scenario.id, scenario])
  )
  const results: Array<{
    id: string
    title?: string
    status: 'DELETED' | 'SKIPPED'
    reason?: string
  }> = []
  const deletableIds: string[] = []

  for (const scenarioId of input.scenarioIds) {
    const scenario = scenarioMap.get(scenarioId)

    if (!scenario) {
      results.push({
        id: scenarioId,
        status: 'SKIPPED',
        reason: '场景不存在',
      })
      continue
    }

    if (scenario.sessions.length > 0) {
      results.push({
        id: scenario.id,
        title: scenario.title,
        status: 'SKIPPED',
        reason: '已有训练记录，未删除',
      })
      continue
    }

    deletableIds.push(scenario.id)
    results.push({
      id: scenario.id,
      title: scenario.title,
      status: 'DELETED',
    })
  }

  if (deletableIds.length > 0) {
    await prisma.trainingScenario.deleteMany({
      where: { id: { in: deletableIds } },
    })
  }

  return {
    total: results.length,
    deleted: results.filter((result) => result.status === 'DELETED').length,
    skipped: results.filter((result) => result.status === 'SKIPPED').length,
    results,
  }
}

export async function getDashboardSummary(actor: AuthUser) {
  requireTeamAdmin(actor)
  const teacherWhere = {
    role: 'TEACHER',
    deletedAt: null,
    ...(actor.isSuperAdmin ? {} : { teamId: actor.teamId! }),
  }
  const sessionWhere = actor.isSuperAdmin ? {} : { teacher: { teamId: actor.teamId! } }
  const [totalTeachers, totalTopics, totalScenarios, totalSessions, teacherUsers] = await Promise.all([
    prisma.user.count({ where: teacherWhere }),
    prisma.trainingTopic.count(),
    prisma.trainingScenario.count(),
    prisma.trainingSession.count({ where: sessionWhere }),
    prisma.user.findMany({
      where: teacherWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalScore: true,
            startedAt: true,
            endedAt: true,
            review: {
              select: { overallScore: true },
            },
          },
        },
      },
    }),
  ])

  const activeTeachers = await prisma.trainingSession.groupBy({
    by: ['teacherId'],
    where: {
      ...sessionWhere,
      startedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  const teacherStats = teacherUsers.map((teacher: (typeof teacherUsers)[number]) => {
    const scoredSessions = teacher.sessions.filter(
      (session: (typeof teacher.sessions)[number]) =>
        typeof session.review?.overallScore === 'number' || typeof session.totalScore === 'number'
    )
    const completedSessions = teacher.sessions.filter(
      (session: (typeof teacher.sessions)[number]) => session.status === 'COMPLETED'
    )
    const averageScore = scoredSessions.length
      ? Math.round(
          scoredSessions.reduce(
            (sum: number, session: (typeof scoredSessions)[number]) =>
              sum + (session.review?.overallScore ?? session.totalScore ?? 0),
            0
          ) / scoredSessions.length
        )
      : null

    return {
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.displayName || teacher.username,
      practiceCount: teacher.sessions.length,
      completedCount: completedSessions.length,
      averageScore,
      lastTrainedAt: teacher.sessions[0]?.startedAt ?? null,
    }
  })

  const teamAverageScore = (() => {
    const scored = teacherStats.filter(
      (teacher: (typeof teacherStats)[number]) => typeof teacher.averageScore === 'number'
    )
    if (!scored.length) return null
    return Math.round(
      scored.reduce((sum: number, teacher: (typeof scored)[number]) => sum + (teacher.averageScore ?? 0), 0) /
        scored.length
    )
  })()

  return {
    totalTeachers,
    totalTopics,
    totalScenarios,
    totalSessions,
    teamAverageScore,
    activeTeachersLast7Days: activeTeachers.length,
    teacherStats,
  }
}
