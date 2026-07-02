# LangGraph Production-Readiness Audit & Roadmap

I'll perform a comprehensive audit of your LangGraph implementation and provide a concrete roadmap to production.

Now I have a complete picture. Let me create a comprehensive production-readiness audit and roadmap.

---

# LANGGRAPH PRODUCTION-READINESS AUDIT & ROADMAP

## EXECUTIVE SUMMARY

Your LangGraph implementation is a **functional prototype** with 7 distinct agents (reviewer, TA, rubrics, questions, solutions, student_answer, answer, graphrag). However, it lacks **critical production infrastructure**: no state persistence, no observability, no error recovery, and graphs are rebuilt on every request. This audit provides a concrete roadmap to production-grade LangGraph deployment.

---

## 1. CODEBASE AUDIT

### 🔴 CRITICAL ISSUES

#### **1.1 No State Persistence (Checkpointer)**
**Finding:** All 7 graphs compile with `workflow.compile()` — no checkpointer parameter.

**Impact:**
- **Zero crash recovery**: If a grading job fails mid-execution (e.g., OpenAI 429 error on question 3 of 10), the entire job restarts from scratch
- **No human-in-the-loop**: Cannot pause execution for teacher review and resume
- **No debugging**: Cannot inspect intermediate state when jobs fail

**Evidence:**
```python
# agent/utils/reviewer_agent/graph.py line 52
return workflow.compile()  # ❌ No checkpointer

# agent/utils/ta_agent/graph.py line 37
return workflow.compile()  # ❌ No checkpointer
```

**Production Requirement:** All long-running graphs (reviewer, graphrag) MUST use a checkpointer.

---

#### **1.2 Graphs Rebuilt on Every Request**
**Finding:** `build_ta_graph()` is called inside `chat_with_ta()` on every single request.

**Impact:**
- **Compilation overhead**: ~200-500ms per request wasted on graph compilation
- **Memory churn**: New graph object created and GC'd on every chat message
- **Cold start amplification**: In serverless/autoscaling, every new instance pays compilation cost

**Evidence:**
```python
# agent/utils/ta_agent/agent.py line 28
async def chat_with_ta(...):
    graph = build_ta_graph()  # ❌ Rebuilt every time
    result = graph.invoke(...)
```

**Production Requirement:** Compile graphs once at module load, reuse instances.

---

#### **1.3 No LangSmith Tracing**
**Finding:** Zero LangSmith integration. No `LANGCHAIN_TRACING_V2` environment variable, no trace IDs.

**Impact:**
- **Blind debugging**: When grading fails, you have no visibility into which LLM call failed, what the prompt was, or what the response was
- **No cost tracking**: Cannot see token usage per grading job
- **No latency analysis**: Cannot identify slow LLM calls

**Production Requirement:** LangSmith tracing is mandatory for production LangGraph apps.

---

#### **1.4 Inconsistent Error Handling**
**Finding:** Error handling is ad-hoc. Some nodes have try/except, others don't. No retry logic on LLM calls.

**Evidence:**
```python
# agent/utils/reviewer_agent/node.py
def grader_1_node(state):
    result = structured_grader_1.invoke(messages)  # ❌ No try/except, no retry
    return {"grader_1_result": {"score": result.score}}
```

**Impact:**
- **Brittle execution**: Single OpenAI 429 error fails entire grading job
- **No graceful degradation**: Cannot fall back to lower-confidence grading if one grader fails

**Production Requirement:** All LLM calls need retry logic and error boundaries.

---

#### **1.5 No Recursion Limits or Circuit Breakers**
**Finding:** TA agent has infinite loop potential. No `recursion_limit` on compile, no turn counter.

**Evidence:**
```python
# agent/utils/ta_agent/graph.py line 37
return workflow.compile()  # ❌ No recursion_limit
```

**Impact:**
- **Runaway costs**: Pathological query could loop 50+ times, costing $10+ per chat
- **Timeout failures**: Long loops hit HTTP timeout, user sees error

**Production Requirement:** All ReAct-style agents need recursion limits and token budgets.

---

### 🟡 MAJOR ISSUES

#### **1.6 Hardcoded Configuration**
**Finding:** Model names, temperatures, and prompts are hardcoded in node files.

**Evidence:**
```python
# agent/utils/reviewer_agent/node.py line 17
llm_grader_1 = ChatOpenAI(model="gpt-5.5", temperature=0.1)  # ❌ Hardcoded
```

