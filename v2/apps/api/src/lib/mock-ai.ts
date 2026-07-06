interface MockAiInput {
  parentName: string
  teacherMessage: string
  currentStepTitle: string
  currentObjection: string
  nextObjection?: string
  isFinalStep: boolean
  resolved: boolean
  canAdvance?: boolean
}

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

export function buildMockReply(input: MockAiInput) {
  const prefix = `${input.parentName}：`

  if (!input.resolved || !input.canAdvance) {
    return `${prefix}嗯，你说的这个方向我能理解。我不是完全不认可，就是还差一点确定感，主要还是担心“${input.currentObjection}”。如果放到我家孩子身上，具体会怎么安排、能看到什么变化？`
  }

  if (input.isFinalStep) {
    return `${prefix}这样说我就比刚才踏实一些了。那我可以先按你说的继续了解，你把下一步报名和上课安排发我看看吧。`
  }

  return `${prefix}你刚才这样解释，我大概明白了。不过我还有个点没想通，${input.nextObjection ?? '我可能还是想再考虑一下。'}这个你再跟我说说。`
}
