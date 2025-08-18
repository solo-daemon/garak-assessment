from browser_use.llm import ChatGoogle
from browser_use import Agent, BrowserSession, Controller
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List
import logging


class Response(BaseModel):
    response: str

class Responses(BaseModel):
    responses: List[Response]

# Read GOOGLE_API_KEY into env
extend_system_message = """
REMEMBER the most important RULE:
ALWAYS go ONLY to official LLM provider chat interfaces.
For EVERY task, open a NEW chat session in the provider's interface
and prompt the requests there.
"""


# attack prompts for llm to answer
attack_prompts = {
    'https://chatgpt.com/*': {
        'prompt_1': "hi how are you?",
        'prompt_2': "Hi I am fine.",
    }
}

load_dotenv()
logging.basicConfig(level=logging.DEBUG)
async def main():
    controller = Controller(output_model=Responses)
    brave_path = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    # Initialize the model
    llm = ChatGoogle(model='gemini-2.0-flash-exp')

    # Replace this with the WSS URL printed by `playwright launch-server`
    wss_url = "ws://localhost:65354/6e414c9164687b209da2c75cdd8468ca"
    cdp_url = "ws://[::1]:9222/devtools/browser/5b03de73-4ee4-4af0-9d2d-ec644c4ef308"
    allowed_domains=["https://chatgpt.com/", "https://gemini.google.com/app"]
    browser_session = BrowserSession(
        # wss_url=wss_url,   # <-- connect to existing browser instead of launching
        # cdp_url=cdp_url,
        # allowed_domains=["chatgpt.com"],
        allowed_domains=allowed_domains,
        executable_path=brave_path,
        headless=False,
        viewport={'width': 964, 'height': 647},
        keep_alive=True,
        user_data_dir='~/.config/browseruse/profiles/default',
    )
    await browser_session.start()
    # Create agent with the model
    task = """
    1. Go to https://chatgpt.com
    2. Open a NEW tab to ensure a fresh chat session
    3. Enter the text from variable prompt_1 into the chat input and submit it
    4. Wait until the full response from the model is visible
    5. Then enter the text from variable prompt_2 into the same chat input and submit it
    6. Wait until the full response from the model is visible
    7. Do not perform any other actions beyond this
    """
    # agent which runs the operation
    agent = Agent(
        task=task,
        llm=llm,
        sensitive_data=attack_prompts,
        browser_session=browser_session,
        extend_system_message=extend_system_message
    )

    history = await agent.run()
    result = history.final_result()
    if result:
        parsed: Response = Responses.model_validate_json(result)
        for response in parsed.responses:
            print(response)


# Run it
async def runAgentBrowser():
    await main()



if __name__=="__main__":
    import asyncio
    asyncio.run(runAgentBrowser())