**Impact:**
- **Cannot A/B test**: Cannot compare gpt-4o vs gpt-5.5 without code changes
- **Cannot adjust per-teacher**: Premium teachers cannot get better models
- **Deployment friction**: Changing model requires code deploy

**Production Requirement:** Configuration via `langgraph.json` and environment variables.

---

#### **1.7 No Structured Logging**
**Finding:** Mix of `print()` and `logger.info()`. No structured fields (teacher_id, assignment_id, trace_id).

**Evidence:**
```python
# agent/utils/reviewer_agent/node.py line 32
print(f"[init_supervisor] Initializing assignment queue...")  # ❌ print()
```

**Impact:**
- **Cannot correlate logs**: When grading fails, cannot find all logs for that job
- **Cannot aggregate metrics**: Cannot count "grading jobs failed" without parsing strings

**Production Requirement:** Structured logging with correlation IDs.

---

#### **1.8 State Schema Inconsistencies**
**Finding:** Some agents use `operator.add`, others use `add_messages`. No validation.

**Evidence:**
```python
# agent/utils/answer_agent/state.py line 11
messages: Annotated[Sequence[BaseMessage], operator.add]  # ❌ Should be add_messages

# agent/utils/ta_agent/state.py line 8
messages: Annotated[list[BaseMessage], add_messages]  # ✅ Correct
```

**Impact:**
- **Message deduplication broken**: `operator.add` doesn't deduplicate by ID like `add_messages`
- **State bloat**: Messages accumulate without bounds

**Production Requirement:** Standardize on `add_messages` for all message lists.

---

### 🟢 MINOR ISSUES

#### **1.9 No Dependency Pinning**
**Finding:** `pyproject.toml` uses `>=` for all dependencies.

**Impact:**
- **Non-reproducible builds**: `langgraph>=0.2.34` could pull 0.3.0 with breaking changes

**Production Requirement:** Pin exact versions for production.

---

#### **1.10 No Health Checks for Graphs**
**Finding:** No `/health` endpoint that validates graphs compile successfully.

**Impact:**
- **Silent startup failures**: If graph compilation fails, server starts but all requests fail

**Production Requirement:** Health check that compiles all graphs.

---

## 2. PRODUCTION-READINESS PLAN

### 2.1 CONFIGURATION MANAGEMENT

#### **Recommended Structure**

Create `langgraph.json` at project root:

```json
{
  "graphs": {
    "reviewer": {
      "module": "agent.utils.reviewer_agent.graph",
      "function": "build_graph",
      "checkpointer": "postgres",
      "config": {
        "grader_1_model": "gpt-5.5",
        "grader_1_temperature": 0.1,
        "grader_2_model": "gpt-5.5",
        "grader_2_temperature": 0.4,
        "weakness_model": "gpt-5.5",
        "weakness_temperature": 0.3,
        "max_retries": 3,
        "timeout_seconds": 300
      }
    },
    "ta_agent": {
      "module": "agent.utils.ta_agent.graph",
      "function": "build_ta_graph",
      "checkpointer": "postgres",
      "config": {
        "model": "gpt-5.5",
        "temperature": 0.3,
        "recursion_limit": 10,
        "max_turns": 5,
        "token_budget": 8000
      }
    },
    "graphrag_ingestion": {
      "module": "agent.utils.graphrag_agent.pipeline",
      "function": "run_ingestion_pipeline",
      "checkpointer": "postgres",
      "config": {
        "entity_model": "gpt-5.5",
        "relationship_model": "gpt-5.5",
        "embedding_model": "text-embedding-3-small",
        "chunk_size": 4000,
        "chunk_overlap": 200,
        "concurrency": 4
      }
    }
  },
  "checkpointer": {
    "type": "postgres",
    "connection_string": "${DATABASE_URL}",
    "table_name": "langgraph_checkpoints"
  },
  "tracing": {
    "enabled": true,
    "provider": "langsmith",
    "project": "brac-grading-prod",
    "sample_rate": 1.0
  }
}
```

#### **Environment Variables** (`.env.production`)

```bash
# LangSmith
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_...
LANGCHAIN_PROJECT=brac-grading-prod
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Database (for checkpointer)
DATABASE_URL=postgresql://...

# Agent Configuration
GRADER_MODEL=gpt-5.5
TA_AGENT_RECURSION_LIMIT=10
TA_AGENT_TOKEN_BUDGET=8000
GRAPHRAG_CONCURRENCY=4
```

