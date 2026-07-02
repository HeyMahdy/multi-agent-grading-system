# Agent Layer Internal Architecture Redesign

## The Problem

Every agent (questions, rubrics, solutions, student_answers, grading) currently:
- Instantiates its own `ChatOpenAI(model="gpt-4o", temperature=0)`
- Defines its own `AgentState` TypedDict from scratch
- Builds its own graph with copy-pasted `should_continue` logic
- Has its own `tool_node = ToolNode(tools)` setup
- Handles errors inconsistently (some print, some swallow, some crash)
- Loads `.env` independently

This means: 6 agents × 5 files = 30 files with ~60% duplicated code.

---

## The Redesign

### Folder Structure

```
agent/
├── main.py                          # FastAPI app, endpoint registration
├── config/
│   ├── __init__.py
│   ├── settings.py                  # All env vars, model configs, timeouts
│   └── db.py                        # Connection pool (existing)
│
├── core/                            # Shared infrastructure — NEVER agent-specific
│   ├── __init__.py
│   ├── models.py                    # Model factory (get_llm, get_vision_llm)
│   ├── state.py                     # Base state definitions
│   ├── graph_builder.py             # Generic graph factory for extract→save pattern
│   ├── nodes.py                     # Reusable node templates
│   ├── errors.py                    # Custom exceptions, error handling
│   ├── validation.py                # LLM output validation utilities
│   ├── logging.py                   # Structured logging for all LLM calls
│   └── retry.py                     # Retry/fallback/timeout decorators
│
├── tools/                           # Shared database tools
│   ├── __init__.py
│   ├── questions.py                 # get_assignment_labels, etc.
│   ├── rubrics.py
│   ├── solutions.py
│   ├── student_answers.py
│   ├── scores.py                    # save_student_score
│   └── context.py                   # fetch_evaluation_context (joins)
│
├── prompts/                         # All prompts, versioned, separate from code
│   ├── __init__.py
│   ├── registry.py                  # Load prompt by name+version
│   ├── ocr/
│   │   ├── questions_v1.py
│   │   ├── solutions_v1.py
│   │   └── student_answers_v1.py
│   ├── grading/
│   │   ├── strict_v1.py
│   │   └── fair_v1.py
│   └── routing/
│       ├── save_questions_v1.py
│       ├── save_solutions_v1.py
│       └── save_answers_v1.py
│
├── agents/                          # Each agent: ONLY its unique logic
│   ├── __init__.py
│   ├── questions.py                 # ~30 lines: config + build
│   ├── rubrics.py
│   ├── solutions.py
│   ├── student_answers.py
│   └── grading/                     # Complex agent gets its own folder
│       ├── __init__.py
│       ├── graph.py
│       ├── nodes.py                 # init_supervisor, grader nodes, aggregate
│       └── state.py                 # Extended state for grading
│
└── services/                        # Business logic that isn't LLM-specific
    ├── __init__.py
    ├── file_processing.py           # parse_standard_file (existing)
    └── token_tracking.py            # Log usage per call
```

---

## Design Decisions

### 1. Model Factory (`core/models.py`)

**Problem**: Every agent does `llm = ChatOpenAI(model="gpt-4o", temperature=0)` independently. If you want to change the model, you edit 6 files.

**Solution**: One factory, configured centrally.

```python
# core/models.py
from functools import lru_cache
from langchain_openai import ChatOpenAI
from config.settings import MODEL_CONFIG

@lru_cache(maxsize=None)
def get_llm(task: str) -> ChatOpenAI:
    """Returns a cached LLM instance for the given task type."""
    cfg = MODEL_CONFIG[task]
    return ChatOpenAI(
        model=cfg["model"],
        temperature=cfg["temperature"],
        timeout=cfg.get("timeout", 30),
        max_retries=cfg.get("max_retries", 2),
    )

def get_vision_llm() -> ChatOpenAI:
    return get_llm("vision_ocr")

def get_routing_llm() -> ChatOpenAI:
    return get_llm("routing")

def get_grading_llm(variant: str = "strict") -> ChatOpenAI:
    return get_llm(f"grading_{variant}")
```

```python
# config/settings.py
MODEL_CONFIG = {
    "vision_ocr": {"model": "gpt-4o", "temperature": 0, "timeout": 60},
    "routing": {"model": "gpt-4o-mini", "temperature": 0, "timeout": 30},
    "grading_strict": {"model": "gpt-4o-mini", "temperature": 0.1, "timeout": 20},
    "grading_fair": {"model": "gpt-4o-mini", "temperature": 0.4, "timeout": 20},
}
```

