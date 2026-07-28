# mcp_servers.document_server.server
import io
import json
from pydantic import Field
from mcp.server.fastmcp import FastMCP
from PyPDF2 import PdfReader
import base64

mcp_server = FastMCP("Document Server")

@mcp_server.tool()
def extract_pdf_text(
    base64_pdf: str = Field(description="Base64 encoded string of the PDF file contents")
) -> str:
    """Extract text from a base64-encoded PDF file."""
    try:
        pdf_bytes = base64.b64decode(base64_pdf)
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = "\\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            return json.dumps({"error": "No extractable text found in PDF."})
        
        # Limit to 50k chars for safety (like the original implementation)
        return json.dumps({"text": text[:50000], "pages": len(reader.pages)})
    except Exception as e:
        return json.dumps({"error": f"Failed to parse PDF: {str(e)}"})

# For SSE Transport via FastAPI
app = mcp_server.get_starlette_app()
