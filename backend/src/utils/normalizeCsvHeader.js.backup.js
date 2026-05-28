export function normalizeHeader(h) {
  const map = {
    'admission no': 'admission_number',
    'admission number': 'admission_number',
    'adm no': 'admission_number',
    'adm': 'admission_number',

    'subject': 'subject',
    'subject name': 'subject',

    'score': 'marks',
    'marks': 'marks',

    'out of': 'total_marks',
    'total': 'total_marks',
    'total marks': 'total_marks',

    'exam': 'exam_type',
    'exam type': 'exam_type',

    'class': 'class_name',
  };

  return map[h.toLowerCase().trim()]
    || h.toLowerCase().trim();
}