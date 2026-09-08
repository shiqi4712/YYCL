import { z } from 'zod'
import { prisma } from '../lib/prisma'

const APP_SETTINGS_ID = 1
const appSettingsSchema = z.object({
  showTeacherScores: z.boolean(),
})

export async function getAppSettings() {
  const settings = await prisma.appSetting.findUnique({
    where: { id: APP_SETTINGS_ID },
  })

  return {
    showTeacherScores: settings?.showTeacherScores ?? false,
    updatedAt: settings?.updatedAt ?? null,
  }
}

export async function updateAppSettings(payload: unknown) {
  const input = appSettingsSchema.parse(payload)
  const settings = await prisma.appSetting.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      showTeacherScores: input.showTeacherScores,
    },
    update: {
      showTeacherScores: input.showTeacherScores,
    },
  })

  return {
    showTeacherScores: settings.showTeacherScores,
    updatedAt: settings.updatedAt,
  }
}
