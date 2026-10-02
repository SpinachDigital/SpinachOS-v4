# Laya — System 1 Fast Router for Spinach OS
# Runs on http://localhost:8000
# POST /decide { "message": "..." } -> { "department": "...", "priority": "high|medium|low", "confidence": 0.0-1.0, "tasks": [...] }

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import uvicorn
import re
import json

app = FastAPI(title="Laya - System 1 Router")

class DecideRequest(BaseModel):
    message: str

class TaskObject(BaseModel):
    input: str
    department: str
    priority: str
    agent: str
    status: str = "pending"
    confidence: float = 1.0

class DecideResponse(BaseModel):
    department: str
    priority: str
    confidence: float
    tasks: List[TaskObject] = []

# Department keywords (System 1 pattern matching - fast, no LLM)
# Department keywords — individual keyword list per department.
# Score = COUNT of keyword hits (not 1/0 per department) so "create a social media post"
# scores marketing 2 (social media, post) vs engineering 1 (create) → marketing wins.
# Tie-break below prefers content-creation departments.
DEPARTMENT_PATTERNS = {
    'engineering': [
        'build', 'develop', 'code', 'engineer', 'implement', 'deploy', 'backend',
        'frontend', 'api', 'database', 'server', 'devops', 'infra', 'technical',
        'website', 'app', 'application', 'landing page', 'tech stack',
        'architecture', 'fix', 'bug', 'refactor', 'html',
    ],
    'marketing': [
        'campaign', 'ads', 'instagram', 'facebook', 'meta', 'google ads',
        'seo', 'content calendar', 'social media', 'post', 'reel', 'story',
        'engagement', 'growth', 'promote', 'brand awareness', 'viral',
        'advertise', 'tweet', 'tweetx', 'twitter', 'x post', 'linkedin',
        'threads', 'social', 'follower', 'hashtag', 'announcement',
    ],
    'design': [
        'design', 'ui', 'ux', 'figma', 'prototype', 'mockup', 'wireframe',
        'visual', 'brand', 'logo', 'palette', 'typography', 'layout',
        'creative', 'asset', 'banner', 'graphic', 'icon',
    ],
    'sales': [
        'sell', 'pitch', 'outreach', 'cold email', 'lead', 'prospect',
        'deal', 'proposal', 'quote', 'demo', 'close', 'pipeline', 'revenue',
        'account', 'sales', 'quota', 'cold outreach', 'lead gen',
        'lead generation', 'win', 'client acquisition', 'follow up',
    ],
    'content': [
        'write', 'copy', 'blog', 'article', 'script', 'caption', 'newsletter',
        'email', 'narrative', 'messaging', 'tone', 'voice', 'editorial',
        'content',
    ],
    'research': [
        'research', 'analyze', 'analysis', 'market', 'competitor', 'trend',
        'data', 'insight', 'report', 'study', 'survey', 'intel', 'investigate',
    ],
    'operations': [
        'ops', 'operation', 'process', 'workflow', 'automation', 'schedule',
        'calendar', 'standup', 'meeting', 'admin', 'hire', 'onboard',
        'policy', 'compliance', 'status update', 'task status', 'progress',
    ],
    'hr': [
        'hr', 'human resources', 'hire', 'hiring', 'onboard', 'onboarding',
        'recruit', 'candidate', 'interview', 'payroll', 'leave', 'employee',
        'team member', 'headcount', 'offboard', 'timesheet',
    ],
}

# Content-creation verbs: when tied, these prefer marketing/content over engineering
# ("generate a post", "make a tweet" — 'create'/'make' alone don't make it engineering)
CONTENT_CREATION_VERBS = ['generate', 'generate a', 'make', 'write', 'draft', 'post', 'create a post']

# Agent mapping
# Sprint 9 §5: hr is a real department now (hr_director profile) — hr commands
# used to fall through to operations→orchestrator (×3 measured confusion).
DEPARTMENT_TO_AGENT = {
    'engineering': 'engineering',
    'marketing': 'social',
    'design': 'design',
    'sales': 'sales',
    'content': 'social',
    'research': 'research',
    'operations': 'ops',
    'hr': 'hr_director',
}

# Priority keywords
HIGH_PRIORITY = [
    r'\b(urgent|asap|immediately|critical|emergency|blocker|down|outage|deadline|today|now|high priority|p0|p1)\b',
]
LOW_PRIORITY = [
    r'\b(later|someday|eventually|backlog|low priority|nice to have|when possible|no rush|p3|p4)\b',
]

# Strategy bypass keywords
STRATEGY_KEYWORDS = [
    'should we', 'strategy', 'idea', 'plan', 'what if', 'evaluate', 'direction', 'vision', 'approve'
]

# Multi-intent separators
MULTI_INTENT_SPLITTERS = [
    r'\s+and\s+', r'\s+then\s+', r',\s*', r'\s*;\s*', r'\s+\|\s*', r'\s+plus\s+'
]

