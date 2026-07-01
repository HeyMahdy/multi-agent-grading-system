def build_document_human_content(files: list, instruction_text: str) -> list:
    """
    Build a multimodal HumanMessage payload from parsed upload items.

    parse_standard_file emits image items as data URLs and PDF items as extracted
    text. Scanned PDFs may be converted into image items page-by-page.
    """
    human_content = [{"type": "text", "text": instruction_text}]

    for index, item in enumerate(files or [], start=1):
        item_type = item.get("type")
        content = item.get("content", "")

        if not content:
            continue

        if item_type == "image" or content.startswith("data:image/"):
            human_content.append({
                "type": "image_url",
                "image_url": {"url": content},
            })
            continue

        if item_type in {"pdf", "text"}:
            human_content.append({
                "type": "text",
                "text": (
                    f"\n\n--- Document {index} extracted text starts ---\n"
                    f"{content}\n"
                    f"--- Document {index} extracted text ends ---"
                ),
            })
            continue

        human_content.append({
            "type": "text",
            "text": f"\n\n--- Document {index} content ---\n{content}",
        })

    return human_content
