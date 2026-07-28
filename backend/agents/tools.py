import os
from langchain_mcp_adapters.client import MultiServerMCPClient

# Fetch URLs from environment or fallback to localhost
ARXIV_SERVER_URL = os.getenv("MCP_ARXIV_URL", "http://localhost:8001/sse")
KB_SERVER_URL = os.getenv("MCP_KB_URL", "http://localhost:8002/sse")
DOC_SERVER_URL = os.getenv("MCP_DOC_URL", "http://localhost:8003/sse")

mcp_servers_config = {
    "arxiv_server": {
        "transport": "sse",
        "url": ARXIV_SERVER_URL
    },
    "knowledge_base_server": {
        "transport": "sse",
        "url": KB_SERVER_URL
    },
    "document_server": {
        "transport": "sse",
        "url": DOC_SERVER_URL
    }
}

async def get_mcp_tools():
    """Initializes the MCP client and fetches all available tools across servers."""
    client = MultiServerMCPClient(mcp_servers_config)
    # The client connects and fetches the tools schemas
    tools = await client.get_tools()
    return tools