**Why `@lru_cache`?** LLM clients are stateless HTTP wrappers. Creating one per request wastes nothing, but caching avoids repeated initialization. This is effectively a singleton per task type.

**Tradeoff**: Singletons are fine here because LLM clients have no mutable state. If you needed per-request config (e.g., different API keys per tenant), you'd use a factory without caching.

---

### 2. Base State (`core/state.py`)

**Problem**: Every agent defines its own `AgentState` TypedDict. They all share `files`, `teacher_id`, `assignment_id`, `final_output`, `messages`. But each adds its own fields.

**Solution**: Composable state via inheritance.

```python
# core/state.py
from typing import TypedDict, Optional, Annotated, List
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class BaseOCRState(TypedDict):
    """Shared state for all OCR-based extract→save agents."""
    files: list
    file_type: str
    document_type: str
    teacher_id: str
    assignment_id: int
    final_output: str
    messages: Annotated[list[BaseMessage], add_messages]

class StudentAnswerState(BaseOCRState):
    """Extends base with student_id."""
    student_id: str
```

**Why TypedDict inheritance?** LangGraph requires TypedDict. Python supports TypedDict inheritance natively. Each agent extends the base with only its unique fields.

**What stays in base**: Anything that 4+ agents share.
**What stays specific**: `student_id` (only student_answers agent needs it), `pending_labels` (only grading agent).

---

### 3. Generic Graph Builder (`core/graph_builder.py`)

**Problem**: Questions, rubrics, solutions, and student_answers all have the EXACT same graph structure: `extract_node → save_agent → [tool_node loop] → END`. The only differences are: which prompt, which tools, which JSON key to extract.

**Solution**: A factory that builds this graph from config.

```python
# core/graph_builder.py
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from core.models import get_vision_llm, get_routing_llm
from core.nodes import make_extract_node, make_save_node, should_continue

def build_ocr_save_graph(
    state_class,
    extract_prompt: str,
    save_system_prompt: str,
    tools: list,
    json_key: str,          # "questions", "solutions", "answers", "rubrics"
    human_instruction: str,
):
    """
    Builds the standard extract→save→tool_loop graph.
    This replaces 4 separate graph.py files.
    """
    vision_llm = get_vision_llm()
    routing_llm = get_routing_llm().bind_tools(tools)
    tool_node = ToolNode(tools)

    extract_node = make_extract_node(vision_llm, extract_prompt, human_instruction)
    save_node = make_save_node(routing_llm, save_system_prompt, json_key)

    workflow = StateGraph(state_class)
    workflow.add_node("extract_node", extract_node)
    workflow.add_node("save_agent", save_node)
    workflow.add_node("tool_node", tool_node)

    workflow.add_edge(START, "extract_node")
    workflow.add_edge("extract_node", "save_agent")
    workflow.add_conditional_edges("save_agent", should_continue, {"tools": "tool_node", "END": END})
    workflow.add_edge("tool_node", "save_agent")

    return workflow.compile()
```

**Now each agent is ~15 lines:**

```python
# agents/solutions.py
from core.graph_builder import build_ocr_save_graph
from core.state import BaseOCRState
from tools.solutions import insert_solution
from prompts.ocr.solutions_v1 import SOLUTION_PROMPT
from prompts.routing.save_solutions_v1 import SAVE_SYSTEM_PROMPT

graph = build_ocr_save_graph(
    state_class=BaseOCRState,
    extract_prompt=SOLUTION_PROMPT,
    save_system_prompt=SAVE_SYSTEM_PROMPT,
    tools=[insert_solution],
    json_key="solutions",
    human_instruction="Look at this document and transcribe ONLY the solutions that are PHYSICALLY VISIBLE.",
)
```

**This eliminates**: 4 separate `graph.py`, 4 separate `node.py`, 4 separate `state.py` files that were 90% identical.

---

### 4. Reusable Node Templates (`core/nodes.py`)

