const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { all, get, run, now, DB_PATH } = require('./db');
const { PROFESSORS, reply } = require('./professor');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC = path.join(__dirname, 'public');
const STUDENT_ID = 1;
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

function send(res, status, body, type='application/json; charset=utf-8') {
  const content = type.includes('json') && typeof body !== 'string' ? JSON.stringify(body) : body;
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(content);
}
function fail(res, status, message, details) { send(res, status, {error:message, details}); }
function parseJson(value, fallback=[]) { try { return JSON.parse(value); } catch { return fallback; } }
async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if(size>1_000_000) throw new Error('Request too large'); chunks.push(chunk); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('Invalid JSON'); }
}
function gradeLetter(score) { return score>=93?'A':score>=90?'A-':score>=87?'B+':score>=83?'B':score>=80?'B-':score>=77?'C+':score>=70?'C':score>=60?'D':'F'; }
function percent(rows) { return rows.length ? Math.round(rows.reduce((s,x)=>s+Number(x.score||0),0)/rows.length) : null; }

function student() { return get('SELECT * FROM students WHERE id=?', STUDENT_ID); }
function getCourses() {
  return all(`SELECT c.*, e.status AS enrollment_status, e.progress, e.final_grade, e.letter_grade, e.term_id
    FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id AND e.student_id=? ORDER BY c.required DESC,c.phase,c.code`,STUDENT_ID);
}
function dashboard() {
  const s=student();
  const currentTerm=get('SELECT * FROM terms WHERE id=?',s.current_term_id);
  const active=all(`SELECT c.id,c.code,c.title,c.area,c.color,e.progress,e.status,
    (SELECT COUNT(*) FROM assignments a WHERE a.course_id=c.id) AS assignment_count,
    (SELECT COUNT(*) FROM submissions sub JOIN assignments a2 ON a2.id=sub.assignment_id WHERE a2.course_id=c.id AND sub.student_id=? AND sub.status='submitted') AS submitted_count
    FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.status='active' ORDER BY c.code`,STUDENT_ID,STUDENT_ID);
  const deadlines=all(`SELECT a.id,a.title,a.type,a.due_at,a.points,c.code,c.title AS course,c.color,s.status AS submission_status
    FROM assignments a JOIN courses c ON c.id=a.course_id JOIN enrollments e ON e.course_id=c.id AND e.student_id=?
    LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=?
    WHERE a.due_at IS NOT NULL AND (s.status IS NULL OR s.status!='submitted') ORDER BY a.due_at LIMIT 6`,STUDENT_ID,STUDENT_ID);
  const events=all(`SELECT ce.*,c.code,c.color FROM calendar_events ce LEFT JOIN courses c ON c.id=ce.course_id WHERE ce.ends_at>=? ORDER BY ce.starts_at LIMIT 6`,now());
  const grades=all('SELECT score FROM grade_items WHERE student_id=?',STUDENT_ID);
  const evidence=all('SELECT competency,ROUND(AVG(score),0) AS score,COUNT(*) AS evidence_count FROM competency_evidence WHERE student_id=? GROUP BY competency',STUDENT_ID);
  return {student:s,currentTerm,active,deadlines,events,average:percent(grades),evidence,disclaimer:'Independent educational simulation · not affiliated with or accredited by Harvard University or any other school.'};
}
function courseDetail(id) {
  const c=get(`SELECT c.*,e.status AS enrollment_status,e.progress,e.final_grade,e.letter_grade,e.term_id FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id AND e.student_id=? WHERE c.id=?`,STUDENT_ID,id);
  if(!c) return null;
  c.modules=all('SELECT * FROM modules WHERE course_id=? ORDER BY sequence',id).map(m=>({...m,learning_objectives:parseJson(m.learning_objectives)}));
  c.assignments=all(`SELECT a.*,s.id AS submission_id,s.status AS submission_status,s.score,s.feedback,s.content,s.submitted_at FROM assignments a LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=? WHERE a.course_id=? ORDER BY a.due_at`,STUDENT_ID,id).map(a=>({...a,rubric:parseJson(a.rubric)}));
  c.grades=all('SELECT * FROM grade_items WHERE student_id=? AND course_id=? ORDER BY graded_at DESC',STUDENT_ID,id);
  return c;
}
function cases() { return all('SELECT * FROM cases ORDER BY access_type,title').map(c=>({...c,exhibits:parseJson(c.exhibits),preparation_questions:parseJson(c.preparation_questions),preparation:get('SELECT * FROM case_preparations WHERE student_id=? AND case_id=?',STUDENT_ID,c.id)})); }
function transcript() {
  const terms=all('SELECT * FROM terms ORDER BY sequence');
  const records=all(`SELECT t.title AS term,t.sequence,c.code,c.title,c.credits,e.status,e.progress,e.final_grade,e.letter_grade
    FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN terms t ON t.id=e.term_id WHERE e.student_id=? ORDER BY t.sequence,c.code`,STUDENT_ID);
  const grades=all('SELECT score,weight FROM grade_items WHERE student_id=?',STUDENT_ID);
  const weighted = grades.length ? Math.round(grades.reduce((s,g)=>s+g.score*g.weight,0)/grades.reduce((s,g)=>s+g.weight,0)) : null;
  return {terms,records,weightedAverage:weighted,earnedCredits:records.filter(r=>r.status==='completed').reduce((s,r)=>s+r.credits,0),note:'Simulation transcript only. It is not an academic record from any university.'};
}
function audit() {
  const reqs=all('SELECT * FROM requirements ORDER BY sequence');
  const records=all(`SELECT c.*,e.status,e.final_grade FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=?`,STUDENT_ID);
  const coreCompleted=records.filter(r=>r.required && ['foundation','core-a','core-b'].includes(r.phase) && r.status==='completed').length;
  const credits=records.filter(r=>r.status==='completed').reduce((s,r)=>s+r.credits,0);
  const depth=records.filter(r=>r.phase==='elective'&&r.status==='completed'&&r.specialization===student().specialization).length;
  const internship=get('SELECT * FROM internships WHERE student_id=?',STUDENT_ID);
  const logs=internship?get('SELECT COUNT(*) AS n FROM internship_logs WHERE internship_id=?',internship.id).n:0;
  const cap=records.find(r=>r.phase==='capstone');
  const gradeRows=all('SELECT score FROM grade_items WHERE student_id=?',STUDENT_ID); const avg=percent(gradeRows)||0;
  const values={CORE:coreCompleted,CREDITS:credits,DEPTH:depth,INTERNSHIP:internship?.status==='completed'&&logs>=8?1:0,CAPSTONE:cap?.final_grade||0,STANDING:avg,INTEGRITY:0};
  return reqs.map(r=>({...r,current_value:values[r.code]||0,met:(values[r.code]||0)>=r.target_value}));
}
function professors() { return Object.entries(PROFESSORS).map(([area,p])=>({area,...p})); }

