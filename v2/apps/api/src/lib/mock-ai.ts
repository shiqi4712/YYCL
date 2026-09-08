import type { AiReplyInput } from './deepseek-ai'

const resolveKeywords = [
  '理解',
  '担心',
  '安排',
  '方案',
  '效果',
  '试听',
  '报名',
  '孩子',
  '规划',
  '建议',
]

const empathyKeywords = ['理解', '明白', '担心', '顾虑', '认可', '确实']
const childSpecificKeywords = ['孩子', '你家', '咱家', '课堂', '体验课', '表现', '基础']
const planKeywords = ['安排', '方案', '规划', '节奏', '跟进', '反馈', '复盘', '目标']
const evidenceKeywords = ['效果', '作品', '案例', '数据', '记录', '老师', '互动', '作业']
const nextActionKeywords = ['试听', '报名', '下次', '下一步', '先试', '发你', '约', '确认']

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function detectResolved(messageOrMessages: string | string[]) {
  const text = (Array.isArray(messageOrMessages) ? messageOrMessages.join('\n') : messageOrMessages).trim()
  if (text.length < 80) return false

  const score = [
    hasAny(text, empathyKeywords),
    hasAny(text, childSpecificKeywords),
    hasAny(text, planKeywords),
    hasAny(text, evidenceKeywords),
    hasAny(text, nextActionKeywords),
  ].filter(Boolean).length

  return score >= 4 || (score >= 3 && resolveKeywords.some((keyword) => text.includes(keyword)))
}

function selectReply(options: string[], seed: string) {
  const index = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % options.length
  return options[index]
}

function latestTeacherMessage(input: AiReplyInput) {
  return [...input.history].reverse().find((message) => message.role === 'TEACHER')?.content ?? ''
}

export function buildMockReply(input: AiReplyInput) {
  const teacherMessage = latestTeacherMessage(input)
  const materialSent = /\+(?:物料|资料|图片|链接|作品|案例)/.test(teacherMessage)

  if (input.phase === 'close') {
    return selectReply(
      materialSent
        ? ['我看到了，这样就清楚多了。那就按你说的来，后面的安排发我一下吧。', '这个资料挺直观的，我心里踏实一些了。接下来怎么安排？']
        : ['这样解释我就清楚多了，可以按你说的继续，下一步怎么安排？', '好，那我先按这个思路来，后面的安排你发我看看。'],
      teacherMessage
    )
  }

  if (input.phase === 'transition') {
    return selectReply(
      [
        `刚才这点我明白了。我另外还想问一下，${input.currentObjection}`,
        `嗯，这样说我放心一些。不过还有件事我比较在意：${input.currentObjection}`,
        `这个可以。那${input.currentObjection}，这块你们一般怎么处理？`,
      ],
      teacherMessage
    )
  }

  if (materialSent) {
    return selectReply(
      [
        `我看到你发的内容了，确实直观一些。不过放到我家孩子身上，${input.currentObjection}这点我还是有些拿不准。`,
        `这个资料我看了，方向能理解。我更想知道针对我家孩子的情况，实际会怎么做？`,
      ],
      teacherMessage
    )
  }

  return selectReply(
    input.emotionState === '防备'
      ? [
          `道理我能听懂，但我更关心实际情况。${input.currentObjection}这个问题具体怎么解决？`,
          `我知道你是这么考虑的，可我家孩子的情况不一定一样，这点我还是不太放心。`,
        ]
      : [
          `这个方向我大概明白了，放到我家孩子身上会怎么安排？`,
          `听起来有些道理，不过${input.currentObjection}这点我还想再确认一下。`,
          `那实际上课时，老师会怎么判断孩子有没有改善呢？`,
        ],
    teacherMessage
  )
}