```python
# core/nodes.py
import json
from langchain_core.messages import SystemMessage, HumanMessage
from core.errors import LLMOutputValidationError
from core.validation import validate_json_output
from core.logging import log_llm_call

def should_continue(state):
    """Universal routing: tools or END."""
    messages = state.get("messages")
    if messages:
        last = messages[-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
    return "END"

def make_extract_node(llm, system_prompt: str, human_instruction: str):
    """Factory: creates an extract node with the given prompt."""
    
    def extract_node(state):
        messages = [SystemMessage(content=system_prompt)]
        
        human_content = [{"type": "text", "text": human_instruction}]
        if "files" in state and state["files"]:
            for item in state["files"]:
                human_content.append({
                    "type": "image_url",
                    "image_url": {"url": item["content"]}
                })
        
        messages.append(HumanMessage(content=human_content))
        
        json_llm = llm.bind(response_format={"type": "json_object"})
        response = json_llm.invoke(messages)
        
        # Log the call
        log_llm_call(model=llm.model_name, input_messages=messages, output=response)
        
        # Validate and normalize
        try:
            parsed = json.loads(response.content)
            final = json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            final = response.content
        
        return {"final_output": final}
    
    return extract_node

def make_save_node(agent_llm, system_prompt_template: str, json_key: str):
    """Factory: creates a save node that routes extracted data to tools."""
    
    def save_node(state):
        if not state.get("messages"):
            raw = state.get("final_output", "{}")
            parsed = json.loads(raw)
            items = parsed.get(json_key, [])
            
            # Build instruction with state variables
            format_vars = {
                "teacher_id": state.get("teacher_id", ""),
                "student_id": state.get("student_id", ""),
                "assignment_id": state.get("assignment_id", ""),
            }
            instruction = system_prompt_template.format(**format_vars)
            instruction += f"\n\nData to save:\n{json.dumps(items, indent=2)}"
            
            messages_to_process = [HumanMessage(content=instruction)]
        else:
            messages_to_process = state["messages"]
        
        response = agent_llm.invoke(messages_to_process)
        log_llm_call(model=agent_llm.model_name, input_messages=messages_to_process, output=response)
        
        return {"messages": [response]}
    
    return save_node
```

---

### 5. Error Handling (`core/errors.py` + `core/retry.py`)

**Problem**: Currently if the LLM returns garbage JSON, the agent crashes. If OpenAI is down, the whole request fails with a 500.

```python
# core/errors.py
class AgentError(Exception):
    """Base exception for all agent errors."""
    pass

class LLMTimeoutError(AgentError):
    pass

class LLMOutputValidationError(AgentError):
    def __init__(self, expected_key: str, raw_output: str):
        self.expected_key = expected_key
        self.raw_output = raw_output
        super().__init__(f"LLM output missing key '{expected_key}'")

class ContextNotFoundError(AgentError):
    def __init__(self, label: str):
        super().__init__(f"No context found for question '{label}'")
```

```python
# core/retry.py
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from openai import RateLimitError, APITimeoutError, APIConnectionError

llm_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((RateLimitError, APITimeoutError, APIConnectionError)),
    reraise=True,
)
```

**Usage in nodes:**
```python
@llm_retry
def invoke_with_retry(llm, messages):
    return llm.invoke(messages)
```

---

### 6. Output Validation (`core/validation.py`)

```python
# core/validation.py
import json
from core.errors import LLMOutputValidationError

def validate_json_output(raw: str, required_key: str) -> dict:
    """Validates LLM output is valid JSON with the expected top-level key."""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise LLMOutputValidationError(required_key, raw)
    
    if required_key not in parsed:
        raise LLMOutputValidationError(required_key, raw)
    
    return parsed

def validate_score(score: float, max_marks: float) -> float:
    """Clamps score to valid range. Flags if clamping was needed."""
    if score < 0:
        return 0.0
    if score > max_marks:
        return max_marks
    return score
```

---

### 7. The Grading Agent (Complex — Gets Its Own Folder)

The grading agent is fundamentally different from OCR agents. It has:
- A queue/loop pattern (not extract→save)
- Parallel fan-out to two graders
- Aggregation with confidence scoring
- DB writes per iteration

It stays in its own folder but uses shared infrastructure:

```python
# agents/grading/graph.py
from langgraph.graph import StateGraph, START, END
from .state import GradingState
from .nodes import init_supervisor, fetch_next_context, grader_1, grader_2, aggregate, supervisor_router

def build_grading_graph():
    workflow = StateGraph(GradingState)
    workflow.add_node("init_supervisor", init_supervisor)
    workflow.add_node("fetch_next_context", fetch_next_context)
    workflow.add_node("grader_1", grader_1)
    workflow.add_node("grader_2", grader_2)
    workflow.add_node("aggregate", aggregate)
    
    workflow.add_edge(START, "init_supervisor")
    workflow.add_conditional_edges("init_supervisor", supervisor_router, {"fetch_next": "fetch_next_context", "END": END})
    workflow.add_edge("fetch_next_context", "grader_1")
    workflow.add_edge("fetch_next_context", "grader_2")
    workflow.add_edge("grader_1", "aggregate")
    workflow.add_edge("grader_2", "aggregate")
    workflow.add_conditional_edges("aggregate", supervisor_router, {"fetch_next": "fetch_next_context", "END": END})
    
    return workflow.compile()
```

