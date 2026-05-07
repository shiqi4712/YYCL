import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        role: 'TRAINER',
        realName: '系统管理员',
        status: 'ACTIVE'
      }
    })
    console.log('Created default trainer: admin / admin123')
  } else {
    console.log('Trainer admin already exists')
  }

  const demoScenarios = [
    {
      title: '家长质疑课程价格过高',
      category: 'PRICE',
      parentProfile: '王妈妈，35岁，企业白领，孩子8岁三年级。觉得市面上编程课太多，价格差异大，对5000元/学期的课程价格有顾虑。',
      initialMessage: '你们这个课怎么要五千多？我在网上看别的机构才两千多，你们贵在哪啊？',
      difficulty: 'MEDIUM'
    },
    {
      title: '担心孩子学不懂编程',
      category: 'EFFECT',
      parentProfile: '李爸爸，38岁，IT工程师，孩子10岁五年级。自己懂技术但担心课程太枯燥，孩子坚持不下来。',
      initialMessage: '我自己就是写代码的，编程这东西 adult 学起来都费劲，你们确定孩子能学会？',
      difficulty: 'EASY'
    },
    {
      title: '孩子作业多没时间上课',
      category: 'TIME',
      parentProfile: '张妈妈，33岁，全职主妇，孩子9岁四年级。孩子报了数学和英语补习班，担心再加编程课负担太重。',
      initialMessage: '孩子现在一周已经上了三个课外班了，作业写到晚上九点，哪还有时间上编程课啊？',
      difficulty: 'MEDIUM'
    }
  ]

  for (const s of demoScenarios) {
    const exists = await prisma.scenario.findFirst({ where: { title: s.title } })
    if (!exists) {
      const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
      await prisma.scenario.create({
        data: {
          ...s,
          createdBy: admin?.id || 1
        }
      })
    }
  }
  console.log('Seed completed')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
