// Seeds a demo account with 3 classes, 5 assignments, flashcards and sessions.
// Run with: npm run db:setup
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const days = (n, hour = 17) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  await prisma.user.deleteMany({ where: { email: 'demo@studysync.app' } });

  const user = await prisma.user.create({
    data: {
      email: 'demo@studysync.app',
      name: 'Demo Student',
      password: await bcrypt.hash('password123', 10),
    },
  });

  const [bio, calc, hist] = await Promise.all([
    prisma.class.create({ data: { name: 'AP Biology', color: '#10b981', credits: 4, userId: user.id } }),
    prisma.class.create({ data: { name: 'Calculus II', color: '#6366f1', credits: 4, userId: user.id } }),
    prisma.class.create({ data: { name: 'World History', color: '#f59e0b', credits: 3, userId: user.id } }),
  ]);

  await prisma.assignment.createMany({
    data: [
      { title: 'Lab Report: Enzyme Activity', description: 'Include hypothesis, data tables, and error analysis.', dueDate: days(-2), progress: 60, classId: bio.id, userId: user.id, weight: 2 },
      { title: 'Problem Set 7 — Integration by Parts', dueDate: days(1, 23), progress: 30, classId: calc.id, userId: user.id },
      { title: 'Essay: Causes of WWI', description: '1500 words, MLA format.', dueDate: days(5), progress: 10, classId: hist.id, userId: user.id, weight: 3 },
      { title: 'Chapter 12 Quiz', dueDate: days(-7), progress: 100, completed: true, score: 88, maxScore: 100, classId: bio.id, userId: user.id },
      { title: 'Midterm Exam', dueDate: days(-10), progress: 100, completed: true, score: 91, maxScore: 100, weight: 4, classId: calc.id, userId: user.id },
      { title: 'Map Quiz: Europe 1914', dueDate: days(-4), progress: 100, completed: true, score: 42, maxScore: 50, classId: hist.id, userId: user.id },
    ],
  });

  await prisma.studySet.create({
    data: {
      title: 'Cell Biology Essentials',
      userId: user.id,
      content:
        '<h2>Cell Organelles</h2><p>The <b>mitochondria</b> is the powerhouse of the cell, producing ATP through cellular respiration.</p><p>The <b>ribosome</b> synthesizes proteins by translating mRNA.</p><ul><li>Nucleus stores DNA</li><li>Golgi apparatus packages proteins</li></ul>',
      cards: {
        create: [
          { front: 'What organelle produces ATP?', back: 'The mitochondria, via cellular respiration.' },
          { front: 'What is the function of ribosomes?', back: 'Protein synthesis — translating mRNA into polypeptides.' },
          { front: 'Where is DNA stored in a eukaryotic cell?', back: 'In the nucleus.' },
          { front: 'What does the Golgi apparatus do?', back: 'Modifies, sorts and packages proteins for transport.' },
        ],
      },
    },
  });

  await prisma.studySession.createMany({
    data: [
      { durationMin: 25, notes: 'Reviewed enzyme kinetics', startedAt: days(-1, 19), userId: user.id },
      { durationMin: 25, notes: 'Integration practice', startedAt: days(-1, 20), userId: user.id },
      { durationMin: 25, notes: 'Outlined WWI essay', startedAt: days(-3, 16), userId: user.id },
      { durationMin: 50, notes: 'Deep work: midterm prep', startedAt: days(-5, 18), userId: user.id },
    ],
  });

  console.log('✅ Seeded demo data. Login: demo@studysync.app / password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
