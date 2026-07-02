# AI Agent System — Diagrams Only

---

## All Agents Overview

```mermaid
flowchart TB
    subgraph DOC["Document Agents — same flow, different output"]
        Q[Questions Agent]
        R[Rubrics Agent]
        S[Solutions Agent]
        SA[Student Answers Agent]
    end

    subgraph GRADE["Grading Agent"]
        G[Reviewer Agent]
    end

    subgraph CHAT["Chat Agent"]
        TA[TA Agent]
    end

    subgraph RAG["Syllabus Agent"]
        GR[GraphRAG Agent]
    end

    TA -.->|query_syllabus| GR
```

---

## Document Agents — How They Work

Same pattern for Questions, Rubrics, Solutions, Student Answers.

```mermaid
flowchart LR
    PDF[PDF / Image upload] --> EX[1. Extract<br/>Vision LLM reads document<br/>outputs JSON]
    EX --> SA[2. Save Agent<br/>LLM picks what to store]
    SA --> TN[3. Tool Node<br/>INSERT into database]
    TN --> SA
    SA --> DONE[Done]

    style EX fill:#e1f5fe
    style SA fill:#fff3e0
    style TN fill:#e8f5e9
```

### What each agent saves

```mermaid
flowchart LR
    Q[Questions Agent] --> QO[insert_question<br/>insert_rubric]
    R[Rubrics Agent] --> RO[insert_rubric]
    S[Solutions Agent] --> SO[insert_solution]
    SA[Student Answers Agent] --> SAO[insert_student_answer]
```

---

## Grading Agent — How It Works

```mermaid
flowchart TB
    START([Start]) --> INIT[1. Load all question labels]
    INIT --> FETCH[2. Get next question<br/>fetch rubric + answer + solution]

    FETCH --> G1[Grader 1<br/>strict score]
    FETCH --> G2[Grader 2<br/>fair score]
    FETCH --> W[Weakness Analyzer<br/>comment only]

    G1 --> AGG[3. Aggregate<br/>avg score + confidence]
    G2 --> AGG
    W --> AGG

    AGG --> SAVE[Save to database]
    SAVE --> MORE{More questions?}
    MORE -->|Yes| FETCH
    MORE -->|No| DONE([Done])
```

---

## TA Agent — How It Works

```mermaid
flowchart LR
    Q[Teacher asks question] --> AG[TA Agent<br/>gpt-4o-mini]
    AG --> DEC{Needs data?}
    DEC -->|Yes| TOOL[Run tool]
    TOOL --> AG
    DEC -->|No| ANS[Reply to teacher]
```

### Tools TA can call

```mermaid
flowchart TB
    TA[TA Agent]

    TA --> R[resolve_entities]
    TA --> SO[get_student_overview]
    TA --> AO[get_assignment_overview]
    TA --> SP[get_student_assignment_performance]
    TA --> PR[get_prerequisite_review_context]
    TA --> M[get_assignment_mistakes]
    TA --> WC[get_student_weak_concepts]
    TA --> QS[query_syllabus]
    TA --> SS[search_student / search_assignment]
```

### Example: study plan question

```mermaid
flowchart LR
    Q["What should Ahmed review?"] --> R[resolve_entities]
    R --> P[get_prerequisite_review_context]
    P --> QS[query_syllabus]
    QS --> A[Study plan answer]
```

---

## GraphRAG Agent — How It Works

```mermaid
flowchart LR
    subgraph INGEST["Ingest syllabus"]
        F[File] --> CH[Chunk text]
        CH --> ENT[Extract entities]
        ENT --> REL[Extract relationships]
        REL --> EMB[Embed + store]
    end

    subgraph QUERY["Answer question"]
        Q[Query] --> VEC[Vector search]
        VEC --> GRAPH[Graph lookup]
        GRAPH --> LLM[Synthesize answer]
    end
```
