import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const teacher = await prisma.teacher.findFirst()
  if (!teacher) throw new Error("No teacher found")
  
  const schedule = await prisma.schedule.findFirst({
    where: { teacherId: teacher.id },
    include: { group: true, subject: true }
  })
  if (!schedule) throw new Error("No schedule found")

  await prisma.homework.create({
    data: {
      title: "Proyecto Final de Ciencias",
      description: "Presentar un proyecto experimental.",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      type: "PROYECTO",
      weight: 20,
      teacherId: teacher.id,
      groupId: schedule.groupId,
      subjectId: schedule.subjectId,
      tenantId: teacher.tenantId,
      status: "ACTIVE"
    }
  })

  await prisma.homework.create({
    data: {
      title: "Quiz de capitales",
      description: "Primer quiz del periodo",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      type: "QUIZ",
      weight: 5,
      teacherId: teacher.id,
      groupId: schedule.groupId,
      subjectId: schedule.subjectId,
      tenantId: teacher.tenantId,
      status: "ACTIVE"
    }
  })

  await prisma.homework.create({
    data: {
      title: "Quiz de ortografía",
      description: "Segundo quiz",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      type: "QUIZ",
      weight: 5,
      teacherId: teacher.id,
      groupId: schedule.groupId,
      subjectId: schedule.subjectId,
      tenantId: teacher.tenantId,
      status: "ACTIVE"
    }
  })
  console.log("Created 1 proyecto and 2 quices")
}

main().catch(console.error).finally(() => prisma.$disconnect())
