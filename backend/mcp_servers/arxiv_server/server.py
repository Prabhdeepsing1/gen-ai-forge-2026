import os
import httpx
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from mcp.server.fastmcp import FastMCP
import mcp

# Create the MCP server
mcp_server = FastMCP("arXiv Server")

ARXIV_API = "https://export.arxiv.org/api/query"
NS = {
    "atom":    "http://www.w3.org/2005/Atom",
    "arxiv":   "http://arxiv.org/schemas/atom",
    "opensearch": "http://a9.com/-/spec/opensearch/1.1/",
}

def _parse_arxiv_entry(entry) -> dict:
    """Parse a single arXiv Atom entry into a clean dict."""
    title = entry.findtext("atom:title", namespaces=NS) or ""
    abstract = entry.findtext("atom:summary", namespaces=NS) or ""
    published = entry.findtext("atom:published", namespaces=NS) or ""

    # arXiv ID lives in <id> tag as a URL
    id_tag = entry.findtext("atom:id", namespaces=NS) or ""
    arxiv_id = id_tag.split("/abs/")[-1] if "/abs/" in id_tag else id_tag

    authors = [
        a.findtext("atom:name", namespaces=NS) or ""
        for a in entry.findall("atom:author", namespaces=NS)
    ]

    links = entry.findall("atom:link", namespaces=NS)
    pdf_url = next(
        (l.get("href") for l in links if l.get("type") == "application/pdf"),
        None,
    )
    html_url = next(
        (l.get("href") for l in links if l.get("type") == "text/html"),
        id_tag,
    )

    return {
        "external_id": arxiv_id,
        "title": title.strip().replace("\\n", " "),
        "authors": authors,
        "abstract": abstract.strip().replace("\\n", " "),
        "published": published[:10],  # YYYY-MM-DD
        "source": "arxiv",
        "url": html_url,
        "pdf_url": pdf_url,
    }

@mcp_server.tool()
async def search_arxiv(
    query: str = Field(description="The search query for arXiv (e.g., 'machine learning')."),
    max_results: int = Field(default=10, description="Maximum number of results to return (max 30).")
) -> str:
    """Search arXiv for research papers matching the query and return a JSON string of results."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": min(max_results, 30),
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    
    async with httpx.AsyncClient(timeout=30.0) as http:
        resp = await http.get(ARXIV_API, params=params)
    
    if resp.status_code != 200:
        return f"Error: Failed to reach arXiv API (status {resp.status_code})"
    
    root = ET.fromstring(resp.text)
    entries = root.findall("atom:entry", namespaces=NS)
    papers = [_parse_arxiv_entry(e) for e in entries]
    
    import json
    return json.dumps({"papers": papers, "total": len(papers), "query": query}, indent=2)

# For SSE Transport via FastAPI (the way we run it in Docker)
app = mcp_server.get_starlette_app()
