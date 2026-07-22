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
      displayName: '张诗琪',
      role: 'TRAINER',
      isActive: true,
    },
    create: {
      username: 'trainer01',
      passwordHash: trainerPassword,
      displayName: '张诗琪',
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
      trainingModule: 'PRE_CLASS',
      title: '体验课后转正异议课',
      description: '聚焦体验课结束后的家长异议处理与报名推进。',
      createdById: trainer.id,
      status: 'ACTIVE',
    },
    create: {
      id: 'topic_trial_upgrade',
      trainingModule: 'PRE_CLASS',
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

  const objectionItems = [
    {
      id: 'objection_pre_attention',
      scene: 'pre',
      title: '孩子坐不住，担心体验课没效果',
      concern: '家长担心孩子专注力不足，体验课浪费时间，也担心老师无法控场。',
      keywords: ['坐不住', '专注力', '没效果', '体验课'],
      thinking: [
        '先承认家长观察到的问题，不急着否定孩子。',
        '把“坐不住”转成体验课需要验证的重点。',
        '说明体验课会看孩子的兴趣点、跟随度和老师引导方式是否匹配。',
      ],
      scripts: [
        '您这个担心很正常，孩子能不能坐得住，确实不是靠我们嘴上保证的。体验课反而就是用来观察这一点：老师会看孩子在哪些环节能被吸引、哪些地方容易走神，再判断适不适合继续学。',
        '如果孩子一开始坐不住，我们不会硬压着他，而是会通过小任务和互动把注意力慢慢拉回来。您到时候重点看两个点：孩子愿不愿意跟老师走，以及下课后还想不想继续尝试。',
      ],
      materials: [
        {
          title: '体验课作品示例图',
          url: 'https://dummyimage.com/900x560/eaf4ff/0a84ff.png&text=Trial+Class+Work',
          description: '家长担心孩子坐不住或没效果时，可配合发送作品示例。',
        },
      ],
      avoid: '不要直接说“肯定没问题”，也不要把孩子描述成“不专注”“不配合”。',
    },
    {
      id: 'objection_pre_time',
      scene: 'pre',
      title: '最近没时间，想以后再约体验',
      concern: '家长不确定课程优先级，可能也担心预约后被持续跟进。',
      keywords: ['没时间', '以后再说', '太忙', '预约'],
      thinking: [
        '先降低家长的压力，确认不是强行安排。',
        '帮助家长找到最小决策动作：先看一个合适时间。',
        '强调体验课是了解孩子情况，不等于马上报名。',
      ],
      scripts: [
        '可以理解，孩子现在安排多的话，家长确实不想再增加负担。我们可以先不急着定长期学习，只是帮孩子约一节体验，看他适不适合、感不感兴趣。',
        '如果您担心时间冲突，我先给您两个轻一点的时间段，您看哪个不影响孩子休息。体验后您再决定要不要继续，不会让您现在就做报名决定。',
      ],
      materials: [],
      avoid: '不要催促家长“名额快没了”，也不要把体验课说成必须马上参加。',
    },
    {
      id: 'objection_mid_value',
      scene: 'mid',
      title: '孩子上课挺开心，但不知道学到了什么',
      concern: '家长看到了课堂氛围，但还没有理解课程目标和能力收获。',
      keywords: ['学到什么', '开心', '效果', '能力'],
      thinking: [
        '先认可家长看见的课堂状态。',
        '把课堂表现拆成具体能力点，而不是泛泛说课程好。',
        '引导家长关注孩子接下来的可观察变化。',
      ],
      scripts: [
        '您看得很准，开心只是第一层。我们更关注的是孩子在任务里有没有听懂规则、愿不愿意尝试、遇到问题会不会调整，这些才是这类课真正训练的能力。',
        '今天这节课里，孩子愿意跟着老师完成步骤，这说明他不是单纯玩，而是在理解规则和解决问题。后续我们会继续把这种能力稳定下来。',
      ],
      materials: [
        {
          title: '课堂能力反馈样张',
          url: 'https://dummyimage.com/900x560/f2fbf5/15803d.png&text=Learning+Feedback',
          description: '用于解释“开心之外还学到了什么”。',
        },
      ],
      avoid: '不要只说“孩子很棒”，要给家长具体证据。',
    },
    {
      id: 'objection_close_price',
      scene: 'close',
      title: '价格有点贵，想再比较一下',
      concern: '家长认可方向但还没有确认价值，担心买贵或买错。',
      keywords: ['价格', '贵', '比较', '优惠'],
      thinking: [
        '先接住价格顾虑，避免立刻谈优惠。',
        '帮助家长建立比较标准：孩子匹配度、老师反馈、学习路径和服务陪伴。',
        '再给出明确下一步，降低决策成本。',
      ],
      scripts: [
        '您想比较一下很正常，课程不是只看价格，更重要的是孩子是否适配、老师能不能持续跟进、每个阶段有没有清楚目标。您比较的时候可以重点看这几项。',
        '如果只是比单价，可能会越看越乱。我们可以先根据今天孩子的表现，把适合他的学习路径和每阶段目标说清楚，您再判断这个投入值不值。',
      ],
      materials: [
        {
          title: '学习路径说明图',
          url: 'https://dummyimage.com/900x560/fff7ed/b45309.png&text=Learning+Roadmap',
          description: '家长比较价格时，用来说明阶段目标和服务内容。',
        },
      ],
      avoid: '不要一上来降价或强调优惠，也不要说其他机构不好。',
    },
    {
      id: 'objection_close_decision',
      scene: 'close',
      title: '我要和家里人商量一下',
      concern: '家长需要共同决策，也可能对课程价值、预算或孩子坚持度仍有顾虑。',
      keywords: ['商量', '爸爸', '家里人', '考虑'],
      thinking: [
        '尊重共同决策，不把商量理解为拒绝。',
        '追问需要商量的核心点，帮家长带着清楚信息沟通。',
        '约定明确反馈时间，避免对话自然流失。',
      ],
      scripts: [
        '应该的，孩子学习这件事家里一起商量会更稳。我想先了解一下，您主要想和家里人确认的是时间、费用，还是孩子能不能坚持？我可以把对应信息帮您整理清楚。',
        '那您和家里人沟通时，可以重点说三点：孩子今天的表现、后续学习目标、以及时间费用安排。我们明天这个时间再简单同步一下，您看可以吗？',
      ],
      materials: [],
      avoid: '不要逼问“您自己不能决定吗”，也不要让家长只带着价格去商量。',
    },
  ]

  for (const item of objectionItems) {
    await prisma.objectionItem.upsert({
      where: { id: item.id },
      update: {
        scene: item.scene,
        title: item.title,
        concern: item.concern,
        keywordsJson: JSON.stringify(item.keywords),
        thinkingJson: JSON.stringify(item.thinking),
        scriptsJson: JSON.stringify(item.scripts),
        materialsJson: JSON.stringify(item.materials),
        avoid: item.avoid,
        status: 'ACTIVE',
        createdById: trainer.id,
      },
      create: {
        id: item.id,
        scene: item.scene,
        title: item.title,
        concern: item.concern,
        keywordsJson: JSON.stringify(item.keywords),
        thinkingJson: JSON.stringify(item.thinking),
        scriptsJson: JSON.stringify(item.scripts),
        materialsJson: JSON.stringify(item.materials),
        avoid: item.avoid,
        status: 'ACTIVE',
        createdById: trainer.id,
      },
    })
  }

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
