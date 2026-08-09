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
const MIN_TEACHER_MESSAGES_TO_ADVANCE = 3
const STRONG_RESOLUTION_SCORE = 82
const ACCEPTABLE_RESOLUTION_SCORE = 72

function mapMessageRole(role: string) {
  return role === 'AI' ? 'ai' : 'teacher'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function clampScore(value: unknown, fallback = 0) {
  const score = Number(value)
  if (!Number.isFinite(score)) return fallback
  return Math.max(0, Math.min(100, Math.round(score)))
}

function buildDimensionItem(input: { score?: unknown; reason?: unknown; suggestion?: unknown }) {
  return {
    score: Math.max(0, Math.min(20, clampScore(input.score))),
    reason: String(input.reason || '本项证据不足。'),
    suggestion: String(input.suggestion || '建议补充更具体的话术动作。'),
  }
}

function normalizeReviewDimensions(raw: unknown) {
  const dimensions = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const pick = (key: string) => {
    const item = dimensions[key] && typeof dimensions[key] === 'object' ? (dimensions[key] as Record<string, unknown>) : {}
    return buildDimensionItem(item)
  }

  return {
    empathy: pick('empathy'),
    standard: pick('standard'),
    enablement: pick('enablement'),
    caseProof: pick('caseProof'),
    close: pick('close'),
  }
}

function sumDimensions(dimensions: ReturnType<typeof normalizeReviewDimensions>) {
  return Object.values(dimensions).reduce((sum, item) => sum + item.score, 0)
}

function buildMockDimensions(messages: string[]) {
  const text = messages.join('\n')
  const hasEmpathy = /理解|明白|担心|顾虑|正常|确实|认可/.test(text)
  const hasStandard = /标准|判断|观察|看到|目标|变化|完成|表现|评估/.test(text)
  const hasEnablement = /编程|逻辑|能力|思维|作品|物料|资料|图片|链接|价值/.test(text)
  const hasEnablementMaterial = /\+(物料|资料|图片|链接|作品)/.test(text)
  const hasCase = /案例|之前|有个孩子|同龄|学员|作品/.test(text)
  const hasCaseMaterial = /\+(案例|物料|图片|作品)/.test(text)
  const hasClose = /报名|确认|约|安排|付款|名额|今天|明天|下一步|发你|定/.test(text)

  return {
    empathy: buildDimensionItem({
      score: hasEmpathy ? 14 : 6,
      reason: hasEmpathy ? '有承接家长情绪。' : '共情表达偏少。',
      suggestion: '先复述家长真实担心，再降低对方压力。',
    }),
    standard: buildDimensionItem({
      score: hasStandard ? 14 : 6,
      reason: hasStandard ? '有尝试建立观察或判断标准。' : '缺少帮助家长判断的核心标准。',
      suggestion: '给家长一个可观察、可验证的判断标准。',
    }),
    enablement: buildDimensionItem({
      score: hasEnablementMaterial ? 18 : hasEnablement ? 13 : 5,
      reason: hasEnablementMaterial ? '已通过标记发送赋能物料。' : '赋能证据不足或缺少物料。',
      suggestion: '说明编程价值时配合 +物料、+资料、+图片、+链接 或 +作品。',
    }),
    caseProof: buildDimensionItem({
      score: hasCaseMaterial ? 18 : hasCase ? 13 : 5,
      reason: hasCaseMaterial ? '已通过案例或物料提供证据。' : '案例证据不足。',
      suggestion: '补充同龄孩子案例，并配合 +案例、+物料、+图片 或 +作品。',
    }),
    close: buildDimensionItem({
      score: hasClose ? 14 : 5,
      reason: hasClose ? '有下一步推进动作。' : '缺少明确缔结动作。',
      suggestion: '自然提出确认报名、约时间、发安排或付款下一步。',
    }),
  }
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
      return await evaluateDeepSeekResolution(input)
    } catch (error) {
      console.error('DeepSeek resolution failed, fallback to mock:', error)
    }
  }

  const resolved = detectResolved(input.teacherMessages)
  return {
    resolved,
    canAdvance: resolved,
    resolutionScore: resolved ? 82 : 48,
    emotionState: resolved ? '松动' : '犹豫',
    reason: resolved ? '老师已经覆盖核心顾虑、证据和下一步。' : '老师还需要更具体地回应当前顾虑。',
  }
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
  const reviewMeta = session.review ? parseReviewMeta(session.review.tagsJson) : null

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
          tags: reviewMeta?.tags ?? [],
          dimensions: reviewMeta?.dimensions ?? null,
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

  return {
    message: {
      id: teacherMessage.id,
      role: 'teacher',
      content: teacherMessage.content,
      stepOrder: teacherMessage.stepOrder,
      createdAt: teacherMessage.createdAt,
    },
    currentStepOrder: currentStep.order,
    status: session.status,
  }
}

