from fastapi import FastAPI, UploadFile, File, HTTPException
from langchain_ollama import ChatOllama
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
import PyPDF2
import io
import json

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Recipflash AI Server",
    description="AI server for recipe-related tasks using LangChain and Ollama, including PDF processing.",
)

# --- Ollama and LangChain Setup ---
llm = ChatOllama(model="llama3")

# --- API Models ---
class Flashcard(BaseModel):
    front: str = Field(description="recipe name")
    back: str = Field(description="recipe ingredients")

class FlashcardResponse(BaseModel):
    flashcards: list[Flashcard]

# --- Helper function to extract text from PDF ---
async def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page_num in range(len(reader.pages)):
            text += reader.pages[page_num].extract_text() or ""
        return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {e}")

# --- Helper function to generate flashcards from text ---
async def generate_flashcards_from_text_util(recipe_text: str) -> FlashcardResponse:
    if not recipe_text.strip():
        raise HTTPException(status_code=400, detail="No text provided for flashcard generation.")
    
    output_parser = JsonOutputParser(pydantic_object=FlashcardResponse)

    flashcard_prompt = PromptTemplate(
        template="Generate a JSON array of flashcards from the following recipe text.\n{format_instructions}\n{recipe_text}\n",
        input_variables=["recipe_text"],
        partial_variables={"format_instructions": output_parser.get_format_instructions()},
    )

    # Define the LCEL chain
    chain = flashcard_prompt | llm | output_parser

    llm_response = chain.invoke({"recipe_text": recipe_text})

    print(f"recipe_text: {recipe_text}")  # Debugging output
    print(f"LLM Response: {llm_response}")  # Debugging output

    return FlashcardResponse(flashcards=llm_response)

# --- API Endpoints ---

@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {"status": "AI server is running"}

@app.post("/generate/flashcards", response_model=FlashcardResponse)
async def generate_flashcards(file: UploadFile = File(...)):
    """Generate flashcards from an uploaded PDF recipe."""
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    try:
        file_content = await file.read()
        recipe_text = await extract_text_from_pdf(file_content)

        if not recipe_text.strip():
            raise HTTPException(status_code=400, detail="No text found in the PDF.")

        return await generate_flashcards_from_text_util(recipe_text)

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF and generate flashcards: {e}")

# To run this server:
# 1. Make sure Ollama is running (e.g., 'ollama serve')
# 2. Make sure you have a model pulled (e.g., 'ollama pull llama3')
# 3. Run the FastAPI app: 'uvicorn src.main:app --reload --port 8000'
