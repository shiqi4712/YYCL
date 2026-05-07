export function buildReviewPrompt(scenario: {
  title: string
  category: string
}, messages: Array<{ role: string; content: string }>): string {
  const dialogue = messages.map(m => `${m.role === 'TEACHER' ? '教师' : '家长'}：${m.content}`).join('\n')

  return `你是一位资深销售培训专家，请对以下教师与家长的模拟对话进行专业点评。

【场景】${scenario.title}（${scenario.category}）

【对话记录】
${dialogue}

【点评要求】
请从以下 5 个维度进行评分（每项 0-100 分）并给出具体评语，最后给出改进建议和推荐话术编号。

维度说明：
1. emotionComfort（情绪安抚）：教师是否先处理家长情绪，再讲道理
2. valueDelivery（价值传递）：是否清晰传达了课程的价值
3. objectionHandling（异议处理）：是否使用了有效的话术应对核心异议
4. closingAbility（促单收尾）：是否把握成交信号、推进报名
5. compliance（话术规范）：是否有不当承诺、违规表述

请以 JSON 格式输出，结构如下：
{
  "overallScore": 78,
  "overallStar": 4,
  "dimensions": {
    "emotionComfort": { "score": 75, "comment": "..." },
    "valueDelivery": { "score": 82, "comment": "..." },
    "objectionHandling": { "score": 70, "comment": "..." },
    "closingAbility": { "score": 65, "comment": "..." },
    "compliance": { "score": 95, "comment": "..." }
  },
  "suggestions": ["建议1", "建议2", "建议3"],
  "recommendedScripts": []
}`
}
