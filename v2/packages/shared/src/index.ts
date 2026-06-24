export const userRoles = ['TRAINER', 'TEACHER'] as const
export const topicStatuses = ['ACTIVE', 'INACTIVE'] as const
export const difficultyLevels = ['BASIC', 'STANDARD', 'ADVANCED'] as const
export const trainingStatuses = ['ACTIVE', 'COMPLETED', 'ENDED', 'FAILED'] as const

export type UserRole = (typeof userRoles)[number]
export type TopicStatus = (typeof topicStatuses)[number]
export type DifficultyLevel = (typeof difficultyLevels)[number]
export type TrainingStatus = (typeof trainingStatuses)[number]

export interface ScenarioStepDto {
  id: string
  order: number
  title: string
  objectionText: string
  evaluationFocus: string
}

export interface ScenarioDto {
  id: string
  title: string
  description: string
  parentPersona: string
  difficulty: DifficultyLevel
  openingLine: string
  stepCount: number
  steps: ScenarioStepDto[]
}

export interface TopicDto {
  id: string
  title: string
  description: string
  scenarioCount: number
  scenarios: ScenarioDto[]
}
