import json
from typing import TypedDict
from dotenv import load_dotenv

from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.prebuilt import ToolNode

from utils.document_content import build_document_human_content
from .prompts import  TEACHER_QUESTION_PROMPT, system_prompt
from .state import AgentState
from .tools import tools

load_dotenv()

# 1. Initialize LLMs
llm = ChatOpenAI(model="gpt-5.4-mini", temperature=0)

# CRITICAL FIX: The saving agent MUST have tools bound to it!
agent_llm = llm.bind_tools(tools)

# 2. Tool Node
tool_node = ToolNode(tools)  

# ---------------------------------------------------------
# NODE 1: The Extractor
# ---------------------------------------------------------
def dynamic_extract_node(state: AgentState):
    """Acts as Scribe or Architect depending on document_type."""
    
    
    # 1. Choose the prompt based on document type
    
    active_prompt = TEACHER_QUESTION_PROMPT
        
    messages = [SystemMessage(content=active_prompt)]
    
    # 2. Build a mixed image/PDF-text payload for the LLM.
    human_content = build_document_human_content(
        state.get("files", []),
        "Please transcribe and structure these document pages seamlessly together.",
    )
            
    # 3. Wrap everything inside a single HumanMessage and send it to the AI
    messages.append(HumanMessage(content=human_content))

    # Strict JSON formatting constraint
    json_llm = llm.bind(response_format={"type": "json_object"})
    response = json_llm.invoke(messages)



    try:
        # If it's a valid JSON string, parsing and re-dumping with ensure_ascii=False 
        # fixes any raw string truncation errors instantly.
        parsed_string = json.loads(response.content)
        final_string_payload = json.dumps(parsed_string, ensure_ascii=False)
    except Exception:
        # Fallback to direct string content if it's already a clean string format
        final_string_payload = response.content
    
    return {"final_output": final_string_payload}
    
  

# ---------------------------------------------------------
# NODE 2: The Agent Brain
# ---------------------------------------------------------
def save_with_agent(state: AgentState):
    """Decides which tools to call based on the extracted JSON."""
    
    print("\n" + "="*50)
    print(f"[save_with_agent] 🚀 Entering node.")
    print(f"[save_with_agent] 🔍 State -> teacher_id: {state.get('teacher_id')}, assignment_id: {state.get('assignment_id')}")
    print(f"[save_with_agent] 🔍 Current message count in state: {len(state.get('messages', []))}")
    
    if not state.get("messages"):
        print("[save_with_agent] 🛤️ Branch: FIRST PASS (No previous messages).")
        
        raw_json_string = state.get("final_output", "{}")
        parsed_data = json.loads(raw_json_string)
        questions_list = parsed_data.get("questions", [])
        formatted_questions_block = json.dumps(questions_list, indent=2)
        

        
        initial_instruction = system_prompt.format(
            teacher_id=state["teacher_id"],
            assignment_id=state["assignment_id"],
        ) + f"\n\nHere is the exact data array you must loop over and save using the 'insert_question' tool:\n{formatted_questions_block}"
        
        # Optional: Uncomment the next two lines if you want to see the ENTIRE prompt sent to the LLM
        # print("\n[save_with_agent] 📝 FULL PROMPT SENT TO LLM:\n")
        # print(initial_instruction)
        
        messages_to_process = [HumanMessage(content=initial_instruction)]
    else:
        print("[save_with_agent] 🛤️ Branch: LOOPING BACK. Using existing message history.")
        messages_to_process = state["messages"]

    print(f"[save_with_agent] 🧠 Invoking LLM with {len(messages_to_process)} messages...")
    
    response = agent_llm.invoke(messages_to_process)

    print(f"[save_with_agent] ✅ LLM Responded.")
    
    if response.content:
         print(f"[save_with_agent] 💬 LLM Text Content: '{response.content}'")

    if hasattr(response, "tool_calls") and response.tool_calls:
        print(f"[save_with_agent] 🛠️ LLM requested {len(response.tool_calls)} tool calls:")
        for i, call in enumerate(response.tool_calls):
            print(f"    {i+1}. Tool Name: {call.get('name')}")
            print(f"       Args: {call.get('args')}")
    else:
        print("[save_with_agent] 🛑 No tool calls requested by LLM. It is finished.")
    
    print("="*50 + "\n")
    
    return {"messages": [response]}
