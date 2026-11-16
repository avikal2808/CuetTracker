/**
 * Shipped syllabus data.
 *
 * Intentionally empty. The original hardcoded Class 11/12 Commerce topic list
 * has been removed so the syllabus starts as a blank slate — topics are added
 * by the student, either through the AI photo parser (Import / Photo Parser)
 * or by restoring a backup.
 *
 * Shape the app expects once populated:
 *   {
 *     [subjectId]: {
 *       id: 'accountancy',
 *       title: 'Accountancy',
 *       units: [ { id, title, subtopics: [ { id, title, minutes } ] } ]
 *     }
 *   }
 */
const DEFAULT_SYLLABUS = {};

window.DEFAULT_SYLLABUS = DEFAULT_SYLLABUS;
