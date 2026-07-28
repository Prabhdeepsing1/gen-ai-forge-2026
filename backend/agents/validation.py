from pydantic import BaseModel, ValidationError

class SearchArxivInput(BaseModel):
    query: str
    max_results: int = 10

class SearchKnowledgeBaseInput(BaseModel):
    query: str
    workspace_id: int
    top_k: int = 5

class SemanticSearchInput(BaseModel):
    query: str
    workspace_id: int
    top_k: int = 5

class GetWorkspacePapersInput(BaseModel):
    workspace_id: int

class AddPaperInput(BaseModel):
    title: str
    abstract: str
    user_id: int
    source: str = "arxiv"
    workspace_id: int = None

class RemovePaperInput(BaseModel):
    paper_id: int

class ExtractPdfTextInput(BaseModel):
    base64_pdf: str

SCHEMA_MAP = {
    "search_arxiv": SearchArxivInput,
    "search_knowledge_base": SearchKnowledgeBaseInput,
    "semantic_search": SemanticSearchInput,
    "get_workspace_papers": GetWorkspacePapersInput,
    "add_paper": AddPaperInput,
    "remove_paper": RemovePaperInput,
    "extract_pdf_text": ExtractPdfTextInput,
}

class ToolValidationError(Exception):
    pass

def validate_tool_call(tool_name: str, arguments: dict) -> dict:
    """Validate tool arguments against Pydantic schema before MCP dispatch."""
    model_class = SCHEMA_MAP.get(tool_name)
    if model_class:
        try:
            validated = model_class(**arguments)
            return validated.model_dump()
        except ValidationError as e:
            raise ToolValidationError(f"Invalid arguments for {tool_name}: {e}")
    return arguments
