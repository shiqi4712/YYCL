import { prisma } from '../lib/prisma'

export async function listTopics() {
  const topics = await prisma.trainingTopic.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      scenarios: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  return topics.map((topic: (typeof topics)[number]) => ({
    id: topic.id,
    trainingModule: topic.trainingModule,
    title: topic.title,
    description: topic.description,
    scenarioCount: topic.scenarios.length,
    scenarios: topic.scenarios.map((scenario: (typeof topic.scenarios)[number]) => ({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      parentPersona: scenario.parentPersona,
      difficulty: scenario.difficulty,
      openingLine: scenario.openingLine,
      stepCount: scenario.steps.length,
      steps: scenario.steps.map((step: (typeof scenario.steps)[number]) => ({
        id: step.id,
        order: step.order,
        title: step.title,
        objectionText: step.objectionText,
        evaluationFocus: step.evaluationFocus,
      })),
    })),
  }))
}
