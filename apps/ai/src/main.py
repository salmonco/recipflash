from fastapi import FastAPI, UploadFile, File, HTTPException
from langchain_ollama import ChatOllama
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field
import PyPDF2
import io
import json
import re
from typing import List
from langchain_core.runnables import RunnableLambda, Runnable

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

def parse_llm_response_to_flashcards(llm_output: str) -> List[Flashcard]:
    flashcards_list = []
    
    # Common alternative field names mapping
    field_renames = {
        "question": "front",
        "answer": "back",
        "q": "front",
        "a": "back",
        "name": "front",
        "description": "back",
        "title": "front",
        "content": "back",
        "recipe": "front",
        "ingredients": "back",
        "item": "front",
        "details": "back",
        "term": "front",
        "definition": "back",
        "prompt": "front",
        "response": "back", 
    }

    # Strategy 1: Look for JSON array directly, potentially within markdown code blocks
    json_patterns = [
        r'```json\s*(\[.*?\])\s*```',  # JSON array in markdown code block
        r'\[\s*\{.*\}\s*\]',           # Direct JSON array
    ]

    for pattern in json_patterns:
        match = re.search(pattern, llm_output, re.DOTALL)
        if match:
            json_str = match.group(1) if len(match.groups()) > 0 else match.group(0)
            try:
                data = json.loads(json_str)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            processed_item = {}
                            for key, value in item.items():
                                new_key = field_renames.get(key.lower(), key)
                                processed_item[new_key] = value

                            if "front" in processed_item and "back" in processed_item:
                                flashcards_list.append(Flashcard(front=processed_item["front"], back=processed_item["back"]))
                    if flashcards_list: # If we found valid flashcards, return them
                        return flashcards_list
            except json.JSONDecodeError:
                # Continue to next pattern if parsing fails
                pass

    # Strategy 2: If no clear JSON array found, try to extract individual flashcard-like objects
    # This is a more lenient approach if the LLM is not strictly outputting an array
    # This might be useful if the LLM outputs something like:
    # {"front": "...", "back": "..."}
    # {"front": "...", "back": "..."}
    # (multiple objects without an enclosing array)
    
    # Regex to find individual JSON objects
    object_matches = re.findall(r'{\s*"front":\s*".*?",\s*"back":\s*".*?"\s*}', llm_output, re.DOTALL)
    for obj_str in object_matches:
        try:
            item = json.loads(obj_str)
            if isinstance(item, dict):
                processed_item = {}
                for key, value in item.items():
                    new_key = field_renames.get(key.lower(), key)
                    processed_item[new_key] = value

                if "front" in processed_item and "back" in processed_item:
                    flashcards_list.append(Flashcard(front=processed_item["front"], back=processed_item["back"]))
        except json.JSONDecodeError:
            pass
    
    if flashcards_list:
        return flashcards_list

    # Strategy 3: Fallback - try to parse the entire output as a single JSON array
    # This is less robust if there's conversational text, but good as a last resort
    try:
        data = json.loads(llm_output.strip())
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    processed_item = {}
                    for key, value in item.items():
                        new_key = field_renames.get(key.lower(), key)
                        processed_item[new_key] = value

                    if "front" in processed_item and "back" in processed_item:
                        flashcards_list.append(Flashcard(front=processed_item["front"], back=processed_item["back"]))
            if flashcards_list:
                return flashcards_list
    except json.JSONDecodeError:
        pass

    raise ValueError(f"Failed to extract and parse any valid flashcards from LLM output. Raw output: {llm_output}")

# --- Language Translation Helper ---
# In a real-world scenario, you might use a dedicated translation API
# or a more sophisticated language detection and translation mechanism.
# For this example, we'll use a simple LLM call for translation.
async def translate_to_korean_llm(text: str) -> str:
    translation_prompt = PromptTemplate.from_template(
        "Translate the following text into Korean. Respond ONLY with the translated text, no extra words or explanations:\n{text}"
    )
    # Use the same LLM instance for translation
    chain = translation_prompt | llm | (lambda x: x.content)
    translated_text = await chain.ainvoke({"text": text})
    return translated_text.strip()

async def translate_flashcards_to_korean(flashcards: List[Flashcard]) -> List[Flashcard]:
    translated_flashcards = []
    for flashcard in flashcards:
        # Simple language detection (can be improved with a library like `langdetect`)
        # For now, assume if it's not obviously Korean, translate it.
        # This is a very basic check and might not be accurate for all cases.
        is_korean_front = any('\uac00' <= char <= '\ud7a3' for char in flashcard.front)
        is_korean_back = any('\uac00' <= char <= '\ud7a3' for char in flashcard.back)

        new_front = flashcard.front
        new_back = flashcard.back

        if not is_korean_front:
            new_front = await translate_to_korean_llm(flashcard.front)
        if not is_korean_back:
            new_back = await translate_to_korean_llm(flashcard.back)
        
        translated_flashcards.append(Flashcard(front=new_front, back=new_back))
    return translated_flashcards

# --- Helper function to extract text from PDF ---
def extract_text_from_pdf(file_content: bytes) -> str:
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
    print(f"recipe_text: {recipe_text}")  # Debugging output

    if not recipe_text.strip():
        raise HTTPException(status_code=400, detail="No text provided for flashcard generation.")

    flashcard_prompt = PromptTemplate(
        template="""다음 레시피 텍스트에서 플래시카드 JSON 배열을 생성하세요. 모든 내용은 한국어여야 합니다.
각 플래시카드는 'front'와 'back' 키를 가진 JSON 객체여야 합니다.
예시:
[
  {{"front": "헛개리카노", "back": "샷, 헛개시럽 2P"}},
  {{"front": "헤이즐넛아메리카노", "back": "샷, 헤이즐넛시럽 2P"}},
  {{"front": "레몬에이드", "back": "사이다 가득(250ml), 레몬퓨레 1.5P + 슈가시럽 1P + 레몬슬라이스 + 애플민트"}},
  {{"front": "자몽에이드", "back": "사이다 가득(250ml), 자몽퓨레 1P + 자몽시럽 1P + 슈가시럽 1P + 자몽슬라이스 + 애플민트"}},
  {{"front": "플레인요거트스무디", "back": "우유 200ml, 요거트파우더 6래들 + 슈가시럽 1P"}},
  {{"front": "딸기요거트스무디", "back": "우유 150ml, 요거트파우더 3래들 + 가당딸기 150ml + 슈가시럽 1P"}},
  {{"front": "코코넛커피스무디", "back": "블랜더(재료,얼음) → 믹싱 → 계량컵(식힌 샷) → 컵(부어줌) → 토핑 3번 20x가득 x 코코넛베이스 250ml + 코코넛칩 1래들  // 컵 바닥 식힌 샷 50ml 코코넛칩 1래들(약 5g)"}},
]
레시피 텍스트:
---
{recipe_text}
---
JSON 응답:
""",
        input_variables=["recipe_text"],
    )

    # Chain for parsing only
    parsing_chain = flashcard_prompt | llm | (lambda x: x.content) | RunnableLambda(parse_llm_response_to_flashcards)

    parsed_flashcards = await parsing_chain.ainvoke({"recipe_text": recipe_text})

    print(f"parsed_flashcards: {parsed_flashcards}")  # Debugging output

    # Apply translation separately
    translated_flashcards = await translate_flashcards_to_korean(parsed_flashcards)

    print(f"translated_flashcards: {translated_flashcards}")  # Debugging output

    return FlashcardResponse(flashcards=translated_flashcards)

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
        recipe_text = extract_text_from_pdf(file_content)

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
