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

export function detectResolved(message: string) {
  const text = message.trim()
  if (text.length >= 26) return true
  return resolveKeywords.some((keyword) => text.includes(keyword))
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
