export function normalizeHeader(h) {
  const clean = String(h || '').replace(/^\uFEFF/, '').toLowerCase().trim();
  const map = {
    'admission no': 'admission_number',
    'admission number': 'admission_number',
    'adm no': 'admission_number',
    'adm': 'admission_number',
    'reg no': 'admission_number',
    'student no': 'admission_number',

    'subject': 'subject',
    'subject name': 'subject',

    'score': 'marks',
    'marks': 'marks',

    'out of': 'total_marks',
    'total': 'total_marks',
    'total marks': 'total_marks',
    'maximum': 'total_marks',

    'exam': 'exam_type',
    'exam type': 'exam_type',
    'exam name': 'exam_type',
    'assessment': 'exam_type',

    'class': 'class_name',
    'class name': 'class_name',
    'grade': 'grade',
    'comment': 'teacher_comment',
    'teacher comment': 'teacher_comment',
    'term': 'term',
    'student name': 'student_name',
    'name': 'student_name',
  };

  return map[clean] || clean.replace(/\s+/g, '_');
}
