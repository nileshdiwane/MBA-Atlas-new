const PROFESSORS = {
  Finance: {
    name: 'Professor Elena Marín', title: 'Finance & Valuation', initials: 'EM', color: '#315f8f',
    stance: 'Makes the learner turn a recommendation into cash flows, scenarios and financing consequences.',
    concepts: ['cash flow','npv','valuation','discount rate','risk','scenario','sensitivity','capital','option','return'],
    coldCalls: ['What is your decision—in one sentence?', 'Which two assumptions explain most of the value?', 'What would make you reject your own recommendation?']
  },
  Marketing: {
    name: 'Professor Jonah Reed', title: 'Marketing & Customer Choice', initials: 'JR', color: '#c26a3b',
    stance: 'Pushes from vague markets to a chosen customer, urgent need, differentiated promise and profitable route to demand.',
    concepts: ['customer','segment','need','positioning','willingness to pay','channel','retention','acquisition','price','experiment'],
    coldCalls: ['Whose behaviour must change?', 'Why this segment before the others?', 'What evidence would falsify your positioning?']
  },
  Strategy: {
    name: 'Professor Imani Cole', title: 'Strategy & Competitive Advantage', initials: 'IC', color: '#7b6238',
    stance: 'Challenges arena definition, sources of advantage, commitments and the logic connecting choices.',
    concepts: ['advantage','capability','industry','trade-off','competitor','value','choice','commitment','activity','barrier'],
    coldCalls: ['What will you not do?', 'Why can competitors not copy this?', 'Which commitment makes the strategy real?']
  },
  Economics: {
    name: 'Professor Arjun Mehta', title: 'Economics, Data & Decisions', initials: 'AM', color: '#557244',
    stance: 'Tests incentives, counterfactuals, causal claims, uncertainty and policy effects.',
    concepts: ['incentive','elasticity','marginal','counterfactual','causal','probability','regression','market','game','externality'],
    coldCalls: ['Compared with what counterfactual?', 'Who changes behaviour when this incentive changes?', 'What can the data not tell you?']
  },
  Operations: {
    name: 'Professor Hana Sato', title: 'Operations & Technology', initials: 'HS', color: '#3d718b',
    stance: 'Forces a process view: flow, capacity, variability, queues, buffers and system-level trade-offs.',
    concepts: ['process','capacity','bottleneck','flow','queue','variability','inventory','quality','cycle time','utilization'],
    coldCalls: ['Where exactly is the constraint?', 'What happens to the queue at higher utilization?', 'Which local improvement could hurt the whole system?']
  },
  Leadership: {
    name: 'Professor Nia Bennett', title: 'Leadership & Organizations', initials: 'NB', color: '#a04f68',
    stance: 'Separates judgement about people from diagnosis of systems, power, incentives, culture and behaviour.',
    concepts: ['behaviour','incentive','power','conflict','team','culture','feedback','stakeholder','trust','decision rights'],
    coldCalls: ['What behaviour did you actually observe?', 'How are you contributing to this problem?', 'What difficult conversation happens first?']
  },
  Entrepreneurship: {
    name: 'Professor Mateo Silva', title: 'Entrepreneurship & Venture Building', initials: 'MS', color: '#9a6139',
    stance: 'Turns conviction into a falsifiable venture thesis, disciplined experiment and financing plan.',
    concepts: ['problem','founder','experiment','hypothesis','traction','unit economics','runway','business model','customer','milestone'],
    coldCalls: ['What must be true for this venture to work?', 'What is the cheapest test this week?', 'Which milestone earns the next dollar of capital?']
  }
};

const evidenceWords = ['because','evidence','data','shows','exhibit','estimate','calculated','observed','survey','interview','cohort','margin','rate','cost','revenue'];
const tradeoffWords = ['however','trade-off','alternative','option','versus','instead','downside','while','although','counter'];
const riskWords = ['risk','mitigate','monitor','trigger','threshold','pilot','stage','contingency','reverse','scenario'];
const stakeholderWords = ['employee','customer','supplier','investor','community','regulator','stakeholder','ethical','fair','trust'];
const decisionWords = ['recommend','decide','choose','approve','reject','stage','prioritize','invest','launch','stop','partner','acquire','build'];

function countMatches(text, terms) {
  const lower = text.toLowerCase();
  return terms.filter(t => lower.includes(t)).length;
}
function clip(text, n=170) { return text.length > n ? text.slice(0,n-1).trim() + '…' : text; }

