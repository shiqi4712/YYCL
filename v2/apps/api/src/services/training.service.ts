import { buildDeepSeekReply, buildDeepSeekReview, evaluateDeepSeekResolution, isDeepSeekEnabled } from '../lib/deepseek-ai'
import { buildMockReply, detectResolved } from '../lib/mock-ai'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const TRAINING_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ENDED: 'ENDED',
} as const

const AI_THINKING_DELAY_MS = 10_000
const MIN_TEACHER_MESSAGES_PER_OBJECTION = 5

function mapMessageRole(role: string) {
  return role === 'AI' ? 'ai' : 'teacher'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function buildParentReply(input: {
  parentName: string
  scenarioTitle: string
  scenarioDescription: string
  sopContent?: string | null
  parentPersona: string
  teacherMessage: string
  currentStepTitle: string
  currentObjection: string
  nextObjection?: string
  isFinalStep: boolean
  resolved: boolean
  canAdvance: boolean
  history: Array<{
    role: string
    content: string
  }>
}) {
  if (isDeepSeekEnabled()) {
    try {
      return await buildDeepSeekReply(input)
    } catch (error) {
      console.error('DeepSeek reply failed, fallback to mock:', error)
    }
  }

  await sleep(AI_THINKING_DELAY_MS)
  return buildMockReply(input)
}

async function evaluateObjectionResolved(input: {
  scenarioTitle: string
  scenarioDescription: string
  sopContent?: string | null
  parentPersona: string
  currentStepTitle: string
  currentObjection: string
  evaluationFocus: string
  teacherMessages: string[]
  messages: Array<{
    role: string
    content: string
    stepOrder: number
  }>
}) {
  if (isDeepSeekEnabled()) {
    try {
      const result = await evaluateDeepSeekResolution(input)
      return result.resolved
    } catch (error) {
      console.error('DeepSeek resolution failed, fallback to mock:', error)
    }
  }

  return detectResolved(input.teacherMessages)
}

async function getOwnedSession(sessionId: string, teacherId: string) {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      scenario: {
        include: {
          topic: true,
          steps: { orderBy: { order: 'asc' } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      review: {
        include: {
          stepReviews: { orderBy: { stepOrder: 'asc' } },
        },
      },
    },
  })

  if (!session || session.teacherId !== teacherId) {
    throw new HttpError(404, '训练记录不存在')
  }

  return session
}

export async function createSession(teacherId: string, scenarioId: string) {
  const scenario = await prisma.trainingScenario.findUnique({
    where: { id: scenarioId },
    include: { topic: true, steps: { orderBy: { order: 'asc' } } },
  })

  if (!scenario || scenario.status !== 'ACTIVE') {
    throw new HttpError(404, '训练场景不存在')
  }

  if (scenario.steps.length === 0) {
    throw new HttpError(400, '当前场景还没有配置异议步骤')
  }

  const session = await prisma.trainingSession.create({
    data: {
      teacherId,
      scenarioId,
      currentStepOrder: 1,
      status: TRAINING_STATUS.ACTIVE,
      messages: {
        create: {
          role: 'AI',
          content: scenario.openingLine,
          stepOrder: 1,
        },
      },
    },
    include: {
      messages: true,
      scenario: { include: { steps: { orderBy: { order: 'asc' } } } },
    },
  })

  return {
    sessionId: session.id,
    status: session.status,
    openingMessage: scenario.openingLine,
    scenario: {
      id: session.scenario.id,
      title: session.scenario.title,
    },
  }
}

export async function listTeacherSessions(teacherId: string) {
  const sessions = await prisma.trainingSession.findMany({
    where: { teacherId },
    orderBy: { startedAt: 'desc' },
    include: {
      scenario: {
        select: { id: true, title: true },
      },
      review: {
        select: { overallScore: true, createdAt: true },
      },
    },
  })

  return sessions.map((session: (typeof sessions)[number]) => ({
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    currentStepOrder: session.currentStepOrder,
    totalScore: session.totalScore,
    summary: session.summary,
    scenario: session.scenario,
    reviewGenerated: Boolean(session.review),
    reviewScore: session.review?.overallScore ?? null,
  }))
}

export async function getSessionDetail(sessionId: string, teacherId: string) {
  const session = await getOwnedSession(sessionId, teacherId)

  return {
    id: session.id,
    status: session.status,
    currentStepOrder: session.currentStepOrder,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    totalScore: session.totalScore,
    summary: session.summary,
    scenario: {
      id: session.scenario.id,
      title: session.scenario.title,
      description: session.scenario.description,
      parentPersona: session.scenario.parentPersona,
    },
    messages: session.messages.map((message: (typeof session.messages)[number]) => ({
      id: message.id,
      role: mapMessageRole(message.role),
      content: message.content,
      stepOrder: message.stepOrder,
      createdAt: message.createdAt,
    })),
    review: session.review
      ? {
          id: session.review.id,
          overallScore: session.review.overallScore,
          summary: session.review.summary,
          strengths: session.review.strengths,
          weaknesses: session.review.weaknesses,
          nextAction: session.review.nextAction,
          tags: JSON.parse(session.review.tagsJson),
          steps: session.review.stepReviews.map((step: (typeof session.review.stepReviews)[number]) => ({
            id: step.id,
            stepOrder: step.stepOrder,
            stepTitle: step.stepTitle,
            score: step.score,
            verdict: step.verdict,
            strengths: step.strengths,
            issue: step.issue,
            recommendation: step.recommendation,
          })),
        }
      : null,
  }
}

export async function sendTeacherMessage(sessionId: string, teacherId: string, content: string) {
  const session = await getOwnedSession(sessionId, teacherId)

  if (session.status !== TRAINING_STATUS.ACTIVE) {
    throw new HttpError(400, '当前训练已经结束')
  }

  const currentStep = session.scenario.steps.find(
    (step: (typeof session.scenario.steps)[number]) => step.order === session.currentStepOrder
  )

  if (!currentStep) {
    throw new HttpError(500, '训练步骤异常')
  }

  const teacherMessage = await prisma.sessionMessage.create({
    data: {
      sessionId,
      role: 'TEACHER',
      content,
      stepOrder: currentStep.order,
    },
  })

  const currentStepMessages = [
    ...session.messages
      .filter((message: (typeof session.messages)[number]) => message.stepOrder === currentStep.order)
      .map((message: (typeof session.messages)[number]) => ({
        role: message.role,
        content: message.content,
        stepOrder: message.stepOrder,
      })),
    {
      role: teacherMessage.role,
      content: teacherMessage.content,
      stepOrder: teacherMessage.stepOrder,
    },
  ]
  const currentStepTeacherMessages = currentStepMessages
    .filter((message) => message.role === 'TEACHER')
    .map((message) => message.content)
  const currentStepTeacherMessageCount =
    currentStepTeacherMessages.length
  const resolved =
    currentStepTeacherMessageCount >= MIN_TEACHER_MESSAGES_PER_OBJECTION
      ? await evaluateObjectionResolved({
          scenarioTitle: session.scenario.title,
          scenarioDescription: session.scenario.description,
          sopContent: session.scenario.topic.sopContent,
          parentPersona: session.scenario.parentPersona,
          currentStepTitle: currentStep.title,
          currentObjection: currentStep.objectionText,
          evaluationFocus: currentStep.evaluationFocus,
          teacherMessages: currentStepTeacherMessages,
          messages: currentStepMessages,
        })
      : false
  const canAdvance = resolved && currentStepTeacherMessageCount >= MIN_TEACHER_MESSAGES_PER_OBJECTION
  const nextStep = session.scenario.steps.find(
    (step: (typeof session.scenario.steps)[number]) => step.order === currentStep.order + 1
  )

  const finalStatus = canAdvance && !nextStep ? TRAINING_STATUS.COMPLETED : TRAINING_STATUS.ACTIVE
  const nextStepOrder = canAdvance && nextStep ? nextStep.order : currentStep.order

  const reply = await buildParentReply({
    parentName: session.scenario.parentPersona,
    scenarioTitle: session.scenario.title,
    scenarioDescription: session.scenario.description,
    sopContent: session.scenario.topic.sopContent,
    parentPersona: session.scenario.parentPersona,
    teacherMessage: content,
    history: [
      ...session.messages.map((message: (typeof session.messages)[number]) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: teacherMessage.role,
        content: teacherMessage.content,
      },
    ],
    currentStepTitle: currentStep.title,
    currentObjection: currentStep.objectionText,
    nextObjection: nextStep?.objectionText,
    isFinalStep: !nextStep,
    resolved,
    canAdvance,
  })

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      currentStepOrder: nextStepOrder,
      status: finalStatus,
      endedAt: finalStatus === TRAINING_STATUS.COMPLETED ? new Date() : null,
    },
  })

  const aiMessage = await prisma.sessionMessage.create({
    data: {
      sessionId,
      role: 'AI',
      content: reply,
      stepOrder: nextStepOrder,
    },
  })

  return {
    message: {
      id: aiMessage.id,
      role: 'ai',
      content: aiMessage.content,
      stepOrder: aiMessage.stepOrder,
      createdAt: aiMessage.createdAt,
    },
    resolvedCurrentStep: resolved,
    canAdvance,
    currentStepOrder: nextStepOrder,
    status: finalStatus,
  }
}