#### **Configuration Loader** (`agent/config/langgraph_config.py`)

```python
import json
import os
from pathlib import Path

class LangGraphConfig:
    def __init__(self, config_path: str = "langgraph.json"):
        with open(config_path) as f:
            self._config = json.load(f)
    
    def get_graph_config(self, graph_name: str) -> dict:
        return self._config["graphs"][graph_name]["config"]
    
    def get_model(self, graph_name: str, model_key: str = "model") -> str:
        config = self.get_graph_config(graph_name)
        model = config.get(model_key, "gpt-5.5")
        # Allow environment override
        env_key = f"{graph_name.upper()}_{model_key.upper()}"
        return os.getenv(env_key, model)

config = LangGraphConfig()
```

#### **What Changes**

1. **Create:** `langgraph.json` at project root
2. **Create:** `agent/config/langgraph_config.py` — configuration loader
3. **Change:** All `node.py` files — replace hardcoded models:
   ```python
   # Before:
   llm = ChatOpenAI(model="gpt-5.5", temperature=0.1)
   
   # After:
   from agent.config.langgraph_config import config
   model = config.get_model("reviewer", "grader_1_model")
   temp = config.get_graph_config("reviewer")["grader_1_temperature"]
   llm = ChatOpenAI(model=model, temperature=temp)
   ```

---

### 2.2 OBSERVABILITY (LangSmith Integration)

#### **Recommended Setup**

**Step 1: Enable Tracing Globally**

```python
# agent/main.py (add at top, before graph imports)
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT", "brac-grading-dev")

from langsmith import Client
langsmith_client = Client()
```

**Step 2: Add Trace Metadata to All Graph Invocations**

```python
# agent/main.py — grading endpoint
@app.post("/internal/agent/grade/process")
async def process_grading_endpoint(request: GradeRequest):
    initial_state = {
        "teacher_id": request.teacher_id,
        "student_id": request.student_id,
        "assignment_id": request.assignment_id,
        "all_results": []
    }
    
    # Add trace metadata
    config = {
        "run_name": f"grade_{request.assignment_id}_{request.student_id}",
        "metadata": {
            "teacher_id": request.teacher_id,
            "student_id": request.student_id,
            "assignment_id": request.assignment_id,
            "job_type": "grading"
        },
        "tags": ["grading", f"teacher:{request.teacher_id}"]
    }
    
    final_state = app_graph_02.invoke(initial_state, config=config)
    return {"status": "success", "results": final_state.get("all_results", [])}
```

**Step 3: Custom Callbacks for Cost Tracking**

```python
# agent/utils/common/langsmith_callbacks.py
from langchain.callbacks.base import BaseCallbackHandler
from typing import Any, Dict

class CostTrackingCallback(BaseCallbackHandler):
    def __init__(self, teacher_id: str, assignment_id: int):
        self.teacher_id = teacher_id
        self.assignment_id = assignment_id
        self.total_tokens = 0
        self.total_cost = 0.0
    
    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        if hasattr(response, "llm_output"):
            token_usage = response.llm_output.get("token_usage", {})
            self.total_tokens += token_usage.get("total_tokens", 0)
            # Calculate cost based on model
            # Log to database
```

#### **Dashboards to Create in LangSmith**

**Day 1 Dashboards:**
1. **Grading Job Success Rate** — % of grading jobs that complete without error
2. **Average Latency per Question** — time to grade one question
3. **Token Usage by Teacher** — total tokens per teacher per day
4. **Error Rate by Node** — which nodes fail most often

**Day 30 Dashboards:**
5. **Confidence Score Distribution** — histogram of grading confidence
6. **Cost per Assignment** — $ spent grading each assignment
7. **TA Agent Turn Distribution** — how many tool calls per chat
8. **GraphRAG Ingestion Time** — syllabus processing latency

#### **Alerting Rules**

**Critical (wake someone up):**
- Grading job error rate > 10% for 5 minutes
- Any grading job taking > 10 minutes
- OpenAI API errors > 50/hour
- Database connection failures

**Warning (Slack notification):**
- Average grading latency > 60s
- TA agent hitting recursion limit > 5 times/hour
- Token usage > 80% of monthly budget

---

