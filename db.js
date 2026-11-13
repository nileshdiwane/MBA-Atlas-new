const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.MBA_DB_PATH || path.join(__dirname, 'data', 'mba-atlas.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

function json(value) { return JSON.stringify(value); }
function now() { return new Date().toISOString(); }

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      cohort TEXT NOT NULL, track TEXT NOT NULL, specialization TEXT,
      current_term_id INTEGER, avatar TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      phase TEXT NOT NULL, sequence INTEGER NOT NULL, start_date TEXT, end_date TEXT,
      status TEXT NOT NULL DEFAULT 'locked'
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      area TEXT NOT NULL, phase TEXT NOT NULL, credits REAL NOT NULL,
      description TEXT NOT NULL, pedagogy TEXT NOT NULL, level TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0, specialization TEXT,
      source_note TEXT NOT NULL, color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, course_id INTEGER NOT NULL,
      term_id INTEGER NOT NULL, status TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0,
      final_grade REAL, letter_grade TEXT, enrolled_at TEXT NOT NULL,
      UNIQUE(student_id, course_id),
      FOREIGN KEY(student_id) REFERENCES students(id), FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(term_id) REFERENCES terms(id)
    );
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL, sequence INTEGER NOT NULL,
      title TEXT NOT NULL, summary TEXT NOT NULL, learning_objectives TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available', FOREIGN KEY(course_id) REFERENCES courses(id)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL, module_id INTEGER,
      title TEXT NOT NULL, type TEXT NOT NULL, due_at TEXT, points REAL NOT NULL,
      weight REAL NOT NULL, instructions TEXT NOT NULL, rubric TEXT NOT NULL,
      team_based INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(course_id) REFERENCES courses(id)
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, assignment_id INTEGER NOT NULL,
      content TEXT NOT NULL, attachment_name TEXT, submitted_at TEXT NOT NULL,
      status TEXT NOT NULL, score REAL, feedback TEXT,
      UNIQUE(student_id, assignment_id), FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(assignment_id) REFERENCES assignments(id)
    );
    CREATE TABLE IF NOT EXISTS grade_items (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, course_id INTEGER NOT NULL,
      title TEXT NOT NULL, category TEXT NOT NULL, weight REAL NOT NULL,
      score REAL NOT NULL, graded_at TEXT NOT NULL, feedback TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      company TEXT NOT NULL, area TEXT NOT NULL, difficulty TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL, synopsis TEXT NOT NULL, decision_prompt TEXT NOT NULL,
      exhibits TEXT NOT NULL, preparation_questions TEXT NOT NULL, provenance TEXT NOT NULL,
      access_type TEXT NOT NULL, source_url TEXT, license_note TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS case_preparations (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, case_id INTEGER NOT NULL,
      position TEXT NOT NULL, analysis TEXT NOT NULL, evidence TEXT NOT NULL,
      alternatives TEXT NOT NULL, risks TEXT NOT NULL, confidence INTEGER NOT NULL,
      submitted_at TEXT NOT NULL, UNIQUE(student_id, case_id)
    );
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, publisher TEXT NOT NULL,
      area TEXT NOT NULL, resource_type TEXT NOT NULL, official_school TEXT,
      source_url TEXT NOT NULL, access_type TEXT NOT NULL, license_note TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY, term_id INTEGER, course_id INTEGER, title TEXT NOT NULL,
      event_type TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
      location TEXT, required INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_groups (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, focus TEXT NOT NULL, meeting_cadence TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS study_group_members (
      group_id INTEGER NOT NULL, student_name TEXT NOT NULL, role TEXT NOT NULL,
      PRIMARY KEY(group_id, student_name)
    );
    CREATE TABLE IF NOT EXISTS professor_messages (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, professor_area TEXT NOT NULL,
      case_id INTEGER, role TEXT NOT NULL, message TEXT NOT NULL, score REAL,
      gaps TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS competency_evidence (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, competency TEXT NOT NULL,
      source_type TEXT NOT NULL, source_id INTEGER, score REAL NOT NULL,
      note TEXT NOT NULL, recorded_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS internships (
      id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL UNIQUE, organization TEXT,
      role TEXT, location TEXT, start_date TEXT, end_date TEXT, supervisor TEXT,
      objectives TEXT, status TEXT NOT NULL DEFAULT 'planning', final_reflection TEXT
    );
    CREATE TABLE IF NOT EXISTS internship_logs (
      id INTEGER PRIMARY KEY, internship_id INTEGER NOT NULL, week_number INTEGER NOT NULL,
      achievement TEXT NOT NULL, challenge TEXT NOT NULL, learning TEXT NOT NULL,
      manager_feedback TEXT, created_at TEXT NOT NULL, UNIQUE(internship_id, week_number)
    );
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT NOT NULL, target_value REAL NOT NULL, metric TEXT NOT NULL,
      sequence INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS source_registry (
      id INTEGER PRIMARY KEY, institution TEXT NOT NULL, title TEXT NOT NULL,
      source_url TEXT NOT NULL UNIQUE, source_type TEXT NOT NULL, official INTEGER NOT NULL,
      use_in_product TEXT NOT NULL, content_boundary TEXT NOT NULL
    );
  `);
}

const courseSeed = [
  ['PRE100','MBA Readiness Lab','Foundations','foundation',1,'Diagnostic work in accounting, statistics, economics, spreadsheets and executive communication.','Diagnostic · workshop · mastery quiz','Foundation',1,null,'Original simulation informed by common pre-MBA preparation patterns.','#477c75'],
  ['CASE101','Case Analysis & Decision Writing','Leadership','foundation',1,'Build a defensible decision from incomplete evidence, discuss it, respond to a cold call and reflect.','Case · cold call · reflection','Foundation',1,null,'Original implementation of the four public HBS case-method stages.','#a6613c'],
  ['FIN101','Finance I','Finance','core-a',3,'Time value, capital budgeting, risk-return, valuation and financing logic for general managers.','Case · modelling lab · exam','Core',1,null,'Title and broad scope follow public MBA curriculum descriptions; all content is original.','#315f8f'],
  ['ACC101','Financial Reporting & Control','Finance','core-a',3,'Read financial statements, diagnose earnings quality and connect operations to reported results.','Problems · case · memo · exam','Core',1,null,'Original course using legally accessible public-company filings.','#66548f'],
  ['LDR101','Leadership & Organizations','Leadership','core-a',3,'Motivation, teams, influence, culture, organizational design and responsible leadership.','Case · squad lab · peer feedback','Core',1,null,'Inspired by public HBS, Stanford and MIT course descriptions.','#a04f68'],
  ['MKT101','Marketing Management','Marketing','core-a',3,'Customer insight, segmentation, positioning, demand, pricing, channels and brand choice.','Case · field research · debate','Core',1,null,'Original course informed by public school curricula and MIT OCW.','#c26a3b'],
  ['OPS101','Technology & Operations','Operations','core-a',3,'Process analysis, bottlenecks, variability, inventory, quality, platforms and technology choices.','Case · simulation · analytics','Core',1,null,'Original course informed by public HBS and MIT Sloan descriptions.','#3d718b'],
  ['STR101','Competitive Strategy','Strategy','core-a',3,'Industry structure, advantage, capabilities, scope, ecosystems and strategic commitments.','Case · debate · board memo','Core',1,null,'Original course informed by published strategy course descriptions.','#7b6238'],
  ['ECO201','Markets & Global Economy','Economics','core-b',3,'Managerial economics, game theory, macro conditions, policy and international business.','Problems · case · policy debate','Core',1,null,'Original synthesis of public MBA economics requirements.','#557244'],
  ['DAT201','Data & AI for Leaders','Economics','core-b',3,'Inference, experiments, regression, forecasting, AI product decisions, governance and risk.','Lab · critique · exam','Core',1,null,'Original course informed by current public HBS, Stanford, Wharton and MIT descriptions.','#48658a'],
  ['ENT201','The Entrepreneurial Manager','Entrepreneurship','core-b',3,'Opportunity discovery, business models, experimentation, financing, scaling and founder choices.','Venture sprint · case · pitch','Core',1,null,'Original simulation informed by public MBA entrepreneurship curricula.','#9a6139'],
  ['FIN202','Finance II','Finance','core-b',3,'Capital structure, M&A, financial policy, options and complex valuation under uncertainty.','Model · negotiation · final','Core',1,null,'Original advanced finance course.','#315f8f'],
  ['ETH201','Leadership, Ethics & Accountability','Leadership','core-b',3,'Stakeholder duties, governance, ethical reasoning, crisis judgement and institutional trust.','Dilemma · debate · reflection','Core',1,null,'Original synthesis of public ethics and accountability requirements.','#8d4d5e'],
  ['FIRM201','Purpose of the Firm','Strategy','core-b',1.5,'Integrate value creation, legitimacy, sustainability and long-term responsibility.','Seminar · personal credo','Core',1,null,'Original integrative seminar.','#806844'],
  ['INT300','Summer Management Practice','Leadership','internship',3,'Structured internship or venture experience with goals, weekly evidence, supervisor feedback and impact review.','Field work · logs · impact memo','Applied',1,null,'Original field-experience framework informed by HBS and Booth public requirements.','#477c75'],
  ['VC401','Venture Capital & Entrepreneurial Finance','Entrepreneurship','elective',3,'Term sheets, cap tables, staged finance, portfolio logic and founder-investor negotiation.','Model · negotiation · investment memo','Elective',0,'Entrepreneurship','Original elective.','#9a6139'],
  ['PM401','Product Strategy & Growth','Marketing','elective',3,'Product-market fit, discovery, growth loops, monetisation, roadmaps and portfolio choices.','Product lab · experiment · case','Elective',0,'Entrepreneurship','Original elective.','#c26a3b'],
  ['CF401','Corporate Financial Modelling','Finance','elective',3,'Integrated statements, scenarios, DCF, accretion/dilution and decision-ready model communication.','Spreadsheet labs · model audit','Elective',0,'Finance','Original elective supported by open finance resources.','#315f8f'],
  ['NEG401','Negotiation & Influence','Leadership','elective',3,'Preparation, value creation, claiming, coalitions, difficult conversations and multi-party deals.','Live simulation · peer review','Elective',0,'Leadership','Original simulation-based elective.','#a04f68'],
  ['SCM401','Supply Chain Resilience','Operations','elective',3,'Network design, risk pooling, sourcing, inventory and disruption response.','Simulation · analytics · board memo','Elective',0,'Operations','Original elective.','#3d718b'],
  ['AIB401','AI Business Strategy','Strategy','elective',3,'AI economics, data advantage, build-buy-partner choices, operating model and responsible deployment.','Case · product council · governance memo','Elective',0,'Strategy','Original elective.','#48658a'],
  ['CAP499','Enterprise Transformation Capstone','Strategy','capstone',6,'Integrate finance, customer, strategy, operations, people, technology and ethics in a board-level transformation.','Team simulation · board defence · reflection','Capstone',1,null,'Original capstone informed by INSEAD capstone and action-learning patterns.','#162c46']
];

const sources = [
  ['Harvard Business School','MBA Curriculum','https://www.hbs.edu/mba/academic-experience/curriculum','Official curriculum',1,'Programme sequence and publicly listed course names.','No course materials or cases copied.'],
  ['Harvard Business School','The Case Method','https://www.hbs.edu/mba/academic-experience/the-case-method','Official pedagogy',1,'Read-discuss-engage-reflect workflow.','No HBS case text or teaching notes copied.'],
  ['Harvard Business School','MBA Grading','https://www.hbs.edu/mba/handbook/academic-information-and-policies/grading','Official policy',1,'Assessment mix research and transparency note.','Simulation uses its own percentage grades.'],
  ['Harvard Business School','MBA Degree Requirements','https://www.hbs.edu/mba/handbook/academic-information-and-policies/degree-requirements','Official policy',1,'Breadth, EC depth and professional responsibility model.','Requirements are adapted, not represented as HBS rules.'],
  ['Stanford Graduate School of Business','First-Year Curriculum','https://www.gsb.stanford.edu/programs/mba/academic-experience/curriculum/first-year','Official curriculum',1,'Analytical, leadership and management foundations; calibrated pathways.','No Stanford course content copied.'],
  ['Stanford Graduate School of Business','Leadership Labs','https://www.gsb.stanford.edu/experience/learning/leadership/labs','Official pedagogy',1,'Squad exercises, ambiguity, feedback and reflection.','Exercises here are original.'],
  ['Wharton School','MBA Curriculum','https://mba.wharton.upenn.edu/mba-curriculum/','Official curriculum',1,'Core-major-elective architecture and flexible core.','Simulation credits are not Wharton credit units.'],
  ['INSEAD','MBA Curriculum','https://www.insead.edu/master-programmes/master-business-administration/curriculum','Official curriculum',1,'Five-period intensity, electives and capstone.','Simulation does not claim INSEAD equivalence.'],
  ['MIT Sloan','MBA Curriculum','https://mitsloan.mit.edu/mba/explore-program/mba-curriculum','Official curriculum',1,'Cohort core, teams, electives and hands-on learning.','No MIT assessment content copied.'],
  ['MIT OpenCourseWare','MBA First-Semester Core','https://ocw.mit.edu/collections/sloan-mba-first-semester-core/','Open learning resource',1,'External readings and legal self-study links.','Linked, not republished; MIT OCW terms apply.'],
  ['Chicago Booth','MBA Curriculum','https://www.chicagobooth.edu/mba/academics/curriculum','Official curriculum',1,'Foundations, experiential LEAD and flexibility.','No Booth course content copied.'],
  ['Columbia Business School','MBA Degree Requirements','https://academics.business.columbia.edu/mba/academics/degree-requirements','Official policy',1,'Four-term progression and explicit degree audit.','Simulation requirements are independent.'],
  ['Harvard Business Publishing','Copyright Permission','https://www.hbsp.harvard.edu/copyright-permission/','Rights policy',1,'Defines the case-content boundary.','HBP materials are never embedded or sent to the tutor.']
];

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM students').get().n;
  if (existing) return;
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO students VALUES (?,?,?,?,?,?,?,?,?)').run(1,'Maya Rao','maya.rao@example.test','Class of 2028','Two-year MBA simulation','Strategy',2,'MR',now());
    const termInsert = db.prepare('INSERT INTO terms(id,code,title,phase,sequence,start_date,end_date,status) VALUES (?,?,?,?,?,?,?,?)');
    [
      [1,'FND','Pre-MBA Foundation','foundation',1,'2026-06-15','2026-08-21','completed'],
      [2,'Y1F','Year 1 · Core A','core-a',2,'2026-08-24','2026-12-18','active'],
      [3,'Y1S','Year 1 · Core B','core-b',3,'2027-01-25','2027-05-19','upcoming'],
      [4,'SUM','Summer Management Practice','internship',4,'2027-06-01','2027-08-20','upcoming'],
      [5,'Y2F','Year 2 · Electives A','elective',5,'2027-08-30','2027-12-17','locked'],
      [6,'Y2S','Year 2 · Electives B + Capstone','capstone',6,'2028-01-24','2028-05-17','locked']
    ].forEach(x=>termInsert.run(...x));

    const ci = db.prepare(`INSERT INTO courses(code,title,area,phase,credits,description,pedagogy,level,required,specialization,source_note,color) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    courseSeed.forEach(x=>ci.run(...x));
    const courseByCode = Object.fromEntries(db.prepare('SELECT id,code FROM courses').all().map(x=>[x.code,x.id]));

    const enroll = db.prepare('INSERT INTO enrollments(student_id,course_id,term_id,status,progress,final_grade,letter_grade,enrolled_at) VALUES (?,?,?,?,?,?,?,?)');
    enroll.run(1,courseByCode.PRE100,1,'completed',100,91,'A-',now());
    enroll.run(1,courseByCode.CASE101,1,'completed',100,88,'B+',now());
    ['FIN101','ACC101','LDR101','MKT101','OPS101','STR101'].forEach((c,i)=>enroll.run(1,courseByCode[c],2,'active',[42,48,37,45,32,40][i],null,null,now()));
    ['ECO201','DAT201','ENT201','FIN202','ETH201','FIRM201'].forEach(c=>enroll.run(1,courseByCode[c],3,'planned',0,null,null,now()));
    enroll.run(1,courseByCode.INT300,4,'planned',0,null,null,now());

    const module = db.prepare('INSERT INTO modules(course_id,sequence,title,summary,learning_objectives,status) VALUES (?,?,?,?,?,?)');
    const modules = {
      FIN101:[['Value and the decision rule','Use cash flows, opportunity cost and time value to decide whether an investment creates value.',['Build a cash-flow timeline','Calculate NPV and IRR','Explain conflicts between metrics']],['Risk, return and required return','Separate diversifiable risk from priced risk and defend a hurdle rate.',['Estimate required return','Stress-test assumptions','Communicate model limits']]],
      ACC101:[['The three statements','Trace transactions through income statement, balance sheet and cash-flow statement.',['Reconcile statements','Diagnose cash conversion','Spot classification choices']],['Earnings quality','Test whether reported performance reflects durable economics.',['Normalize earnings','Read footnotes','Write an investor alert']]],
      LDR101:[['Motivation without slogans','Diagnose the system shaping behaviour before blaming individuals.',['Map incentives','Distinguish skill and will','Design a fair intervention']],['Teams under pressure','Lead through conflict, uneven information and status differences.',['Surface dissent','Run a premortem','Give behavioural feedback']]],
      MKT101:[['Customer and choice','Move from broad market descriptions to a precise customer and job-to-be-done.',['Segment on needs','Select a target','Write a positioning statement']],['Pricing the value','Connect willingness to pay, economics and channel behaviour.',['Frame price architecture','Estimate contribution','Anticipate response']]],
      OPS101:[['Flow and bottlenecks','See the process, quantify capacity and locate the constraint.',['Map a process','Calculate capacity','Protect the bottleneck']],['Variability and buffers','Choose inventory, capacity and time buffers deliberately.',['Diagnose queues','Pool risk','Set service trade-offs']]],
      STR101:[['Industry economics','Explain where value is created, captured and lost.',['Map five forces','Define the arena','Identify profit pools']],['Advantage and commitments','Test whether a proposed advantage is valuable, hard to copy and supported by activity choices.',['Build an activity system','Compare alternatives','Specify commitments']]]
    };
    for (const [code, rows] of Object.entries(modules)) rows.forEach((m,i)=>module.run(courseByCode[code],i+1,m[0],m[1],json(m[2]),i===0?'active':'available'));

    const moduleIds = Object.fromEntries(db.prepare('SELECT m.id,c.code,m.sequence FROM modules m JOIN courses c ON c.id=m.course_id').all().map(x=>[`${x.code}-${x.sequence}`,x.id]));
    const assignment = db.prepare(`INSERT INTO assignments(course_id,module_id,title,type,due_at,points,weight,instructions,rubric,team_based) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const rubric = json([{criterion:'Decision',weight:25},{criterion:'Evidence and analysis',weight:30},{criterion:'Alternatives and trade-offs',weight:20},{criterion:'Implementation and risk',weight:15},{criterion:'Clarity',weight:10}]);
    const assignmentRows = [
      ['FIN101',1,'Northstar Expansion Model','Financial model','2026-11-16T18:00:00+05:30',100,15,'Build a five-year free-cash-flow model. State the investment decision, assumptions, sensitivities and break-even conditions.',rubric,0],
      ['ACC101',1,'Earnings Quality Memo','Individual memo','2026-11-18T18:00:00+05:30',100,15,'Use the supplied fictional statements to identify three adjustments and explain their decision impact.',rubric,0],
      ['LDR101',1,'Cold Call: Orion Team Reset','Cold call','2026-11-20T09:00:00+05:30',100,10,'Prepare a 90-second opening decision and two pieces of behavioural evidence.',rubric,0],
      ['MKT101',1,'Segmentation Board','Team assignment','2026-11-23T18:00:00+05:30',100,15,'Define need-based segments, select one target and defend the choice with economics and strategic fit.',rubric,1],
      ['OPS101',1,'Harborline Process Analysis','Simulation','2026-11-25T18:00:00+05:30',100,15,'Calculate capacity by step, locate the bottleneck and propose a sequenced intervention.',rubric,1],
      ['STR101',1,'Industry Structure Debate','Debate','2026-11-27T14:00:00+05:30',100,10,'Argue whether the sector is structurally attractive, then rebut the strongest counter-position.',rubric,1],
      ['FIN101',2,'Finance I Midterm','Midterm','2026-11-30T10:00:00+05:30',100,15,'Closed-resource applied problems and a one-page investment recommendation.',rubric,0],
      ['STR101',2,'Aster AI Board Memo','Individual memo','2026-12-04T18:00:00+05:30',100,20,'Recommend build, partner or acquire. Specify the capability system, commitments and downside controls.',rubric,0]
    ];
    assignmentRows.forEach(a=>assignment.run(courseByCode[a[0]],moduleIds[`${a[0]}-${a[1]}`],...a.slice(2)));

    const grade = db.prepare('INSERT INTO grade_items(student_id,course_id,title,category,weight,score,graded_at,feedback) VALUES (?,?,?,?,?,?,?,?)');
    grade.run(1,courseByCode.FIN101,'Case participation: Vela Foods','Participation',10,84,'2026-10-30','Clear decision and good sensitivity logic. Bring the financing constraint into the opening answer.');
    grade.run(1,courseByCode.ACC101,'Statement mechanics quiz','Quiz',10,92,'2026-10-28','Accurate reconciliation. Revisit deferred revenue classification.');
    grade.run(1,courseByCode.LDR101,'Squad feedback practicum','Leadership lab',15,88,'2026-11-02','Specific behavioural observations and strong listening. Make the request more testable.');
    grade.run(1,courseByCode.MKT101,'Customer interview synthesis','Field work',15,86,'2026-11-06','Good need pattern. Avoid treating channel preference as a segment by itself.');
    grade.run(1,courseByCode.OPS101,'Flow diagnostic','Simulation',10,79,'2026-11-08','Correct bottleneck; the variability assumption needs evidence.');
    grade.run(1,courseByCode.STR101,'Industry economics opening','Participation',10,90,'2026-11-10','Crisp boundary and strong counterfactual.');

    const caseIns = db.prepare(`INSERT INTO cases(slug,title,company,area,difficulty,estimated_minutes,synopsis,decision_prompt,exhibits,preparation_questions,provenance,access_type,source_url,license_note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    [
      ['aster-ai','Aster AI: Build, Partner or Acquire?','Aster Industrial Systems','Strategy','Advanced',90,'A profitable industrial-software company must decide how to add predictive AI while a fast-moving partner controls the critical model layer.','As the CEO, choose build, partner or acquire. What must be true, what will you commit now, and how will you contain downside risk?',json(['Five-year segment economics','Capability map','Partner term sheet extract','Customer retention cohorts']),json(['What is the source of advantage?','Which capabilities are scarce?','What changes under a 40% model-cost decline?','What would make you reverse the decision?']),'Original fictional simulation written for MBA Atlas.','Embedded original',null,'Original content. May be modified for personal learning.'],
      ['harborline','Harborline Health: The Capacity Crisis','Harborline Health','Operations','Intermediate',75,'An outpatient network faces long waits despite apparently adequate aggregate capacity. Local managers disagree about whether to hire, reschedule or redesign flow.','What should the COO change in the next 30 days, and what should not change yet?',json(['Process times','Arrival pattern','Staff roster','Queue observations']),json(['Where is the effective bottleneck?','How does variability change the answer?','Which metric could trigger gaming?']),'Original fictional simulation written for MBA Atlas.','Embedded original',null,'Original content. May be modified for personal learning.'],
      ['northstar','Northstar Storage: Invest Through the Downturn?','Northstar Storage','Finance','Advanced',100,'A battery-storage manufacturer can expand during a demand slowdown, but the project depends on price, utilization and working-capital assumptions.','Approve, stage or reject the expansion. Give a valuation range and identify the two assumptions the board must monitor.',json(['Historical statements','Project cash flows','Scenario assumptions','Comparable returns']),json(['Which cash flows are incremental?','What is the appropriate discount rate?','What option value does staging create?']),'Original fictional simulation written for MBA Atlas.','Embedded original',null,'Original content. May be modified for personal learning.'],
      ['orion-team','Orion Labs: Reset the Team?','Orion Labs','Leadership','Intermediate',60,'A high-performing product team misses two launches after a reorganization. The leader sees conflict, silence and unclear decision rights.','What should the team leader do in the first meeting, and what deeper system change should follow?',json(['Team network','Decision log','Pulse survey','Launch retrospective']),json(['Is this a people, task or system problem?','Whose voice is absent?','What behaviour should the leader model?']),'Original fictional simulation written for MBA Atlas.','Embedded original',null,'Original content. May be modified for personal learning.'],
      ['luma-go-to-market','Luma Learning: Choosing a Beachhead','Luma Learning','Marketing','Intermediate',70,'An education startup has traction in three customer groups but cannot support all three. Each offers different willingness to pay, sales cycles and reference value.','Select a beachhead segment and design the positioning, offer and first 90-day evidence plan.',json(['Interview themes','Segment economics','Funnel data','Competitor map']),json(['Which need is urgent?','What is the whole product?','What would falsify your segment choice?']),'Original fictional simulation written for MBA Atlas.','Embedded original',null,'Original content. May be modified for personal learning.'],
      ['hbp-catalog','Harvard Business Publishing Case Catalogue','External catalogue','Cross-disciplinary','Varies',0,'A link to the official Harvard Business Publishing catalogue. No case text is stored in MBA Atlas.','Use only material you are legally entitled to access. Do not paste licensed case text into the AI professor.',json([]),json([]),'Official external catalogue; not MBA Atlas content.','Purchase or institutional access','https://www.hbsp.harvard.edu/cases','All Harvard Business Publishing content is protected by copyright and governed by its terms.']
    ].forEach(x=>caseIns.run(...x));

    const reading = db.prepare('INSERT INTO readings(title,publisher,area,resource_type,official_school,source_url,access_type,license_note,description) VALUES (?,?,?,?,?,?,?,?,?)');
    [
      ['MBA First-Semester Core','MIT OpenCourseWare','Cross-disciplinary','Course collection','MIT Sloan','https://ocw.mit.edu/collections/sloan-mba-first-semester-core/','Open','MIT OCW terms apply.','Five current Sloan core subjects and three core-elective counterparts are linked from this official collection.'],
      ['Finance Theory I','MIT OpenCourseWare','Finance','Open course','MIT Sloan','https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/','Open','MIT OCW terms apply.','Graduate finance syllabus, notes and assessments for supplementary study.'],
      ['Economic Analysis for Business Decisions','MIT OpenCourseWare','Economics','Open course','MIT Sloan','https://ocw.mit.edu/courses/15-010-economic-analysis-for-business-decisions-fall-2004/','Open','MIT OCW terms apply.','Managerial economics lectures, assignments and exams.'],
      ['Introduction to Operations Management','MIT OpenCourseWare','Operations','Open course','MIT Sloan','https://ocw.mit.edu/courses/15-761-introduction-to-operations-management-spring-2013/','Open','MIT OCW terms apply.','Cases, preparation questions and simulation exercises.'],
      ['Marketing Management','MIT OpenCourseWare','Marketing','Open course','MIT Sloan','https://ocw.mit.edu/courses/15-810-marketing-management-fall-2010/','Open','MIT OCW terms apply.','Syllabus, readings, case questions, assignments and project materials.'],
      ['Organizational Processes','MIT OpenCourseWare','Leadership','Open course','MIT Sloan','https://ocw.mit.edu/courses/15-311-organizational-processes-fall-2003/','Open','MIT OCW terms apply.','Cases and organizational analysis assignments.'],
      ['Business Textbooks','OpenStax','Foundations','Open textbooks',null,'https://openstax.org/subjects/business','Open','OpenStax licence on each book applies.','Peer-reviewed accounting, finance, economics and management textbooks.'],
      ['Financial Theory','Open Yale Courses','Finance','Open course','Yale University','https://oyc.yale.edu/economics/econ-251','Open','Open Yale Courses terms apply.','Video lectures, syllabus and problem materials on the financial system.'],
      ['MBA Curriculum','Harvard Business School','Programme design','Official programme page','Harvard Business School','https://www.hbs.edu/mba/academic-experience/curriculum','Public official page','Reference only.','Official outline of RC, FIELD, summer work experience and EC.'],
      ['Cases Catalogue','Harvard Business Publishing','Cross-disciplinary','Licensed catalogue',null,'https://www.hbsp.harvard.edu/cases','Paid/restricted','Purchase or institutional access required. Do not upload content to the tutor.','Catalogue link only; no case content is reproduced.']
    ].forEach(x=>reading.run(...x));

    const event = db.prepare('INSERT INTO calendar_events(term_id,course_id,title,event_type,starts_at,ends_at,location,required,description) VALUES (?,?,?,?,?,?,?,?,?)');
    [
      [2,courseByCode.FIN101,'Finance I · Case discussion','Class','2026-11-16T09:00:00+05:30','2026-11-16T10:30:00+05:30','Aldrich Virtual 1',1,'Cold call opens the Northstar capital decision.'],
      [2,courseByCode.LDR101,'Leadership squad lab','Lab','2026-11-17T14:00:00+05:30','2026-11-17T16:00:00+05:30','Team Studio',1,'Role-play, observer notes and behavioural feedback.'],
      [2,courseByCode.ACC101,'Earnings Quality Memo due','Deadline','2026-11-18T18:00:00+05:30','2026-11-18T18:00:00+05:30','Online',1,'Individual submission.'],
      [2,courseByCode.MKT101,'Marketing debate: focus vs breadth','Debate','2026-11-19T11:00:00+05:30','2026-11-19T12:30:00+05:30','Aldrich Virtual 2',1,'Study groups defend opposing segment choices.'],
      [2,courseByCode.STR101,'Strategy study group','Study group','2026-11-20T07:30:00+05:30','2026-11-20T08:30:00+05:30','Group room',0,'Prepare the Aster AI case.'],
      [2,courseByCode.FIN101,'Finance I Midterm','Exam','2026-11-30T10:00:00+05:30','2026-11-30T12:00:00+05:30','Exam Hall',1,'Applied problems and executive recommendation.'],
      [2,null,'Core A final examinations','Exam period','2026-12-10T09:00:00+05:30','2026-12-18T17:00:00+05:30','Multiple',1,'Course-specific final assessments.']
    ].forEach(x=>event.run(...x));

    db.prepare('INSERT INTO study_groups VALUES (?,?,?,?)').run(1,'Atlas Section C · Group 4','Daily case preparation and rotating devil’s advocate','Mon/Wed/Fri · 07:30');
    const member = db.prepare('INSERT INTO study_group_members VALUES (?,?,?)');
    [['Maya Rao','Synthesizer'],['Daniel Kim','Quant lead'],['Amina Okafor','Customer lens'],['Lucas Meyer','Devil’s advocate'],['Priya Shah','Operations lens']].forEach(x=>member.run(1,...x));

    db.prepare('INSERT INTO internships(student_id,status,objectives) VALUES (?,?,?)').run(1,'planning',json(['Own a measurable business problem','Practice stakeholder influence','Produce an evidence-backed impact memo']));
    const req = db.prepare('INSERT INTO requirements(code,title,description,target_value,metric,sequence) VALUES (?,?,?,?,?,?)');
    [
      ['CORE','Complete required core','Pass every foundation and core course.',14,'courses',1],
      ['CREDITS','Earn programme credits','Earn at least 60 simulation credits, including capstone.',60,'credits',2],
      ['DEPTH','Complete specialization depth','Pass at least three electives in the selected pathway.',3,'electives',3],
      ['INTERNSHIP','Complete summer practice','Approved goals, eight weekly logs, supervisor evidence and impact memo.',1,'internship',4],
      ['CAPSTONE','Pass capstone and defence','Score at least 70 on the integrative capstone.',70,'score',5],
      ['STANDING','Maintain academic standing','Weighted average of at least 70 with no failed required course.',70,'average',6],
      ['INTEGRITY','Affirm academic integrity','Complete the final authorship and responsible-AI attestation.',1,'attestation',7]
    ].forEach(x=>req.run(...x));
    const si = db.prepare('INSERT INTO source_registry(institution,title,source_url,source_type,official,use_in_product,content_boundary) VALUES (?,?,?,?,?,?,?)');
    sources.forEach(x=>si.run(...x));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

migrate();
seed();

function all(sql, ...params) { return db.prepare(sql).all(...params); }
function get(sql, ...params) { return db.prepare(sql).get(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }

module.exports = { db, DB_PATH, all, get, run, now };