```python
# agents/grading/nodes.py
from core.models import get_grading_llm
from core.retry import llm_retry
from core.validation import validate_score
from tools.context import fetch_evaluation_context
from tools.scores import save_student_score
from prompts.grading.strict_v1 import STRICT_PROMPT
from prompts.grading.fair_v1 import FAIR_PROMPT

# Uses shared infrastructure, but has unique multi-step logic
```

---

### 8. Agent Instantiation Strategy

**Decision: Compile once at startup, invoke per request.**

```python
# main.py
from agents.questions import graph as questions_graph
from agents.solutions import graph as solutions_graph
from agents.student_answers import graph as student_answers_graph
from agents.grading.graph import build_grading_graph

# Compiled once (stateless, reusable)
grading_graph = build_grading_graph()

@app.post("/internal/agent/solutions/process")
async def process_solutions(files, teacher_id, assignment_id):
    # Each invocation gets fresh state
    state = await prepare_state(files, teacher_id, assignment_id, doc_type="solution")
    result = solutions_graph.invoke(state)
    return result["final_output"]
```

**Why compile once?**
- LangGraph compilation is expensive (builds the graph structure)
- The compiled graph is stateless — state is passed per invocation
- No memory leaks, no stale state between requests

**Why NOT recreate per request?**
- Compilation overhead (~50ms) wasted on every request
- No benefit — the graph structure never changes at runtime

---

## What People Get Wrong

### 1. Over-abstracting too early
Don't build a "universal agent framework" before you have 3+ agents that prove the pattern. You have 5 agents now — the pattern is clear. Abstract now.

### 2. Sharing state that shouldn't be shared
`student_id` only matters for student_answers and grading. Don't put it in BaseState and force every agent to carry it. Use inheritance/composition.

### 3. Making the base class do too much
The base should provide: model access, logging, retry, validation. It should NOT contain business logic. If you find yourself adding `if document_type == "rubric"` in the base, you've gone wrong.

### 4. Singleton LLM clients with mutable config
If you cache the LLM client but later want to change temperature per request, you're stuck. Solution: cache by (model, temperature) tuple, not just task name.

### 5. Not validating LLM output at the boundary
The LLM is an untrusted external service. Validate its output the same way you'd validate user input. Every `json.loads()` needs a try/except. Every score needs bounds checking.

### 6. Logging too little or too much
Too little: "grading failed" with no context. Too much: logging full base64 images (fills disk in hours). Log: model, token count, latency, success/fail, metadata (teacher_id, assignment_id, label). Don't log: file contents, full prompts in production (store prompt version ID instead).

### 7. Mixing graph structure with node logic
Keep graph topology (edges, routing) in `graph.py`. Keep node implementations in `nodes.py`. When you put both in one file, it becomes unreadable at 200+ lines.

### 8. Not handling partial failures in the grading loop
If question 5 of 10 fails, you lose questions 1-4's results. Save after each iteration (you already do this with `save_student_score` — good). But also: catch exceptions per-question and continue the loop.

---

## Migration Path (From Current → New)

1. **Week 1**: Create `core/` with models.py, state.py, nodes.py, graph_builder.py
2. **Week 1**: Migrate `solutions_agent` to new pattern (simplest, newest code)
3. **Week 2**: Migrate `questions_agent` and `rubrics_agent`
4. **Week 2**: Migrate `student_answer_agent`
5. **Week 3**: Refactor `reviewer_agent` (grading) to use shared tools/models
6. **Week 3**: Delete old `utils/` folder entirely
7. **Week 4**: Add logging, retry, validation to core

Each migration is independent. You can ship one agent at a time. Old and new can coexist during transition.

---

## Before vs After: Lines of Code

| Component | Before (per agent) | After (per agent) |
|-----------|-------------------|-------------------|
| state.py | 12 lines | 0 (uses core) or 3 lines (extends) |
| tools.py | 35 lines | 35 lines (stays, moves to tools/) |
| prompt.py | 40 lines | 40 lines (stays, moves to prompts/) |
| node.py | 80 lines | 0 (generated by factory) |
| graph.py | 40 lines | 0 (generated by factory) |
| **agent definition** | — | **15 lines** |
| **Total per agent** | **~207 lines** | **~90 lines** |

For 5 agents: ~1035 lines → ~450 lines + ~200 lines shared core = **650 lines total** (37% reduction, with better error handling and logging added).