### 2.3 DEPLOYMENT PREPARATION

#### **Repository Structure for LangGraph Cloud**

```
brac_hacakthon/
├── langgraph.json              # ✅ Required for LangGraph Cloud
├── pyproject.toml              # ✅ Already exists
├── requirements.txt            # ⚠️ Generate from pyproject.toml
├── .env.production             # ✅ Environment variables
├── agent/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app
│   ├── config/
│   │   ├── langgraph_config.py
│   │   └── db.py
│   └── utils/
│       ├── reviewer_agent/
│       │   ├── graph.py        # Must export build_graph()
│       │   ├── node.py
│       │   ├── state.py
│       │   └── tools.py
│       ├── ta_agent/
│       └── ...
└── tests/                      # ⚠️ Add integration tests
    ├── test_reviewer_agent.py
    └── test_ta_agent.py
```

#### **Dependency Management**

**Generate `requirements.txt`:**
```bash
cd agent
uv pip compile pyproject.toml -o requirements.txt
```

**Pin exact versions:**
```txt
# requirements.txt
langgraph==0.2.34
langchain-core==1.3.3
langchain-openai==1.2.1
openai==1.40.0
fastapi==0.136.1
uvicorn==0.46.0
psycopg2-binary==2.9.12
# ... all dependencies with exact versions
```

#### **LangGraph Cloud Deployment Checklist**

- [ ] `langgraph.json` exists at project root
- [ ] All graphs export a `build_*()` function
- [ ] `requirements.txt` with pinned versions
- [ ] Environment variables documented in `.env.example`
- [ ] Health check endpoint (`/health`) validates graph compilation
- [ ] Database migrations for checkpointer table
- [ ] LangSmith project created
- [ ] Integration tests pass

---

### 2.4 STATE & PERSISTENCE

#### **Current State: No Persistence**

All graphs use in-memory state only. If a worker crashes mid-grading, all progress is lost.

#### **Production Solution: PostgresCheckpointer**

**Step 1: Create Checkpointer Table**

```sql
-- backend/supabase/migrations/20260602000000_langgraph_checkpoints.sql
CREATE TABLE langgraph_checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE INDEX idx_checkpoints_thread ON langgraph_checkpoints(thread_id, created_at DESC);
CREATE INDEX idx_checkpoints_parent ON langgraph_checkpoints(parent_checkpoint_id);
```

**Step 2: Initialize Checkpointer**

```python
# agent/config/checkpointer.py
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg2.pool import ThreadedConnectionPool
import os

# Create connection pool
db_pool = ThreadedConnectionPool(
    minconn=2,
    maxconn=10,
    dsn=os.getenv("DATABASE_URL")
)

# Create checkpointer
checkpointer = PostgresSaver(db_pool)
checkpointer.setup()  # Creates table if not exists
```

**Step 3: Compile Graphs with Checkpointer**

```python
# agent/utils/reviewer_agent/graph.py
from agent.config.checkpointer import checkpointer

def build_graph():
    workflow = StateGraph(AssignmentState)
    # ... add nodes and edges ...
    
    return workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=[],  # Can add nodes to pause at
        interrupt_after=[]
    )
```

**Step 4: Use Thread IDs for Resumability**

```python
# agent/main.py — grading endpoint
@app.post("/internal/agent/grade/process")
async def process_grading_endpoint(request: GradeRequest):
    # Generate deterministic thread_id
    thread_id = f"grade_{request.teacher_id}_{request.assignment_id}_{request.student_id}"
    
    config = {
        "configurable": {"thread_id": thread_id},
        "metadata": {...}
    }
    
    # If this job was interrupted, it will resume from last checkpoint
    final_state = app_graph_02.invoke(initial_state, config=config)
```

#### **Benefits of Checkpointing**

1. **Crash Recovery**: If worker dies on question 7 of 10, restart resumes from question 7
2. **Human-in-the-Loop**: Can pause grading for teacher review, then resume
3. **Debugging**: Can inspect exact state at any point in execution
4. **Replay**: Can re-run failed jobs from any checkpoint

#### **What Changes**

1. **New migration:** `20260602000000_langgraph_checkpoints.sql`
2. **New file:** `agent/config/checkpointer.py` — checkpointer singleton
3. **Change:** All `graph.py` files — add `checkpointer=checkpointer` to compile
4. **Change:** All graph invocations — add `thread_id` to config

