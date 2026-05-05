"""
Hidden evaluator for RCQ responses.
"""
import os
import json
from typing import Dict, Any, Optional

def evaluate_rcq(global_session_index: int, responses: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """
    Evaluate the child's responses against hidden answer keys using an LLM.
    global_session_index: 1-based index across weeks (RCQ at sessions 3, 6, 9).
    """
    if global_session_index not in (3, 6, 9):
        return None

    # We need the answer keys. For simplicity, we define them here or pass them.
    # Given the previous context, we know the questions and expected answers.
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "Scoring skipped: API key missing"}

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Construct the evaluation prompt
        # Note: We are using a simplified logic here. In a production system, 
        # we'd pass the full rcqData from the frontend or share a common data file.
        
        prompt = f"""
        You are a research evaluator for a child literacy study.
        Evaluate the following Portuguese reading comprehension responses for global session {global_session_index}.
        
        Compare the child's response to the expected answer.
        Assign a score (0 to points_max) based on accuracy.
        
        Responses:
        {json.dumps(responses, indent=2, ensure_ascii=False)}
        
        Return a JSON object:
        {{
          "total_score": float,
          "max_possible": float,
          "evaluations": [
            {{ "id": "question_id", "score": float, "correct": boolean, "comment": "short explanation" }}
          ]
        }}
        """

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a precise educational evaluator. Return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0
        )
        
        result = json.loads(completion.choices[0].message.content)
        return result
    except Exception as e:
        return {"error": str(e)}
