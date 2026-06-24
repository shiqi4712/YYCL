import { PrismaClient } from '../apps/api/src/generated/prisma/index'
import { hashPassword } from '../apps/api/src/lib/auth'

const prisma = new PrismaClient()

async function cleanupLegacyBrokenData() {
  const badUsers = await prisma.user.findMany({
    where: {
      OR: [{ displayName: { contains: '??' } }, { username: { contains: '??' } }],
    },
    select: { id: true },
  })

  const badTopics = await prisma.trainingTopic.findMany({
    where: {
      OR: [{ title: { contains: '??' } }, { description: { contains: '??' } }],
    },
    select: { id: true },
  })

  const badScenarios = await prisma.trainingScenario.findMany({
    where: {
      OR: [
        { title: { contains: '??' } },
        { description: { contains: '??' } },
        { parentPersona: { contains: '??' } },
        { openingLine: { contains: '??' } },
        { topicId: { in: badTopics.map((topic) => topic.id) } },
      ],
    },
    select: { id: true },
  })

  const badUserIds = badUsers.map((user) => user.id)
  const badTopicIds = badTopics.map((topic) => topic.id)
  const badScenarioIds = badScenarios.map((scenario) => scenario.id)

  if (badUserIds.length || badScenarioIds.length) {
    await prisma.trainingSession.deleteMany({
      where: {
        OR: [{ teacherId: { in: badUserIds } }, { scenarioId: { in: badScenarioIds } }],
      },
    })
  }

  if (badUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: badUserIds } },
    })
  }

  if (badScenarioIds.length) {
    await prisma.trainingScenario.deleteMany({
      where: { id: { in: badScenarioIds } },
    })
  }

  if (badTopicIds.length) {
    await prisma.trainingTopic.deleteMany({
      where: { id: { in: badTopicIds } },
    })
  }
}