def classify_department(message: str) -> tuple[str, float]:
    """Per-keyword weighted matching — returns (department, confidence).
    Score = number of keyword hits per department (ties broken toward content-creation)."""
    msg = message.lower()
    scores: dict[str, int] = {}
    for dept, keywords in DEPARTMENT_PATTERNS.items():
        # Sprint 8: word-boundary matching — substring matching caused false
        # positives ("post" matched inside "postpone", "ad" inside "add").
        # Multi-word keywords keep substring semantics (regex-escaped).
        def kw_hit(kw: str) -> bool:
            if ' ' in kw:
                return kw in msg
            return re.search(r'\b' + re.escape(kw) + r'\b', msg) is not None
        score = sum(1 for kw in keywords if kw_hit(kw))
        if score > 0:
            scores[dept] = score

    if not scores:
        return 'engineering', 0.3  # low confidence default

    best_score = max(scores.values())
    leaders = [d for d, s in scores.items() if s == best_score]

    if len(leaders) == 1:
        best_dept = leaders[0]
        # Sprint 9 §5 fix: ceo→marketing confusion (×2 measured) — a SINGLE weak
        # leader (1 hit) with an explicit strategy word means the intent is
        # strategic ("what is our growth strategy" hit only 'growth'→marketing).
        # Strong leaders (2+ hits) keep their department.
        weak = best_score < 2
        if weak and any(v in msg for v in ['strategy', 'should we', 'what if', 'vision', 'direction']):
            best_dept = 'strategy'
            scores['strategy'] = best_score  # keep best_score lookup valid
    else:
        # TIE-BREAK: content-creation verbs (generate/make/post) prefer marketing/content
        # over engineering. "create a social media post" ties 2-2 (create+post vs social+media)
        # → marketing wins because the INTENT is content creation, not building.
        # Sprint 9 §5 fix: sales/outreach tie-breaks — "outreach post" / "sales post"
        # used to go marketing (×6 measured confusion: sales→social). Explicit
        # sales intent keywords win the tie BEFORE content verbs apply.
        # HR tie-break: hiring/onboarding intent → hr over operations
        # (both share hire/onboard keywords — measured hr→operations ×3).
        is_sales_intent = any(v in msg for v in ['outreach', 'cold email', 'cold outreach', 'lead gen', 'prospect', 'pitch', 'follow up', 'quota'])
        is_hr_intent = any(v in msg for v in ['hire', 'hiring', 'onboard', 'onboarding', 'recruit', 'candidate', 'interview', 'payroll', 'offboard'])
        # Sprint 9 §5 fix: ceo→orchestrator/marketing confusion (×2 measured) —
        # explicit strategy words in a TIE mean the intent is strategic.
        is_strategy_intent = any(v in msg for v in ['strategy', 'should we', 'what if', 'vision', 'direction'])
        if is_sales_intent and ('sales' in leaders):
            best_dept = 'sales'
        elif is_hr_intent and ('hr' in leaders) and not is_sales_intent:
            best_dept = 'hr'
        elif is_strategy_intent and 'marketing' in leaders:
            best_dept = 'strategy'
        else:
            is_content_intent = any(v in msg for v in ['generate', 'make', 'write', 'draft'])
            if is_content_intent and ('marketing' in leaders):
                best_dept = 'marketing'
            elif is_content_intent and ('content' in leaders):
                best_dept = 'content'
            elif 'engineering' in leaders and best_score >= 2:
                # 2+ engineering hits without content intent → engineering (clear build task)
                best_dept = 'engineering'
            else:
                best_dept = leaders[0]  # first in dept order

    best_score = scores[best_dept]
    total = sum(scores.values())
    confidence = min(best_score / max(total, 1) + 0.3, 0.95)

    # HIGH CONFIDENCE OVERRIDE: clear single-dept match with 2+ hits
    if best_score >= 2 and len([d for d, s in scores.items() if s == best_score]) == 1:
        confidence = max(confidence, 0.85)

    return best_dept, round(confidence, 2)

def classify_priority(message: str) -> str:
    """Fast priority classification."""
    msg = message.lower()
    if any(re.search(p, msg) for p in HIGH_PRIORITY):
        return 'high'
    if any(re.search(p, msg) for p in LOW_PRIORITY):
        return 'low'
    return 'medium'

def is_strategy_query(message: str) -> bool:
    """Check if input should bypass Laya and go to CEO."""
    msg = message.lower()
    return any(kw in msg for kw in STRATEGY_KEYWORDS)

def split_multi_intent(message: str) -> List[str]:
    """Split multi-intent input into separate tasks."""
    # Try splitters in order
    for splitter in MULTI_INTENT_SPLITTERS:
        parts = re.split(splitter, message, flags=re.IGNORECASE)
        if len(parts) > 1:
            # Filter out empty/short parts
            filtered = [p.strip() for p in parts if len(p.strip()) > 5]
            if len(filtered) > 1:
                return filtered
    return [message]