---

### 2.5 ERROR HANDLING & RESILIENCE

#### **Current State: Brittle**

LLM calls have no retry logic. Single 429 error fails entire job.

#### **Production Solution: Retry + Error Boundaries**

**Pattern 1: Retry Wrapper for LLM Calls**

```python
# agent/utils/common/retry.py
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import RateLimitError, APIError
import logging

logger = logging.getLogger(__name__)

def with_retry(func):
    """Decorator for LLM calls with exponential backoff."""
    return retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((RateLimitError, APIError)),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying {func.__name__} after {retry_state.outcome.exception()}"
        )
    )(func)
```

**Pattern 2: Error Boundary Nodes**

```python
# agent/utils/reviewer_agent/node.py
from agent.utils.common.retry import with_retry

@with_retry
def _call_grader_1(messages):
    """Wrapped LLM call with retry."""
    return structured_grader_1.invoke(messages)

def grader_1_node(state: AssignmentState):
    """Grader 1 with error handling."""
    try:
        if not state.get("student_answer"):
            return {"grader_1_result": {"score": 0.0, "error": None}}
        
        messages = grader_1_prompt.format_messages(...)
        result = _call_grader_1(messages)
        
        return {"grader_1_result": {"score": result.score, "error": None}}
    
    except Exception as e:
        logger.error(f"Grader 1 failed: {e}", exc_info=True)
        # Return degraded result instead of crashing
        return {
            "grader_1_result": {
                "score": None,  # Signal failure
                "error": str(e)
            }
        }
```

**Pattern 3: Graceful Degradation in Aggregate Node**

```python
def aggregate_results_node(state: AssignmentState):
    """Aggregate with fallback logic."""
    g1 = state["grader_1_result"]
    g2 = state["grader_2_result"]
    
    # If both graders failed, flag for human review
    if g1.get("error") and g2.get("error"):
        logger.error(f"Both graders failed for {state['current_label']}")
        insert_review_queue(
            reason="both_graders_failed",
            error=f"G1: {g1['error']}, G2: {g2['error']}"
        )
        return {"all_results": []}
    
    # If one grader failed, use the other
    if g1.get("error"):
        final_score = g2["score"]
        confidence = 0.5  # Lower confidence
    elif g2.get("error"):
        final_score = g1["score"]
        confidence = 0.5
    else:
        # Both succeeded, normal logic
        final_score = (g1["score"] + g2["score"]) / 2
        confidence = calculate_confidence(g1["score"], g2["score"])
    
    # ... rest of logic
```

#### **What Changes**

1. **New file:** `agent/utils/common/retry.py` — retry decorator
2. **Change:** All `node.py` files — wrap LLM calls with `@with_retry`
3. **Change:** All `node.py` files — add try/except around LLM calls
4. **Change:** `aggregate_results_node` — add graceful degradation logic

---

## 3. ACTIONABLE CHECKLIST

### **PHASE 1: OBSERVABILITY (Week 1) — See What's Happening**

**Priority: CRITICAL** — You're flying blind without this.

- [ ] **Task 1.1:** Sign up for LangSmith, create project "brac-grading-dev"
- [ ] **Task 1.2:** Add environment variables to `.env`:
  ```bash
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_API_KEY=lsv2_pt_...
  LANGCHAIN_PROJECT=brac-grading-dev
  ```
- [ ] **Task 1.3:** Add trace metadata to all graph invocations (see 2.2)
- [ ] **Task 1.4:** Deploy and run 10 test grading jobs
- [ ] **Task 1.5:** Verify traces appear in LangSmith dashboard
- [ ] **Task 1.6:** Create "Grading Success Rate" dashboard

**Success Criteria:** You can see every LLM call, token usage, and latency in LangSmith.

---

### **PHASE 2: STATE PERSISTENCE (Week 2) — Survive Crashes**

**Priority: CRITICAL** — Grading jobs are long-running and expensive.

- [ ] **Task 2.1:** Run migration `20260602000000_langgraph_checkpoints.sql`
- [ ] **Task 2.2:** Create `agent/config/checkpointer.py` with PostgresSaver
- [ ] **Task 2.3:** Update `reviewer_agent/graph.py` to use checkpointer
- [ ] **Task 2.4:** Update grading endpoint to use thread_ids
- [ ] **Task 2.5:** Test: Start grading job, kill worker mid-execution, restart — verify it resumes
- [ ] **Task 2.6:** Add checkpointer to `graphrag_ingestion` graph