function evaluate(area, message, context={}) {
  const p = PROFESSORS[area] || PROFESSORS.Strategy;
  const words = message.trim().split(/\s+/).filter(Boolean);
  const decision = Math.min(1, countMatches(message, decisionWords) / 1);
  const evidence = Math.min(1, countMatches(message, evidenceWords) / 3);
  const domain = Math.min(1, countMatches(message, p.concepts) / 3);
  const tradeoffs = Math.min(1, countMatches(message, tradeoffWords) / 2);
  const risk = Math.min(1, countMatches(message, riskWords) / 2);
  const stakeholders = Math.min(1, countMatches(message, stakeholderWords) / 2);
  const depth = Math.min(1, words.length / 140);
  const score = Math.round(100 * (0.18*decision + 0.22*evidence + 0.20*domain + 0.14*tradeoffs + 0.12*risk + 0.07*stakeholders + 0.07*depth));
  const gaps = [];
  if (!decision) gaps.push('a clear decision');
  if (evidence < .55) gaps.push('specific evidence or numbers');
  if (domain < .55) gaps.push(`${area.toLowerCase()} logic`);
  if (tradeoffs < .5) gaps.push('a serious alternative and trade-off');
  if (risk < .5) gaps.push('risk, trigger and mitigation');
  if (stakeholders < .5) gaps.push('stakeholder consequences');
  const strengths = [];
  if (decision) strengths.push('You took a position');
  if (evidence >= .55) strengths.push('you used concrete support');
  if (domain >= .55) strengths.push(`you applied relevant ${area.toLowerCase()} concepts`);
  if (tradeoffs >= .5) strengths.push('you acknowledged alternatives');
  const follow = chooseFollowUp(p, gaps, context);
  const opening = strengths.length ? `${strengths.join('; ')}.` : 'You have started the analysis, but the recommendation is not yet decision-ready.';
  const gapText = gaps.length ? `Strengthen it with ${gaps.slice(0,3).join(', ')}.` : 'The structure is strong; now test it under a hostile scenario.';
  const feedback = `${opening} ${gapText}`;
  return { score: Math.max(18, score), gaps, feedback, followUp: follow, dimensions: { decision:Math.round(decision*100), evidence:Math.round(evidence*100), domain:Math.round(domain*100), tradeoffs:Math.round(tradeoffs*100), risk:Math.round(risk*100), stakeholders:Math.round(stakeholders*100) } };
}

function chooseFollowUp(p, gaps, context) {
  if (gaps.includes('a clear decision')) return p.coldCalls[0];
  if (gaps.includes('specific evidence or numbers')) return 'Which exhibit, calculation or observation is doing the most work in your argument? Quantify it.';
  if (gaps.includes('a serious alternative and trade-off')) return 'State the strongest competing recommendation as if you believed it. Why does yours still win?';
  if (gaps.includes('risk, trigger and mitigation')) return 'Name one measurable trigger that would cause you to pause or reverse course.';
  if (gaps.includes('stakeholder consequences')) return 'Who bears the downside of your decision, and what responsibility follows from that?';
  return context.mode === 'cold-call' ? p.coldCalls[2] : 'Now assume your most important assumption is wrong by 30%. What changes?';
}

function localReply(area, message, context={}) {
  const p = PROFESSORS[area] || PROFESSORS.Strategy;
  const e = evaluate(area, message, context);
  const lead = context.mode === 'teach'
    ? `Use a decision spine: decision → evidence → mechanism → alternative → risk → action. In ${area.toLowerCase()}, the mechanism matters: ${p.stance.toLowerCase()}`
    : e.feedback;
  return {
    professor: p,
    response: `${lead}\n\n**Challenge:** ${e.followUp}`,
    ...e,
    engine: 'local-socratic'
  };
}

async function externalReply(area, message, context={}) {
  if (!process.env.OPENAI_API_KEY) return null;
  const p = PROFESSORS[area] || PROFESSORS.Strategy;
  const local = evaluate(area, message, context);
  const prompt = `You are ${p.name}, a demanding but constructive MBA professor of ${area}. ${p.stance}\nThe student is using an independent educational simulation. Never claim affiliation with a university. Do not request or reproduce licensed case text.\nRespond in at most 180 words. First assess the student's decision, evidence, assumptions, alternatives, implementation risk, and stakeholders. Then ask exactly one Socratic follow-up.\nContext: ${JSON.stringify(context)}\nStudent: ${clip(message, 5000)}`;
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`}, body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini', input:prompt, max_output_tokens:320}) });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap(o=>o.content||[]).map(c=>c.text).filter(Boolean).join('\n');
    if (!text) return null;
    return { professor:p, response:text, ...local, engine:'external-ai' };
  } catch { return null; }
}

async function reply(area, message, context={}) {
  return (await externalReply(area, message, context)) || localReply(area, message, context);
}

module.exports = { PROFESSORS, evaluate, localReply, reply };