export async function generateParentReply(sessionId: string, teacherId: string) {
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

  const lastTeacherMessage = [...session.messages]
    .reverse()
    .find(
      (message: (typeof session.messages)[number]) =>
        message.role === 'TEACHER' && message.stepOrder === currentStep.order
    )

  if (!lastTeacherMessage) {
    throw new HttpError(400, '请先发送老师话术')
  }

  const currentStepMessages = [
    ...session.messages
      .filter((message: (typeof session.messages)[number]) => message.stepOrder === currentStep.order)
      .map((message: (typeof session.messages)[number]) => ({
        role: message.role,
        content: message.content,
        stepOrder: message.stepOrder,
      })),
  ]
  const currentStepTeacherMessages = currentStepMessages
    .filter((message) => message.role === 'TEACHER')
    .map((message) => message.content)
  const currentStepTeacherMessageCount = currentStepTeacherMessages.length
  const evaluation =
    currentStepTeacherMessageCount >= MIN_TEACHER_MESSAGES_TO_ADVANCE
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
      : {
          resolved: false,
          canAdvance: false,
          resolutionScore: 40,
          emotionState: '防备',
          reason: '当前沟通轮次还不够，家长需要继续围绕同一个顾虑沟通。',
        }
  const canAdvance =
    currentStepTeacherMessageCount >= MIN_TEACHER_MESSAGES_TO_ADVANCE &&
    (evaluation.canAdvance ||
      evaluation.resolutionScore >= STRONG_RESOLUTION_SCORE ||
      (evaluation.resolved && evaluation.resolutionScore >= ACCEPTABLE_RESOLUTION_SCORE))
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
    teacherMessage: currentStepTeacherMessages.slice(-3).join('\n'),
    history: [
      ...session.messages.map((message: (typeof session.messages)[number]) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    currentStepTitle: currentStep.title,
    currentObjection: currentStep.objectionText,
    nextObjection: nextStep?.objectionText,
    isFinalStep: !nextStep,
    resolved: evaluation.resolved,
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
    resolvedCurrentStep: evaluation.resolved,
    canAdvance,
    resolutionScore: evaluation.resolutionScore,
    emotionState: evaluation.emotionState,
    reason: evaluation.reason,
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

      const dimensions = normalizeReviewDimensions(aiReview.dimensions)
      const overallScore = clampScore(aiReview.overallScore, sumDimensions(dimensions))
      const tags = Array.isArray(aiReview.tags) ? aiReview.tags : []
      const review = await prisma.sessionReview.create({
        data: {
          sessionId,
          overallScore,
          summary: String(aiReview.summary || '本次训练已完成结构化复盘。'),
          strengths: String(aiReview.strengths || '能够完成基本沟通。'),
          weaknesses: String(aiReview.weaknesses || '仍需加强异议拆解和推进。'),
          nextAction: String(aiReview.nextAction || '建议继续练习完整异议处理节奏。'),
          tagsJson: JSON.stringify({ tags, dimensions }),
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

  const dimensions = buildMockDimensions(teacherMessages.map((message: (typeof teacherMessages)[number]) => message.content))
  const overallScore = sumDimensions(dimensions)

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
      tagsJson: JSON.stringify({ tags, dimensions }),
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
