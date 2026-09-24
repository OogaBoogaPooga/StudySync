/**
 * Grade math shared by the Grades page and the What-If calculator.
 * Letter scale is the common US 4.0 scale; edit LETTER_SCALE to match your school.
 */
export const LETTER_SCALE = [
  [93, 'A', 4.0], [90, 'A-', 3.7], [87, 'B+', 3.3], [83, 'B', 3.0], [80, 'B-', 2.7],
  [77, 'C+', 2.3], [73, 'C', 2.0], [70, 'C-', 1.7], [67, 'D+', 1.3], [63, 'D', 1.0], [60, 'D-', 0.7],
];

export function toLetter(pct) {
  const row = LETTER_SCALE.find(([min]) => pct >= min);
  return row ? { letter: row[1], points: row[2] } : { letter: 'F', points: 0 };
}

/** Weighted percentage for one class: Σ(weight × score/max) / Σ(weight) */
export function classStats(cls, assignments) {
  const graded = assignments.filter((a) => a.classId === cls.id && a.score != null && a.maxScore > 0);
  if (!graded.length) return null;
  const totalWeight = graded.reduce((s, a) => s + a.weight, 0);
  const pct = graded.reduce((s, a) => s + a.weight * (a.score / a.maxScore) * 100, 0) / totalWeight;
  return { pct, ...toLetter(pct), graded: graded.length };
}

/** Credit-weighted GPA across all classes that have at least one grade */
export function computeGPA(classes, assignments) {
  let points = 0;
  let credits = 0;
  const perClass = classes.map((c) => ({ cls: c, stats: classStats(c, assignments) }));
  for (const { cls, stats } of perClass) {
    if (!stats) continue;
    points += stats.points * cls.credits;
    credits += cls.credits;
  }
  return { gpa: credits ? points / credits : null, perClass };
}