async function api(req,res,url) {
  const p=url.pathname;
  if(req.method==='GET'&&p==='/api/bootstrap') return send(res,200,{student:student(),terms:all('SELECT * FROM terms ORDER BY sequence'),professors:professors(),sources:all('SELECT * FROM source_registry ORDER BY institution,title')});
  if(req.method==='GET'&&p==='/api/dashboard') return send(res,200,dashboard());
  if(req.method==='GET'&&p==='/api/courses') return send(res,200,getCourses());
  if(req.method==='GET'&&/^\/api\/courses\/\d+$/.test(p)) { const c=courseDetail(Number(p.split('/').pop())); return c?send(res,200,c):fail(res,404,'Course not found'); }
  if(req.method==='GET'&&p==='/api/cases') return send(res,200,cases());
  if(req.method==='GET'&&p==='/api/readings') return send(res,200,all('SELECT * FROM readings ORDER BY area,title'));
  if(req.method==='GET'&&p==='/api/calendar') return send(res,200,all(`SELECT ce.*,c.code,c.title AS course,c.color FROM calendar_events ce LEFT JOIN courses c ON c.id=ce.course_id ORDER BY ce.starts_at`));
  if(req.method==='GET'&&p==='/api/transcript') return send(res,200,transcript());
  if(req.method==='GET'&&p==='/api/requirements') return send(res,200,audit());
  if(req.method==='GET'&&p==='/api/professors') return send(res,200,professors());
  if(req.method==='GET'&&p==='/api/professor/history') { const area=url.searchParams.get('area'); return send(res,200,all('SELECT * FROM professor_messages WHERE student_id=? AND (? IS NULL OR professor_area=?) ORDER BY created_at',STUDENT_ID,area,area)); }
  if(req.method==='GET'&&p==='/api/study-group') return send(res,200,{group:get('SELECT * FROM study_groups WHERE id=1'),members:all('SELECT * FROM study_group_members WHERE group_id=1'),preparations:all(`SELECT cp.*,c.title FROM case_preparations cp JOIN cases c ON c.id=cp.case_id WHERE cp.student_id=? ORDER BY cp.submitted_at DESC`,STUDENT_ID)});
  if(req.method==='GET'&&p==='/api/internship') { const i=get('SELECT * FROM internships WHERE student_id=?',STUDENT_ID); return send(res,200,{...i,objectives:parseJson(i.objectives),logs:all('SELECT * FROM internship_logs WHERE internship_id=? ORDER BY week_number',i.id)}); }
  if(req.method==='GET'&&p==='/api/sources') return send(res,200,all('SELECT * FROM source_registry ORDER BY institution,title'));

  if(req.method==='POST'&&p==='/api/enroll') {
    const b=await body(req); const course=get('SELECT * FROM courses WHERE id=?',Number(b.courseId));
    if(!course) return fail(res,404,'Course not found');
    if(course.required) return fail(res,400,'Required courses are scheduled automatically');
    if(get('SELECT id FROM enrollments WHERE student_id=? AND course_id=?',STUDENT_ID,course.id)) return fail(res,409,'Already enrolled');
    run('INSERT INTO enrollments(student_id,course_id,term_id,status,progress,enrolled_at) VALUES (?,?,?,?,?,?)',STUDENT_ID,course.id,Number(b.termId||5),'planned',0,now());
    return send(res,201,{ok:true,message:`${course.code} added to your plan.`});
  }
  if(req.method==='POST'&&p==='/api/submissions') {
    const b=await body(req); const a=get('SELECT * FROM assignments WHERE id=?',Number(b.assignmentId));
    if(!a) return fail(res,404,'Assignment not found');
    if(!String(b.content||'').trim()) return fail(res,400,'Submission content is required');
    run(`INSERT INTO submissions(student_id,assignment_id,content,attachment_name,submitted_at,status) VALUES (?,?,?,?,?,'submitted')
      ON CONFLICT(student_id,assignment_id) DO UPDATE SET content=excluded.content,attachment_name=excluded.attachment_name,submitted_at=excluded.submitted_at,status='submitted'`,STUDENT_ID,a.id,String(b.content).trim(),b.attachmentName||null,now());
    return send(res,201,{ok:true,message:'Submission saved. Your work remains editable until it is graded.'});
  }
  if(req.method==='POST'&&p==='/api/case-prep') {
    const b=await body(req); const c=get('SELECT * FROM cases WHERE id=?',Number(b.caseId));
    if(!c) return fail(res,404,'Case not found');
    if(c.access_type!=='Embedded original') return fail(res,400,'Preparation can only be stored for cases you are legally entitled to use');
    for(const key of ['position','analysis','evidence','alternatives','risks']) if(!String(b[key]||'').trim()) return fail(res,400,`Complete ${key} before submitting`);
    run(`INSERT INTO case_preparations(student_id,case_id,position,analysis,evidence,alternatives,risks,confidence,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(student_id,case_id) DO UPDATE SET position=excluded.position,analysis=excluded.analysis,evidence=excluded.evidence,alternatives=excluded.alternatives,risks=excluded.risks,confidence=excluded.confidence,submitted_at=excluded.submitted_at`,STUDENT_ID,c.id,b.position,b.analysis,b.evidence,b.alternatives,b.risks,Number(b.confidence||50),now());
    return send(res,201,{ok:true,message:'Case preparation saved. Bring a one-sentence decision to your study group.'});
  }
  if(req.method==='POST'&&p==='/api/participation') {
    const b=await body(req); const course=get('SELECT * FROM courses WHERE id=?',Number(b.courseId));
    if(!course) return fail(res,404,'Course not found');
    const score=Math.max(0,Math.min(100,Number(b.score||0)));
    run('INSERT INTO grade_items(student_id,course_id,title,category,weight,score,graded_at,feedback) VALUES (?,?,?,?,?,?,?,?)',STUDENT_ID,course.id,b.title||'Class participation','Participation',Number(b.weight||5),score,now(),b.feedback||'Formative participation record.');
    run('INSERT INTO competency_evidence(student_id,competency,source_type,source_id,score,note,recorded_at) VALUES (?,?,?,?,?,?,?)',STUDENT_ID,b.competency||'Executive communication','participation',course.id,score,b.feedback||'Participation evidence',now());
    return send(res,201,{ok:true,message:'Participation and competency evidence recorded.'});
  }
  if(req.method==='POST'&&p==='/api/professor/chat') {
    const b=await body(req); const area=String(b.area||'Strategy'); const message=String(b.message||'').trim();
    if(!PROFESSORS[area]) return fail(res,400,'Unknown professor area');
    if(message.length<12) return fail(res,400,'Give the professor enough analysis to challenge');
    const c=b.caseId?get('SELECT id,title,decision_prompt,access_type FROM cases WHERE id=?',Number(b.caseId)):null;
    if(c&&c.access_type!=='Embedded original') return fail(res,400,'Licensed external case text cannot be sent to the AI professor');
    run('INSERT INTO professor_messages(student_id,professor_area,case_id,role,message,created_at) VALUES (?,?,?,?,?,?)',STUDENT_ID,area,c?.id||null,'student',message,now());
    const result=await reply(area,message,{mode:b.mode||'discuss',caseTitle:c?.title||null,decisionPrompt:c?.decision_prompt||null});
    const gaps=JSON.stringify(result.gaps);
    run('INSERT INTO professor_messages(student_id,professor_area,case_id,role,message,score,gaps,created_at) VALUES (?,?,?,?,?,?,?,?)',STUDENT_ID,area,c?.id||null,'professor',result.response,result.score,gaps,now());
    run('INSERT INTO competency_evidence(student_id,competency,source_type,source_id,score,note,recorded_at) VALUES (?,?,?,?,?,?,?)',STUDENT_ID,`${area} judgement`,'professor',c?.id||null,result.score,result.feedback,now());
    return send(res,201,result);
  }
  if(req.method==='POST'&&p==='/api/internship') {
    const b=await body(req);
    run(`UPDATE internships SET organization=?,role=?,location=?,start_date=?,end_date=?,supervisor=?,objectives=?,status=?,final_reflection=? WHERE student_id=?`,b.organization||null,b.role||null,b.location||null,b.startDate||null,b.endDate||null,b.supervisor||null,JSON.stringify(b.objectives||[]),b.status||'planning',b.finalReflection||null,STUDENT_ID);
    return send(res,200,{ok:true,message:'Internship plan saved.'});
  }
  if(req.method==='POST'&&p==='/api/internship/log') {
    const b=await body(req); const i=get('SELECT id FROM internships WHERE student_id=?',STUDENT_ID);
    if(!i) return fail(res,404,'Internship record not found');
    run(`INSERT INTO internship_logs(internship_id,week_number,achievement,challenge,learning,manager_feedback,created_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(internship_id,week_number) DO UPDATE SET achievement=excluded.achievement,challenge=excluded.challenge,learning=excluded.learning,manager_feedback=excluded.manager_feedback,created_at=excluded.created_at`,i.id,Number(b.weekNumber),b.achievement,b.challenge,b.learning,b.managerFeedback||null,now());
    return send(res,201,{ok:true,message:'Weekly practice log saved.'});
  }
  if(req.method==='POST'&&p==='/api/profile') {
    const b=await body(req); if(!String(b.name||'').trim()) return fail(res,400,'Name is required');
    run('UPDATE students SET name=?,specialization=? WHERE id=?',String(b.name).trim(),b.specialization||'Strategy',STUDENT_ID);
    return send(res,200,{ok:true,student:student()});
  }
  return fail(res,404,'API route not found');
}

function staticFile(req,res,url) {
  const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const normalized=path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const file=path.join(PUBLIC,normalized);
  if(!file.startsWith(PUBLIC)) return fail(res,403,'Forbidden');
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()) {
      const index=path.join(PUBLIC,'index.html');
      return fs.readFile(index,(e,data)=>e?fail(res,404,'Not found'):send(res,200,data,mime['.html']));
    }
    fs.readFile(file,(e,data)=>e?fail(res,500,'Unable to read file'):send(res,200,data,mime[path.extname(file)]||'application/octet-stream'));
  });
}

function createServer() {
  return http.createServer(async (req,res)=>{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    try { if(url.pathname.startsWith('/api/')) return await api(req,res,url); return staticFile(req,res,url); }
    catch(error) { console.error(error); return fail(res,error.message==='Invalid JSON'?400:500,error.message==='Invalid JSON'?error.message:'Unexpected server error',process.env.NODE_ENV==='development'?error.stack:undefined); }
  });
}

if(require.main===module) createServer().listen(PORT,HOST,()=>console.log(`MBA Atlas running at http://${HOST}:${PORT}\nDatabase: ${DB_PATH}`));
module.exports={createServer,dashboard,courseDetail,audit,transcript};