async function main() {
  await cleanupLegacyBrokenData()

  const trainerPassword = await hashPassword('123456')
  const teacherPassword = await hashPassword('123456')

  const trainer = await prisma.user.upsert({
    where: { username: 'trainer01' },
    update: {
      passwordHash: trainerPassword,
      displayName: '培训主管',
      role: 'TRAINER',
      isActive: true,
    },
    create: {
      username: 'trainer01',
      passwordHash: trainerPassword,
      displayName: '培训主管',
      role: 'TRAINER',
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { username: 'teacher01' },
    update: {
      passwordHash: teacherPassword,
      displayName: '体验课老师A',
      role: 'TEACHER',
      isActive: true,
    },
    create: {
      username: 'teacher01',
      passwordHash: teacherPassword,
      displayName: '体验课老师A',
      role: 'TEACHER',
      isActive: true,
    },
  })

  const topic = await prisma.trainingTopic.upsert({
    where: { id: 'topic_trial_upgrade' },
    update: {
      title: '体验课后转正异议课',
      description: '聚焦体验课结束后的家长异议处理与报名推进。',
      createdById: trainer.id,
      status: 'ACTIVE',
    },
    create: {
      id: 'topic_trial_upgrade',
      title: '体验课后转正异议课',
      description: '聚焦体验课结束后的家长异议处理与报名推进。',
      createdById: trainer.id,
      status: 'ACTIVE',
    },
  })

  await prisma.trainingScenario.upsert({
    where: { id: 'scenario_price_sensitive' },
    update: {
      topicId: topic.id,
      title: '价格敏感型家长',
      description: '家长认可课程方向，但会连续提出价格、对比和决策顾虑。',
      parentPersona: '李妈妈',
      openingLine: '李妈妈：老师，今天体验课孩子玩得挺开心的，但你们这正式课价格是不是有点高？',
      difficulty: 'STANDARD',
      status: 'ACTIVE',
      createdById: trainer.id,
    },
    create: {
      id: 'scenario_price_sensitive',
      topicId: topic.id,
      title: '价格敏感型家长',
      description: '家长认可课程方向，但会连续提出价格、对比和决策顾虑。',
      parentPersona: '李妈妈',
      openingLine: '李妈妈：老师，今天体验课孩子玩得挺开心的，但你们这正式课价格是不是有点高？',
      difficulty: 'STANDARD',
      status: 'ACTIVE',
      createdById: trainer.id,
    },
  })

  await prisma.trainingScenario.upsert({
    where: { id: 'scenario_effect_doubt' },
    update: {
      topicId: topic.id,
      title: '效果怀疑型家长',
      description: '家长担心孩子坚持不下来，也不确定课程是否真的有长期价值。',
      parentPersona: '王爸爸',
      openingLine: '王爸爸：我主要担心孩子学这个到底有没有长期效果，别学几节就没兴趣了。',
      difficulty: 'ADVANCED',
      status: 'ACTIVE',
      createdById: trainer.id,
    },
    create: {
      id: 'scenario_effect_doubt',
      topicId: topic.id,
      title: '效果怀疑型家长',
      description: '家长担心孩子坚持不下来，也不确定课程是否真的有长期价值。',
      parentPersona: '王爸爸',
      openingLine: '王爸爸：我主要担心孩子学这个到底有没有长期效果，别学几节就没兴趣了。',
      difficulty: 'ADVANCED',
      status: 'ACTIVE',
      createdById: trainer.id,
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_price_sensitive', order: 1 } },
    update: {
      title: '第一异议：价格偏高',
      objectionText: '你们课程太贵了。',
      evaluationFocus: '先共情，再说明课程价值和投入产出。',
    },
    create: {
      scenarioId: 'scenario_price_sensitive',
      order: 1,
      title: '第一异议：价格偏高',
      objectionText: '你们课程太贵了。',
      evaluationFocus: '先共情，再说明课程价值和投入产出。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_price_sensitive', order: 2 } },
    update: {
      title: '第二异议：还想比较',
      objectionText: '我还想再看看别家。',
      evaluationFocus: '帮助家长明确比较标准，而不是只停留在价格。',
    },
    create: {
      scenarioId: 'scenario_price_sensitive',
      order: 2,
      title: '第二异议：还想比较',
      objectionText: '我还想再看看别家。',
      evaluationFocus: '帮助家长明确比较标准，而不是只停留在价格。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_price_sensitive', order: 3 } },
    update: {
      title: '第三异议：要和家人商量',
      objectionText: '我还得和孩子爸爸商量一下。',
      evaluationFocus: '识别真实阻力，并推动明确下一步。',
    },
    create: {
      scenarioId: 'scenario_price_sensitive',
      order: 3,
      title: '第三异议：要和家人商量',
      objectionText: '我还得和孩子爸爸商量一下。',
      evaluationFocus: '识别真实阻力，并推动明确下一步。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_price_sensitive', order: 4 } },
    update: {
      title: '第四异议：担心学习效果',
      objectionText: '我怕孩子学了也没什么效果。',
      evaluationFocus: '把课程卖点转成孩子的具体收获和可见变化。',
    },
    create: {
      scenarioId: 'scenario_price_sensitive',
      order: 4,
      title: '第四异议：担心学习效果',
      objectionText: '我怕孩子学了也没什么效果。',
      evaluationFocus: '把课程卖点转成孩子的具体收获和可见变化。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_effect_doubt', order: 1 } },
    update: {
      title: '第一异议：学了有没有用',
      objectionText: '编程学这个到底有什么实际帮助？',
      evaluationFocus: '从孩子成长收益而不是课程功能出发解释价值。',
    },
    create: {
      scenarioId: 'scenario_effect_doubt',
      order: 1,
      title: '第一异议：学了有没有用',
      objectionText: '编程学这个到底有什么实际帮助？',
      evaluationFocus: '从孩子成长收益而不是课程功能出发解释价值。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_effect_doubt', order: 2 } },
    update: {
      title: '第二异议：担心孩子坚持不住',
      objectionText: '我担心孩子三分钟热度，坚持不了。',
      evaluationFocus: '先承接家长担心，再解释课程节奏和陪伴机制。',
    },
    create: {
      scenarioId: 'scenario_effect_doubt',
      order: 2,
      title: '第二异议：担心孩子坚持不住',
      objectionText: '我担心孩子三分钟热度，坚持不了。',
      evaluationFocus: '先承接家长担心，再解释课程节奏和陪伴机制。',
    },
  })

  await prisma.scenarioStep.upsert({
    where: { scenarioId_order: { scenarioId: 'scenario_effect_doubt', order: 3 } },
    update: {
      title: '第三异议：时间不确定',
      objectionText: '孩子现在作业也不少，时间上怕安排不过来。',
      evaluationFocus: '把时间安排说清楚，并降低开始门槛。',
    },
    create: {
      scenarioId: 'scenario_effect_doubt',
      order: 3,
      title: '第三异议：时间不确定',
      objectionText: '孩子现在作业也不少，时间上怕安排不过来。',
      evaluationFocus: '把时间安排说清楚，并降低开始门槛。',
    },
  })

  console.log('Seed completed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
