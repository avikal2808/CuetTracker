/**
 * Configuration & Credentials for CUET & Class 11/12 Commerce Tracker
 */
const CONFIG = {
  supabase: {
    url: 'https://lnnhfucpbmedthkozlxs.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubmhmdWNwYm1lZHRoa296bHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNzEwNzMsImV4cCI6MjEwNjg0NzA3M30.eEP7-QViRR7N4tS1I2uAi-JcuFZvRJhwwv7isD13OIg',
    tableName: 'student_progress',
    // We maintain a stable record identifier for the student session
    studentRecordId: 101
  },
  colors: {
    appBg: '#F7F7F2',
    cardBg: '#FFFFFF',
    secondarySurface: '#EEF3EA',
    primaryAccent: '#4F8A68',
    lightAccent: '#DCEBDD',
    darkAccent: '#35634A',
    success: '#4F9D69',
    warning: '#D69A3A',
    error: '#D65C5C',
    mainText: '#252A26',
    secondaryText: '#6F776F',
    border: '#E1E5DF'
  },
  timeBlocks: [
    {
      id: 'primary',
      title: 'Primary Block',
      durationMinutes: 60,
      badge: 'Core Focus (60m)',
      icon: 'zap',
      description: 'Deep dive, heavy numericals or critical concepts (Accountancy / Macroeconomics)',
      defaultSubject: 'Accountancy'
    },
    {
      id: 'secondary',
      title: 'Secondary Block',
      durationMinutes: 45,
      badge: 'Application (45m)',
      icon: 'book-open',
      description: 'Case studies, conceptual business theory or applied economics',
      defaultSubject: 'Business Studies'
    },
    {
      id: 'revision',
      title: 'Revision Block',
      durationMinutes: 30,
      badge: 'Recall & Speed (30m)',
      icon: 'repeat',
      description: 'MCQ drill, formulas, vocabulary, or General Test current affairs',
      defaultSubject: 'Economics'
    }
  ],
  subjects: {
    accountancy: {
      id: 'accountancy',
      name: 'Accountancy',
      code: 'ACC',
      icon: 'calculator',
      color: '#4F8A68',
      lightColor: '#E8F3EC',
      cuetMaxScore: 200,
      cuetQuestions: 50,
      cuetAttempts: 40,
      grade: 'Class 12 & CUET'
    },
    business_studies: {
      id: 'business_studies',
      name: 'Business Studies',
      code: 'BST',
      icon: 'briefcase',
      color: '#3B7A57',
      lightColor: '#E4F1E9',
      cuetMaxScore: 200,
      cuetQuestions: 50,
      cuetAttempts: 40,
      grade: 'Class 12 & CUET'
    },
    economics: {
      id: 'economics',
      name: 'Economics',
      code: 'ECO',
      icon: 'trending-up',
      color: '#2E6F56',
      lightColor: '#E1F0E9',
      cuetMaxScore: 200,
      cuetQuestions: 50,
      cuetAttempts: 40,
      grade: 'Class 12 & CUET'
    },
    english: {
      id: 'english',
      name: 'English',
      code: 'ENG',
      icon: 'pen-tool',
      color: '#4B7B63',
      lightColor: '#E6F0EB',
      cuetMaxScore: 200,
      cuetQuestions: 50,
      cuetAttempts: 40,
      grade: 'CUET Section IA'
    },
    general_test: {
      id: 'general_test',
      name: 'General Test',
      code: 'GT',
      icon: 'compass',
      color: '#3E6B52',
      lightColor: '#E3ECE6',
      cuetMaxScore: 250,
      cuetQuestions: 60,
      cuetAttempts: 50,
      grade: 'CUET Section III'
    }
  },
  storageKey: 'cuet_commerce_tracker_v1',
  lastSyncKey: 'cuet_commerce_tracker_last_sync'
};

// Export to window
window.CONFIG = CONFIG;
