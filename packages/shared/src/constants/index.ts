export const ObjectionCategoryLabels: Record<string, string> = {
  PRICE: '价格异议',
  EFFECT: '效果异议',
  TIME: '时间异议',
  DECISION: '决策异议',
  TRUST: '信任异议',
};

export const DifficultyLabels: Record<string, string> = {
  EASY: '初级',
  MEDIUM: '中级',
  HARD: '高级',
};

export const ContentStatusLabels: Record<string, string> = {
  ACTIVE: '已上线',
  INACTIVE: '已下线',
};

export const ConversationStatusLabels: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  FAILED: '已流失',
  TIMEOUT: '已超时',
};

export const ReviewDimensionLabels: Record<string, string> = {
  emotionComfort: '情绪安抚',
  valueDelivery: '价值传递',
  objectionHandling: '异议处理',
  closingAbility: '促单收尾',
  compliance: '话术规范',
};

export const MAX_CHAT_ROUNDS = 20;
