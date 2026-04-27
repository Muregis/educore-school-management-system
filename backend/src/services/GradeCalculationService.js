import { database } from "../config/db.js";

/**
 * Grade Calculation Service
 * Handles KNEC grade calculation and student ranking
 */
export class GradeCalculationService {
  /**
   * Calculate KNEC grade from percentage
   */
  static async calculateKNECGrade(schoolId, percentage, subject = null) {
    try {
      const query = {
        where: { 
          school_id: schoolId,
          min_percentage: { '<=': percentage },
          max_percentage: { '>=': percentage },
          is_active: true
        }
      };
      
      if (subject) {
        query.where.subject_category = [null, subject];
      }
      
      const { data: grades } = await database.query('knec_grades', query);
      
      if (grades && grades.length > 0) {
        // Sort by min_percentage descending to get the best match
        grades.sort((a, b) => b.min_percentage - a.min_percentage);
        return grades[0];
      }
      
      // Default fallback
      return {
        knec_grade: 'EE9',
        grade_points: 0,
        description: 'Fail'
      };
    } catch (error) {
      console.error('Grade calculation error:', error);
      return {
        knec_grade: 'EE9',
        grade_points: 0,
        description: 'Error'
      };
    }
  }
  
  /**
   * Calculate grade for a result
   */
  static async calculateResultGrade(schoolId, result) {
    const percentage = (result.marks / result.total_marks) * 100;
    const grade = await this.calculateKNECGrade(schoolId, percentage, result.subject);
    
    return {
      ...result,
      percentage: percentage.toFixed(2),
      knec_grade: grade.knec_grade,
      grade_points: grade.grade_points,
      description: grade.description
    };
  }
  
  /**
   * Rank students by marks in a subject/term
   */
  static async rankStudents(schoolId, studentIds, term, academicYear, subject = null) {
    try {
      let query = {
        where: {
          school_id: schoolId,
          student_id: { 'in': `(${studentIds.join(',')})` },
          term: term,
          is_deleted: false
        },
        order: { column: 'marks', ascending: false }
      };
      
      if (subject) {
        query.where.subject = subject;
      }
      
      const { data: results } = await database.query('results', query);
      
      if (!results || results.length === 0) {
        return [];
      }
      
      // Calculate rankings
      const ranked = [];
      let currentRank = 1;
      let lastMarks = null;
      let skipCount = 0;
      
      for (let i = 0; i < results.length; i++) {
        if (lastMarks !== null && results[i].marks < lastMarks) {
          currentRank += 1 + skipCount;
          skipCount = 0;
        }
        
        if (lastMarks !== null && results[i].marks === lastMarks) {
          skipCount++;
        }
        
        const grade = await this.calculateResultGrade(schoolId, results[i]);
        
        ranked.push({
          ...grade,
          rank: currentRank,
          studentId: results[i].student_id
        });
        
        lastMarks = results[i].marks;
      }
      
      return ranked;
    } catch (error) {
      console.error('Rank students error:', error);
      return [];
    }
  }
  
  /**
   * Calculate mean grade for a student
   */
  static async calculateMeanGrade(schoolId, studentId, term, academicYear) {
    try {
      const { data: results } = await database.query('results', {
        where: {
          school_id: schoolId,
          student_id: studentId,
          term: term,
          is_deleted: false
        }
      });
      
      if (!results || results.length === 0) {
        return {
          meanGrade: null,
          meanPoints: 0,
          totalSubjects: 0
        };
      }
      
      let totalPoints = 0;
      let totalSubjects = 0;
      const subjectGrades = [];
      
      for (const result of results) {
        const grade = await this.calculateResultGrade(schoolId, result);
        totalPoints += grade.grade_points;
        totalSubjects++;
        subjectGrades.push({
          subject: result.subject,
          marks: result.marks,
          total_marks: result.total_marks,
          percentage: grade.percentage,
          knec_grade: grade.knec_grade,
          points: grade.grade_points
        });
      }
      
      const meanPoints = totalPoints / totalSubjects;
      
      // Get the mean grade based on mean points
      const { data: meanGradeData } = await database.query('knec_grades', {
        where: {
          school_id: schoolId,
          grade_points: { '<=': meanPoints },
          is_active: true
        },
        order: { column: 'grade_points', ascending: false },
        limit: 1
      });
      
      const meanGrade = meanGradeData?.[0] || {
        knec_grade: 'EE9',
        description: 'Fail'
      };
      
      return {
        meanGrade: meanGrade.knec_grade,
        meanGradeDescription: meanGrade.description,
        meanPoints: meanPoints.toFixed(2),
        totalSubjects,
        subjectGrades
      };
    } catch (error) {
      console.error('Calculate mean grade error:', error);
      return {
        meanGrade: null,
        meanPoints: 0,
        totalSubjects: 0
      };
    }
  }
  
  /**
   * Calculate class position for a student
   */
  static async calculateClassPosition(schoolId, studentId, term, academicYear, classId) {
    try {
      // Get all students in the class
      const { data: students } = await database.query('students', {
        where: {
          school_id: schoolId,
          class_id: classId,
          is_deleted: false
        }
      });
      
      if (!students || students.length === 0) {
        return {
          position: null,
          totalStudents: 0,
          outOf: 0
        };
      }
      
      const studentIds = students.map(s => s.student_id);
      
      // Calculate mean grades for all students
      const meanGrades = [];
      for (const sid of studentIds) {
        const meanResult = await this.calculateMeanGrade(schoolId, sid, term, academicYear);
        meanGrades.push({
          studentId: sid,
          meanPoints: parseFloat(meanResult.meanPoints),
          meanGrade: meanResult.meanGrade
        });
      }
      
      // Sort by mean points descending
      meanGrades.sort((a, b) => b.meanPoints - a.meanPoints);
      
      // Find position
      const position = meanGrades.findIndex(mg => mg.studentId === studentId) + 1;
      
      return {
        position: position > 0 ? position : null,
        totalStudents: students.length,
        outOf: students.length
      };
    } catch (error) {
      console.error('Calculate class position error:', error);
      return {
        position: null,
        totalStudents: 0,
        outOf: 0
      };
    }
  }
}

export default GradeCalculationService;