**Success Criteria:** Grading jobs resume from last checkpoint after worker crash.

---

### **PHASE 3: ERROR HANDLING (Week 3) — Stop Breaking**

**Priority: HIGH** — Single OpenAI error shouldn't fail entire job.

- [ ] **Task 3.1:** Create `agent/utils/common/retry.py` with tenacity decorator
- [ ] **Task 3.2:** Wrap all LLM calls in `reviewer_agent/node.py` with `@with_retry`
- [ ] **Task 3.3:** Add try/except to all node functions
- [ ] **Task 3.4:** Update `aggregate_results_node` with graceful degradation
- [ ] **Task 3.5:** Test: Simulate OpenAI 429 error, verify retry works
- [ ] **Task 3.6:** Repeat for all 7 agents

**Success Criteria:** Grading jobs complete even if 1-2 LLM calls fail.

---

### **PHASE 4: CONFIGURATION (Week 4) — Stop Hardcoding**

**Priority: MEDIUM** — Enables A/B testing and per-teacher customization.

- [ ] **Task 4.1:** Create `langgraph.json` at project root
- [ ] **Task 4.2:** Create `agent/config/langgraph_config.py` loader
- [ ] **Task 4.3:** Update all `node.py` files to read model from config
- [ ] **Task 4.4:** Add environment variable overrides
- [ ] **Task 4.5:** Test: Change model in `langgraph.json`, verify it's used
- [ ] **Task 4.6:** Document all config options in README

**Success Criteria:** Can change models without code deploy.

---

### **PHASE 5: GRAPH OPTIMIZATION (Week 5) — Stop Rebuilding**

**Priority: MEDIUM** — Reduces latency and memory usage.

- [ ] **Task 5.1:** Move graph compilation to module-level in all `graph.py` files:
  ```python
  # At module level (outside function)
  _compiled_graph = None
  
  def build_graph():
      global _compiled_graph
      if _compiled_graph is None:
          workflow = StateGraph(...)
          # ... build graph ...
          _compiled_graph = workflow.compile(checkpointer=checkpointer)
      return _compiled_graph
  ```
- [ ] **Task 5.2:** Update `agent/main.py` to compile all graphs at startup
- [ ] **Task 5.3:** Add health check that validates graphs compiled successfully
- [ ] **Task 5.4:** Measure latency improvement (expect ~200-500ms faster)

**Success Criteria:** Graphs compiled once at startup, reused for all requests.

---

### **PHASE 6: PRODUCTION HARDENING (Week 6) — Deploy Safely**

**Priority: MEDIUM** — Final polish before production.

- [ ] **Task 6.1:** Pin all dependencies in `requirements.txt`
- [ ] **Task 6.2:** Add recursion limit to TA agent: `compile(recursion_limit=10)`
- [ ] **Task 6.3:** Add circuit breaker to TA agent (see earlier design)
- [ ] **Task 6.4:** Standardize all state schemas to use `add_messages`
- [ ] **Task 6.5:** Replace all `print()` with structured logging
- [ ] **Task 6.6:** Write integration tests for each agent
- [ ] **Task 6.7:** Set up LangSmith alerting rules
- [ ] **Task 6.8:** Create runbook for common failures

**Success Criteria:** System is production-ready with monitoring and runbooks.

---

## MIGRATION SEQUENCE RATIONALE

**Why this order?**

1. **Observability first** — You need to see what's happening before you can fix anything
2. **Persistence second** — Prevents data loss from crashes (highest ROI)
3. **Error handling third** — Makes system resilient to transient failures
4. **Configuration fourth** — Enables iteration without deploys
5. **Optimization fifth** — Performance improvements after stability
6. **Hardening last** — Final polish when core issues are solved

**If you can only do ONE thing:** Implement Phase 1 (LangSmith tracing). You're flying blind without it.

---

## APPENDIX: QUICK WINS (Do These Today)

1. **Add LangSmith tracing** — 15 minutes, massive visibility gain
2. **Pin dependency versions** — 5 minutes, prevents surprise breakage
3. **Add recursion limit to TA agent** — 1 line of code, prevents runaway costs
4. **Replace `print()` with `logger.info()`** — 30 minutes, enables log aggregation

These four changes take < 1 hour and dramatically improve production readiness.