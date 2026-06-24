import { z } from 'zod'
import { hashPassword } from '../lib/auth'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const roleSchema = z.enum(['TRAINER', 'TEACHER'])
const difficultySchema = z.enum(['BASIC', 'STANDARD', 'ADVANCED'])
const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])

const userCreateSchema = z.object({
  username: z.string().min(3).max(24),
  password: z.string().min(6).max(64),
  displayName: z.string().min(1).max(40),
  role: roleSchema.default('TEACHER'),
})

const teacherBulkImportSchema = z.object({
  users: z.array(userCreateSchema.omit({ role: true })).min(1).max(200),
})

const topicCreateSchema = z.object({
  title: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  status: statusSchema.default('ACTIVE'),
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
  parentPersona: z.string().min(1).max(40),
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

function mapTopic(topic: {
  id: string
  title: string
  description: string
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
    title: topic.title,
    description: topic.description,
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
      isActive: true,
      createdAt: true,
    },
  })

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  return user
}

export async function listUsers(role?: string) {
  if (role) {
    roleSchema.parse(role)
  }

  const users = await prisma.user.findMany({
    where: role ? { role } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      sessions: {
        select: { id: true, totalScore: true, startedAt: true },
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

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      sessionCount: user.sessions.length,
      averageScore,
    }
  })
}

export async function createUser(payload: unknown) {
  const input = userCreateSchema.parse(payload)
  const existing = await prisma.user.findUnique({ where: { username: input.username } })

  if (existing) {
    throw new HttpError(409, 'Username already exists')
  }

  const passwordHash = await hashPassword(input.password)

  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash,
      role: input.role,
      displayName: input.displayName,
      isActive: true,
    },
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }
}

export async function importTeacherUsers(payload: unknown) {
  const input = teacherBulkImportSchema.parse(payload)
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
    status: 'CREATED' | 'SKIPPED'
    reason?: string
  }> = []

  for (const user of input.users) {
    if (seenUsernames.has(user.username)) {
      results.push({
        username: user.username,
        displayName: user.displayName,
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
        status: 'SKIPPED',
        reason: '账号已存在',
      })
      continue
    }

    const passwordHash = await hashPassword(user.password)
    await prisma.user.create({
      data: {
        username: user.username,
        passwordHash,
        role: 'TEACHER',
        displayName: user.displayName,
        isActive: true,
      },
    })

    results.push({
      username: user.username,
      displayName: user.displayName,
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

export async function updateUserStatus(userId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
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
      title: input.title,
      description: input.description,
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
      title: input.title,
      description: input.description,
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

export async function deleteTopic(topicId: string) {
  const topic = await prisma.trainingTopic.findUnique({
    where: { id: topicId },
    include: { scenarios: true },
  })

  if (!topic) {
    throw new HttpError(404, 'Topic not found')
  }

  if (topic.scenarios.length > 0) {
    throw new HttpError(400, 'Delete scenarios first')
  }

  await prisma.trainingTopic.delete({ where: { id: topicId } })
  return { id: topicId }
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

export async function getDashboardSummary() {
  const [totalTeachers, totalTopics, totalScenarios, totalSessions, latestSessions] = await Promise.all([
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.trainingTopic.count(),
    prisma.trainingScenario.count(),
    prisma.trainingSession.count(),
    prisma.trainingSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 8,
      include: {
        teacher: {
          select: { displayName: true, username: true },
        },
        scenario: {
          select: { title: true },
        },
        review: {
          select: { overallScore: true },
        },
      },
    }),
  ])

  const activeTeachers = await prisma.trainingSession.groupBy({
    by: ['teacherId'],
    where: {
      startedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  })

  return {
    totalTeachers,
    totalTopics,
    totalScenarios,
    totalSessions,
    activeTeachersLast7Days: activeTeachers.length,
    recentSessions: latestSessions.map((session: (typeof latestSessions)[number]) => ({
      id: session.id,
      status: session.status,
      startedAt: session.startedAt,
      teacherName: session.teacher.displayName || session.teacher.username,
      scenarioTitle: session.scenario.title,
      score: session.review?.overallScore ?? session.totalScore ?? null,
    })),
  }
}