export async function endSession(sessionId: string, teacherId: string) {
  const session = await getOwnedSession(sessionId, teacherId)

  if (session.status === TRAINING_STATUS.COMPLETED) {
    return { id: session.id, status: session.status, endedAt: session.endedAt }
  }

  const updated = await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      status: TRAINING_STATUS.ENDED,
      endedAt: new Date(),
    },
  })

  return { id: updated.id, status: updated.status, endedAt: updated.endedAt }
}

export async function generateReview(sessionId: string, teacherId: string) {
  const session = await getOwnedSession(sessionId, teacherId)

  if (session.review) {
    return getSessionDetail(sessionId, teacherId).then((detail) => detail.review)
  }

  const teacherMessages = session.messages.filter(
    (message: (typeof session.messages)[number]) => message.role === 'TEACHER'
  )

  if (isDeepSeekEnabled()) {
    try {
      const aiReview = await buildDeepSeekReview({
        scenarioTitle: session.scenario.title,
        scenarioDescription: session.scenario.description,
        sopContent: session.scenario.topic.sopContent,
        parentPersona: session.scenario.parentPersona,
        steps: session.scenario.steps.map((step: (typeof session.scenario.steps)[number]) => ({
          order: step.order,
          title: step.title,
          objectionText: step.objectionText,
          evaluationFocus: step.evaluationFocus,
        })),
        messages: session.messages.map((message: (typeof session.messages)[number]) => ({
          role: message.role,
          content: message.content,
          stepOrder: message.stepOrder,
        })),
      })

      const review = await prisma.sessionReview.create({
        data: {
          sessionId,
          overallScore: Number(aiReview.overallScore) || 0,
          summary: String(aiReview.summary || '本次训练已完成结构化复盘。'),
          strengths: String(aiReview.strengths || '能够完成基本沟通。'),
          weaknesses: String(aiReview.weaknesses || '仍需加强异议拆解和推进。'),
          nextAction: String(aiReview.nextAction || '建议继续练习完整异议处理节奏。'),
          tagsJson: JSON.stringify(Array.isArray(aiReview.tags) ? aiReview.tags : []),
          stepReviews: {
            create: session.scenario.steps.map((step: (typeof session.scenario.steps)[number]) => {
              const item = Array.isArray(aiReview.steps)
                ? aiReview.steps.find((reviewStep: { stepOrder?: number }) => Number(reviewStep.stepOrder) === step.order)
                : null

              return {
                stepId: step.id,
                stepOrder: step.order,
                stepTitle: step.title,
                score: Number(item?.score) || 0,
                verdict: String(item?.verdict || '本轮对该异议处理证据不足。'),
                strengths: String(item?.strengths || '有尝试回应家长顾虑。'),
                issue: String(item?.issue || '回应还不够具体。'),
                recommendation: String(item?.recommendation || '建议补充孩子收益、案例证据和下一步安排。'),
              }
            }),
          },
        },
      })

      await prisma.trainingSession.update({
        where: { id: sessionId },
        data: {
          totalScore: review.overallScore,
          summary: review.summary,
          status: TRAINING_STATUS.COMPLETED,
          endedAt: session.endedAt ?? new Date(),
        },
      })

      return getSessionDetail(sessionId, teacherId).then((detail) => detail.review)
    } catch (error) {
      console.error('DeepSeek review failed, fallback to mock:', error)
    }
  }

  const stepReviews = session.scenario.steps.map((step: (typeof session.scenario.steps)[number]) => {
    const messages = teacherMessages.filter(
      (message: (typeof teacherMessages)[number]) => message.stepOrder === step.order
    )

    const totalLength = messages.reduce(
      (sum: number, message: (typeof messages)[number]) => sum + message.content.length,
      0
    )
    const resolved = detectResolved(messages.map((message: (typeof messages)[number]) => message.content))
    const score = resolved ? Math.min(92, 72 + Math.round(totalLength / 12)) : 58

    return {
      stepId: step.id,
      stepOrder: step.order,
      stepTitle: step.title,
      score,
      verdict: resolved ? '已经有效承接该异议' : '承接还不够充分',
      strengths: resolved
        ? '能够先安抚家长情绪，再把话题拉回价值和下一步安排。'
        : '已经开始回应家长异议，但价值表达还不够具体。',
      issue: resolved
        ? '如果能更快推进下一步确认，转化节奏会更完整。'
        : '对家长顾虑的拆解还不够细，缺少孩子收益层面的表达。',
      recommendation: resolved
        ? '下一次在解决异议后，可以更明确地提出下一步行动建议。'
        : '建议先共情，再给证据和方案，最后推动下一步确认。',
    }
  })

  const overallScore = Math.round(
    stepReviews.reduce((sum: number, step: (typeof stepReviews)[number]) => sum + step.score, 0) /
      stepReviews.length
  )

  const resolvedCount = stepReviews.filter((step: (typeof stepReviews)[number]) => step.score >= 70).length

  const tags = [
    resolvedCount === stepReviews.length ? '异议承接较稳定' : '异议处理仍需加强',
    overallScore >= 80 ? '推进意识较强' : '价值表达还可加强',
  ]

  const summary =
    resolvedCount === stepReviews.length
      ? '本次训练已经完整覆盖场景内的异议链路，整体沟通节奏比较稳定。'
      : '本次训练能够进入核心异议，但部分节点的说服力和推进感还需要加强。'

  const review = await prisma.sessionReview.create({
    data: {
      sessionId,
      overallScore,
      summary,
      strengths: '能够围绕家长顾虑持续回应，没有明显跑题，整体沟通方向是正确的。',
      weaknesses: '在价值表达、证据支撑和收尾推进上还有提升空间。',
      nextAction: '建议下一轮重点强化“先共情，再举例，再推动下一步”的完整节奏。',
      tagsJson: JSON.stringify(tags),
      stepReviews: {
        create: stepReviews,
      },
    },
  })

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      totalScore: overallScore,
      summary: review.summary,
      status: session.status === TRAINING_STATUS.ACTIVE ? TRAINING_STATUS.COMPLETED : session.status,
      endedAt: session.endedAt ?? new Date(),
    },
  })

  return getSessionDetail(sessionId, teacherId).then((detail) => detail.review)
}
