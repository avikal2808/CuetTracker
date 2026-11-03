/**
 * Comprehensive Syllabus Data for Class 11/12 Commerce & CUET UG
 * Pre-structured with units and subtopics.
 */
const DEFAULT_SYLLABUS = {
  accountancy: {
    id: 'accountancy',
    title: 'Accountancy',
    units: [
      {
        id: 'acc_u1',
        title: 'Partnership: Fundamentals',
        subtopics: [
          { id: 'acc_1_1', title: 'Profit & Loss Appropriation Account & Capital Accounts (Fixed vs Fluctuating)', minutes: 60 },
          { id: 'acc_1_2', title: 'Interest on Drawings (Average Period & Product Method)', minutes: 45 },
          { id: 'acc_1_3', title: 'Interest on Capital & Past Adjustments (Single Journal Entry)', minutes: 60 },
          { id: 'acc_1_4', title: 'Guarantee of Minimum Profit to a Partner', minutes: 45 }
        ]
      },
      {
        id: 'acc_u2',
        title: 'Reconstitution & Admission of Partner',
        subtopics: [
          { id: 'acc_2_1', title: 'Valuation of Goodwill (Average, Super Profit, Capitalisation)', minutes: 45 },
          { id: 'acc_2_2', title: 'New Profit Sharing Ratio & Sacrificing Ratio Calculations', minutes: 45 },
          { id: 'acc_2_3', title: 'Accounting for Goodwill on Admission & Hidden Goodwill', minutes: 60 },
          { id: 'acc_2_4', title: 'Revaluation Account & Accumulated Reserves / Losses', minutes: 60 },
          { id: 'acc_2_5', title: 'Adjustment of Capital Accounts on Admission', minutes: 60 }
        ]
      },
      {
        id: 'acc_u3',
        title: 'Retirement & Death of a Partner',
        subtopics: [
          { id: 'acc_3_1', title: 'Gaining Ratio & Goodwill Treatment on Retirement', minutes: 45 },
          { id: 'acc_3_2', title: 'Preparation of Retiring Partner Loan & Capital Account', minutes: 60 },
          { id: 'acc_3_3', title: 'Deceased Partner Share of Profit (Time/Turnover basis)', minutes: 45 },
          { id: 'acc_3_4', title: 'Executors Account & Section 37 provisions', minutes: 45 }
        ]
      },
      {
        id: 'acc_u4',
        title: 'Dissolution of Partnership Firm',
        subtopics: [
          { id: 'acc_4_1', title: 'Preparation of Realisation Account & Treatment of Assets/Liabilities', minutes: 60 },
          { id: 'acc_4_2', title: 'Treatment of Partner Loan & Capital Account in Dissolution', minutes: 45 },
          { id: 'acc_4_3', title: 'Realisation Expenses & Comprehensive Journal Entries', minutes: 60 }
        ]
      },
      {
        id: 'acc_u5',
        title: 'Accounting for Share Capital',
        subtopics: [
          { id: 'acc_5_1', title: 'Issue of Shares at Par, Premium & Calls-in-Arrears/Advance', minutes: 60 },
          { id: 'acc_5_2', title: 'Over-subscription & Pro-rata Allotment Table & Entries', minutes: 90 },
          { id: 'acc_5_3', title: 'Forfeiture of Shares Issued at Par & at Premium', minutes: 60 },
          { id: 'acc_5_4', title: 'Re-issue of Forfeited Shares & Transfer to Capital Reserve', minutes: 60 },
          { id: 'acc_5_5', title: 'Presentation of Share Capital in Balance Sheet (Schedule III)', minutes: 45 }
        ]
      },
      {
        id: 'acc_u6',
        title: 'Issue & Redemption of Debentures',
        subtopics: [
          { id: 'acc_6_1', title: 'Issue of Debentures for Consideration other than Cash & Collateral', minutes: 45 },
          { id: 'acc_6_2', title: 'Issue of Debentures with Terms of Redemption (6 cases)', minutes: 60 },
          { id: 'acc_6_3', title: 'Writing off Discount/Loss on Issue of Debentures', minutes: 45 }
        ]
      },
      {
        id: 'acc_u7',
        title: 'Financial Statement Analysis & Ratios',
        subtopics: [
          { id: 'acc_7_1', title: 'Schedule III Balance Sheet & Statement of P&L format/heads', minutes: 45 },
          { id: 'acc_7_2', title: 'Liquidity Ratios (Current Ratio, Quick Ratio)', minutes: 45 },
          { id: 'acc_7_3', title: 'Solvency Ratios (Debt-Equity, Total Assets to Debt, Proprietary, ICR)', minutes: 60 },
          { id: 'acc_7_4', title: 'Activity Ratios (Inventory, Trade Receivables, Trade Payables, Working Capital Turnover)', minutes: 60 },
          { id: 'acc_7_5', title: 'Profitability Ratios (Gross Profit, Operating, Net Profit, ROCE)', minutes: 60 }
        ]
      },
      {
        id: 'acc_u8',
        title: 'Cash Flow Statement (AS-3)',
        subtopics: [
          { id: 'acc_8_1', title: 'Cash Flow from Operating Activities (Net Profit before Tax & Working Capital adjustments)', minutes: 75 },
          { id: 'acc_8_2', title: 'Cash Flow from Investing Activities (Plant & Machinery with Depreciation Provision)', minutes: 60 },
          { id: 'acc_8_3', title: 'Cash Flow from Financing Activities (Shares, Debentures, Dividend paid, Interest)', minutes: 45 },
          { id: 'acc_8_4', title: 'Comprehensive Full-Length Cash Flow Statement Problems', minutes: 90 }
        ]
      }
    ]
  },
  business_studies: {
    id: 'business_studies',
    title: 'Business Studies',
    units: [
      {
        id: 'bst_u1',
        title: 'Nature & Principles of Management',
        subtopics: [
          { id: 'bst_1_1', title: 'Management: Characteristics, Objectives & Importance', minutes: 45 },
          { id: 'bst_1_2', title: 'Management as Science, Art & Profession + Levels of Management', minutes: 45 },
          { id: 'bst_1_3', title: 'Coordination: Essence of Management & Characteristics', minutes: 30 },
          { id: 'bst_1_4', title: 'Fayol 14 Principles of General Management with Case Studies', minutes: 60 },
          { id: 'bst_1_5', title: 'Taylor Scientific Management: Principles & Techniques (Work Study, Differential Piece Wage)', minutes: 60 }
        ]
      },
      {
        id: 'bst_u2',
        title: 'Business Environment & Planning',
        subtopics: [
          { id: 'bst_2_1', title: 'Dimensions of Business Environment (Economic, Social, Tech, Political, Legal)', minutes: 45 },
          { id: 'bst_2_2', title: 'Demonetization & Impact of Government Policy Changes on Business', minutes: 30 },
          { id: 'bst_2_3', title: 'Planning: Importance, Limitations & Step-by-Step Process', minutes: 45 },
          { id: 'bst_2_4', title: 'Types of Plans: Single Use vs Standing (Objective, Strategy, Policy, Procedure, Rule, Budget)', minutes: 60 }
        ]
      },
      {
        id: 'bst_u3',
        title: 'Organising & Staffing',
        subtopics: [
          { id: 'bst_3_1', title: 'Organising Process & Organizational Structure (Functional vs Divisional)', minutes: 45 },
          { id: 'bst_3_2', title: 'Formal vs Informal Organisation: Merits, Demerits & Differences', minutes: 30 },
          { id: 'bst_3_3', title: 'Delegation: Elements (Authority, Responsibility, Accountability) & Importance', minutes: 45 },
          { id: 'bst_3_4', title: 'Decentralisation: Concept and Significance vs Delegation', minutes: 30 },
          { id: 'bst_3_5', title: 'Staffing Process & Sources of Recruitment (Internal vs External)', minutes: 45 },
          { id: 'bst_3_6', title: 'Selection Process Steps & Training vs Development Methods', minutes: 45 }
        ]
      },
      {
        id: 'bst_u4',
        title: 'Directing & Controlling',
        subtopics: [
          { id: 'bst_4_1', title: 'Elements of Directing & Maslow Need Hierarchy Theory of Motivation', minutes: 45 },
          { id: 'bst_4_2', title: 'Financial vs Non-Financial Incentives & Leadership Styles (Autocratic, Democratic, Laissez-faire)', minutes: 45 },
          { id: 'bst_4_3', title: 'Communication: Formal vs Informal (Grapevine) & Barriers to Communication', minutes: 45 },
          { id: 'bst_4_4', title: 'Controlling: Relationship with Planning & 5-Step Controlling Process', minutes: 45 }
        ]
      },
      {
        id: 'bst_u5',
        title: 'Financial Management & Financial Markets',
        subtopics: [
          { id: 'bst_5_1', title: 'Financial Decisions: Investment, Financing, Dividend & Influencing Factors', minutes: 60 },
          { id: 'bst_5_2', title: 'Financial Planning & Factors determining Fixed & Working Capital', minutes: 45 },
          { id: 'bst_5_3', title: 'Money Market Instruments (Treasury Bill, Commercial Paper, Call Money, Certificate of Deposit, Commercial Bill)', minutes: 60 },
          { id: 'bst_5_4', title: 'Capital Market: Primary vs Secondary Market & Methods of Floatation', minutes: 45 },
          { id: 'bst_5_5', title: 'Trading Procedure on a Stock Exchange & Depository Services (Dematerialisation)', minutes: 45 },
          { id: 'bst_5_6', title: 'Securities and Exchange Board of India (SEBI): Objectives & Functions', minutes: 45 }
        ]
      },
      {
        id: 'bst_u6',
        title: 'Marketing Management & Consumer Protection',
        subtopics: [
          { id: 'bst_6_1', title: 'Marketing Philosophies (Production, Product, Selling, Marketing, Societal Marketing)', minutes: 45 },
          { id: 'bst_6_2', title: 'Product Mix: Branding, Labelling & Packaging Functions and Levels', minutes: 45 },
          { id: 'bst_6_3', title: 'Price Mix: Factors determining Price of a Product/Service', minutes: 30 },
          { id: 'bst_6_4', title: 'Physical Distribution & Promotion Mix (Advertising, Personal Selling, Sales Promotion, PR)', minutes: 60 },
          { id: 'bst_6_5', title: 'Consumer Protection Act 2019: Consumer Rights, Responsibilities & Three-Tier Redressal Machinery', minutes: 60 }
        ]
      }
    ]
  },
  economics: {
    id: 'economics',
    title: 'Economics',
    units: [
      {
        id: 'eco_u1',
        title: 'Macro: National Income & Aggregates',
        subtopics: [
          { id: 'eco_1_1', title: 'Circular Flow of Income in a 2-Sector Economy & Basic Concepts (Stock vs Flow, Intermediate vs Final Goods)', minutes: 45 },
          { id: 'eco_1_2', title: 'Domestic vs National, Gross vs Net, Market Price vs Factor Cost Aggregates', minutes: 45 },
          { id: 'eco_1_3', title: 'Measurement of National Income: Value Added Method & Precautions', minutes: 60 },
          { id: 'eco_1_4', title: 'Measurement of National Income: Income Method & Precautions', minutes: 60 },
          { id: 'eco_1_5', title: 'Measurement of National Income: Expenditure Method & Precautions', minutes: 60 },
          { id: 'eco_1_6', title: 'Real GDP vs Nominal GDP, GDP Deflator & GDP as Index of Welfare (Externalities)', minutes: 45 }
        ]
      },
      {
        id: 'eco_u2',
        title: 'Macro: Money, Banking & Multiplier',
        subtopics: [
          { id: 'eco_2_1', title: 'Money: Functions, Money Supply Measures (M1, M2, M3, M4)', minutes: 45 },
          { id: 'eco_2_2', title: 'Credit Creation by Commercial Banking System (Money Multiplier)', minutes: 45 },
          { id: 'eco_2_3', title: 'Central Bank (RBI) Functions & Monetary Policy Tools (Repo, Reverse Repo, CRR, SLR, OMO)', minutes: 60 },
          { id: 'eco_2_4', title: 'Aggregate Demand, Aggregate Supply & Components', minutes: 45 },
          { id: 'eco_2_5', title: 'Propensity to Consume (APC, MPC) & Propensity to Save (APS, MPS) with Derivations', minutes: 60 },
          { id: 'eco_2_6', title: 'Short-run Equilibrium Output & Investment Multiplier Mechanism', minutes: 60 },
          { id: 'eco_2_7', title: 'Problems of Deficient Demand & Excess Demand and Corrective Fiscal & Monetary Measures', minutes: 60 }
        ]
      },
      {
        id: 'eco_u3',
        title: 'Macro: Government Budget & Balance of Payments',
        subtopics: [
          { id: 'eco_3_1', title: 'Government Budget: Meaning, Objectives & Classification of Receipts (Revenue vs Capital)', minutes: 45 },
          { id: 'eco_3_2', title: 'Classification of Expenditure & Budgetary Deficits (Revenue, Fiscal, Primary Deficit)', minutes: 45 },
          { id: 'eco_3_3', title: 'Foreign Exchange Rate: Fixed, Flexible, Managed Floating & Currency Appreciation vs Depreciation', minutes: 45 },
          { id: 'eco_3_4', title: 'Balance of Payments: Current Account, Capital Account, Autonomous vs Accommodating Items', minutes: 60 }
        ]
      },
      {
        id: 'eco_u4',
        title: 'Indian Economic Development (1947-1990 & 1991)',
        subtopics: [
          { id: 'eco_4_1', title: 'Indian Economy on the Eve of Independence (Agriculture, Industry, Foreign Trade, Demographic)', minutes: 45 },
          { id: 'eco_4_2', title: 'Five Year Plans: Goals (Growth, Modernisation, Self-reliance, Equity) & Land Reforms / Green Revolution', minutes: 60 },
          { id: 'eco_4_3', title: 'Industrial Policy Resolution 1956 & Role of Small-Scale Industries (Karve Committee)', minutes: 45 },
          { id: 'eco_4_4', title: 'Economic Reforms 1991: Liberalisation, Privatisation, Globalisation (LPG) & WTO Appraisal', minutes: 60 }
        ]
      },
      {
        id: 'eco_u5',
        title: 'Current Challenges & Comparative Development',
        subtopics: [
          { id: 'eco_5_1', title: 'Human Capital Formation in India: Sources & Role in Economic Growth', minutes: 45 },
          { id: 'eco_5_2', title: 'Rural Development: Credit, Agricultural Marketing, Diversification & Organic Farming', minutes: 45 },
          { id: 'eco_5_3', title: 'Employment: Formal vs Informal Sector, Worker Population Ratio & Jobless Growth', minutes: 45 },
          { id: 'eco_5_4', title: 'Sustainable Economic Development: Environment Functions, Global Warming, Strategies', minutes: 45 },
          { id: 'eco_5_5', title: 'Comparative Development: India, China & Pakistan (Demographic, Growth, Sectoral Share, HDI)', minutes: 60 }
        ]
      },
      {
        id: 'eco_u6',
        title: 'CUET Microeconomics Booster',
        subtopics: [
          { id: 'eco_6_1', title: 'Consumer Equilibrium: Marginal Utility Analysis (Single & Two Commodity)', minutes: 45 },
          { id: 'eco_6_2', title: 'Indifference Curve Analysis: Budget Line, MRS & Equilibrium Condition', minutes: 60 },
          { id: 'eco_6_3', title: 'Demand, Factors affecting Demand & Price Elasticity of Demand (Percentage & Geometric)', minutes: 60 }
        ]
      }
    ]
  },
  english: {
    id: 'english',
    title: 'English (CUET Section IA)',
    units: [
      {
        id: 'eng_u1',
        title: 'Reading Comprehension Mastery',
        subtopics: [
          { id: 'eng_1_1', title: 'Factual RC Passages (Data-based, Economic & Historical reports)', minutes: 45 },
          { id: 'eng_1_2', title: 'Narrative RC Passages (Tone, Mood, Character perspective)', minutes: 45 },
          { id: 'eng_1_3', title: 'Literary Passages & Speed Skimming Techniques', minutes: 45 },
          { id: 'eng_1_4', title: 'RC Inference & Contextual Vocabulary Questions', minutes: 45 }
        ]
      },
      {
        id: 'eng_u2',
        title: 'Verbal Ability & Para-Jumbles',
        subtopics: [
          { id: 'eng_2_1', title: 'Sentence Rearrangement (Opening sentence, Transition signals, Mandatory pairs)', minutes: 45 },
          { id: 'eng_2_2', title: 'Sentence Completion & Double Fillers', minutes: 45 },
          { id: 'eng_2_3', title: 'Paragraph Completion & Identifying Incoherent Statements', minutes: 45 }
        ]
      },
      {
        id: 'eng_u3',
        title: 'Vocabulary & Word Power',
        subtopics: [
          { id: 'eng_3_1', title: 'High-Frequency CUET Synonyms & Antonyms (Root words, Prefixes, Suffixes)', minutes: 45 },
          { id: 'eng_3_2', title: 'One-Word Substitution (People, Science, Government, Phobias)', minutes: 30 },
          { id: 'eng_3_3', title: 'Idioms, Phrasal Verbs & Common Proverbs', minutes: 45 },
          { id: 'eng_3_4', title: 'Confusing Words & Homonyms / Homophones', minutes: 30 }
        ]
      },
      {
        id: 'eng_u4',
        title: 'Grammar Essentials & Error Spotting',
        subtopics: [
          { id: 'eng_4_1', title: 'Subject-Verb Agreement Rules & Tricky Exceptions', minutes: 45 },
          { id: 'eng_4_2', title: 'Prepositions & Correct Phrasal Usage', minutes: 45 },
          { id: 'eng_4_3', title: 'Tenses & Conditional Sentences', minutes: 45 },
          { id: 'eng_4_4', title: 'Active & Passive Voice + Direct & Indirect Speech rules', minutes: 45 },
          { id: 'eng_4_5', title: 'Analogy & Word Relationship Questions (Synonymic, Degree, Causation)', minutes: 45 }
        ]
      }
    ]
  },
  general_test: {
    id: 'general_test',
    title: 'General Test (CUET Section III)',
    units: [
      {
        id: 'gt_u1',
        title: 'Numerical Ability & Arithmetic',
        subtopics: [
          { id: 'gt_1_1', title: 'Percentages, Profit & Loss, Discount & Successive Changes', minutes: 60 },
          { id: 'gt_1_2', title: 'Ratio & Proportion, Partnership & Mixtures / Alligations', minutes: 60 },
          { id: 'gt_1_3', title: 'Averages, Weighted Averages & Age Problems', minutes: 45 },
          { id: 'gt_1_4', title: 'Simple Interest & Compound Interest Formulae & Shortcuts', minutes: 60 },
          { id: 'gt_1_5', title: 'Time & Work, Pipes & Cisterns', minutes: 60 },
          { id: 'gt_1_6', title: 'Time, Speed & Distance, Trains & Relative Speed', minutes: 60 }
        ]
      },
      {
        id: 'gt_u2',
        title: 'Quantitative & Mensuration',
        subtopics: [
          { id: 'gt_2_1', title: 'Basic Algebra: Identities, Linear & Quadratic Equations', minutes: 45 },
          { id: 'gt_2_2', title: '2D Mensuration: Triangles, Quadrilaterals, Circles (Area & Perimeter)', minutes: 60 },
          { id: 'gt_2_3', title: '3D Mensuration: Cubes, Cylinders, Cones, Spheres (Volume & Surface Area)', minutes: 60 },
          { id: 'gt_2_4', title: 'Data Interpretation: Tables, Bar Graphs & Pie Charts', minutes: 45 }
        ]
      },
      {
        id: 'gt_u3',
        title: 'Logical & Analytical Reasoning',
        subtopics: [
          { id: 'gt_3_1', title: 'Coding-Decoding & Letter-Number Series', minutes: 45 },
          { id: 'gt_3_2', title: 'Blood Relations & Family Tree Problems', minutes: 45 },
          { id: 'gt_3_3', title: 'Direction Sense & Distance Calculations', minutes: 30 },
          { id: 'gt_3_4', title: 'Syllogisms & Logical Deductions (Venn Diagrams)', minutes: 45 },
          { id: 'gt_3_5', title: 'Seating Arrangement (Linear & Circular)', minutes: 60 },
          { id: 'gt_3_6', title: 'Non-Verbal Reasoning (Pattern Completion, Mirror & Water Images)', minutes: 30 }
        ]
      },
      {
        id: 'gt_u4',
        title: 'General Knowledge & Current Affairs',
        subtopics: [
          { id: 'gt_4_1', title: 'Indian Constitution & Polity (Preamble, Fundamental Rights, Parliament)', minutes: 45 },
          { id: 'gt_4_2', title: 'Indian History & Geography Key Milestones', minutes: 45 },
          { id: 'gt_4_3', title: 'Important National & International Organizations & Summits (UN, G20, BRICS)', minutes: 45 },
          { id: 'gt_4_4', title: 'Awards, Honours, Books & Authors, Sports Trivia', minutes: 45 },
          { id: 'gt_4_5', title: 'Monthly Current Affairs Capsule Review & General Science', minutes: 60 }
        ]
      }
    ]
  }
};

window.DEFAULT_SYLLABUS = DEFAULT_SYLLABUS;
