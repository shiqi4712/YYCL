interface MockAiInput {
  parentName: string
  teacherMessage: string
  currentStepTitle: string
  currentObjection: string
  nextObjection?: string
  isFinalStep: boolean
  resolved: boolean
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

  if (!input.resolved) {
    return `${prefix}我还是没有完全打消顾虑。现在我最在意的还是“${input.currentObjection}”。你能不能再讲具体一点，尤其是和孩子实际收获、后续安排有关的部分？`
  }

  if (input.isFinalStep) {
    return `${prefix}你这样讲我就放心多了。那我们就按你建议的下一步来，我愿意继续了解报名安排。`
  }

  return `${prefix}你刚才的解释我基本听明白了，不过我还有一个顾虑：${input.nextObjection ?? '我还想再考虑一下。'}`
}