def detect_and_create_tasks(message: str) -> List[TaskObject]:
    """Main classification logic with multi-intent support."""
    # Check for strategy bypass
    if is_strategy_query(message):
        # This should be handled by the caller, but we return a marker
        return [TaskObject(
            input=message,
            department='strategy',
            priority='high',
            agent='ceo',
            status='pending',
            confidence=1.0
        )]
    
    # Split multi-intent
    parts = split_multi_intent(message)
    
    tasks = []
    for part in parts:
        dept, confidence = classify_department(part)
        priority = classify_priority(part)
        agent = DEPARTMENT_TO_AGENT.get(dept, 'engineering')
        
        tasks.append(TaskObject(
            input=part.strip(),
            department=dept,
            priority=priority,
            agent=agent,
            status='pending',
            confidence=confidence
        ))
    
    return tasks

async def llm_fallback_classify(message: str) -> dict:
    """System 1.5: LLM fallback when confidence is low.
    Uses OmniRoute gateway (same as agent execution)."""
    try:
        prompt = f"""Classify this task into one department and priority.
Return ONLY JSON: {{"department": "...", "priority": "high|medium|low"}}

Departments: engineering, marketing, design, sales, content, research, operations, hr
Priority: high, medium, low

Task: {message}"""
        
        import json
        # Sprint 8: async httpx — blocking urllib stalled the event loop
        # (FastAPI async path). httpx.AsyncClient keeps the loop free.
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                'http://localhost:20128/v1/chat/completions',
                json={
                    'model': 'auto/best-fast',
                    'messages': [
                        {'role': 'system', 'content': 'You are a fast task classifier. Return only JSON.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'max_tokens': 100,
                    'temperature': 0.1,
                },
                headers={'Content-Type': 'application/json'},
            )
        data = resp.json()
        output = data['choices'][0]['message']['content']
        result = json.loads(output)
        return result
    except Exception as e:
        # Final fallback
        return {'department': 'engineering', 'priority': 'medium'}

@app.post("/decide", response_model=DecideResponse)
async def decide(req: DecideRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(400, "message required")
    
    message = req.message.strip()
    
    # Quick health check bypass - return minimal response without LLM
    if message.lower() in ('health check', 'health', 'ping', 'status') or len(message) < 5:
        return DecideResponse(
            department='system',
            priority='low',
            confidence=1.0,
            tasks=[]
        )
    
    # Strategy bypass check (handled by caller, but included for completeness)
    if is_strategy_query(message):
        return DecideResponse(
            department='strategy',
            priority='high',
            confidence=1.0,
            tasks=[TaskObject(
                input=message,
                department='strategy',
                priority='high',
                agent='ceo',
                status='pending',
                confidence=1.0
            )]
        )
    
    # Detect multi-intent
    parts = split_multi_intent(message)
    
    all_tasks = []
    max_confidence = 0.0
    primary_dept = 'engineering'
    primary_priority = 'medium'
    
    for part in parts:
        dept, confidence = classify_department(part)
        priority = classify_priority(part)
        agent = DEPARTMENT_TO_AGENT.get(dept, 'engineering')
        
        task = TaskObject(
            input=part.strip(),
            department=dept,
            priority=priority,
            agent=agent,
            status='pending',
            confidence=confidence
        )
        all_tasks.append(task)
        
        if confidence > max_confidence:
            max_confidence = confidence
            primary_dept = dept
            primary_priority = priority
    
    # Sprint 9 §5: ABSTENTION rule — no strong keyword match (no dept scored 2+
    # and top confidence < 0.6) → LLM fallback INSTEAD of guessing. A wrong
    # department is worse than a slow one. The old default returned
    # 'engineering' at 0.3 confidence for ANY unmatched input.
    if all_tasks and max_confidence < 0.6 and not any(
        s >= 2 for d, s in
        (lambda msg: {d: sum(1 for kw in kws if ((' ' in kw and kw in msg) or (' ' not in kw and re.search(r'\b' + re.escape(kw) + r'\b', msg)))) for d, kws in DEPARTMENT_PATTERNS.items()})(message.lower()).items()
    ):
        print(f"[LAYA] abstain: max_confidence={max_confidence} → LLM fallback")
        try:
            fallback = await llm_fallback_classify(message)
            primary_dept = fallback.get('department', primary_dept)
            primary_priority = fallback.get('priority', primary_priority)
            # Update tasks with LLM result (high confidence)
            for task in all_tasks:
                task.department = primary_dept
                task.priority = primary_priority
                task.agent = DEPARTMENT_TO_AGENT.get(primary_dept, 'engineering')
                task.confidence = 0.8
            max_confidence = 0.8
        except Exception as e:
            print(f"[DEBUG] Fallback failed: {e}")
            pass  # Keep original
    
    return DecideResponse(
        department=primary_dept,
        priority=primary_priority,
        confidence=round(max_confidence, 2),
        tasks=all_tasks
    )

@app.get("/health")
async def health():
    return {"status": "ok", "service": "laya", "version": "2.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)