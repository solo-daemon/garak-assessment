import os
from azure.identity import DefaultAzureCredential
from azure.ai.evaluation.red_team import RedTeam, RiskCategory
from pyrit.prompt_target import HTTPTarget
from pyrit.orchestrator import RedTeamingOrchestrator

# Define your API endpoint
api_url = "http://localhost:3000/api/ask"

# Set up the HTTP target
target = HTTPTarget(
    url=api_url,
    method="POST",
    headers={"Content-Type": "application/json"},
    json_body=lambda prompt: {"prompt": prompt},
)

# Initialize the Red Team agent
red_team_agent = RedTeam(
    azure_ai_project=os.getenv("AZURE_AI_PROJECT"),
    credential=DefaultAzureCredential(),
    risk_categories=[RiskCategory.Violence, RiskCategory.HateUnfairness],
    num_objectives=5,
)

# Set up the orchestrator
orchestrator = RedTeamingOrchestrator(target)

# Define a simple callback function
def simple_callback(query: str) -> str:
    return orchestrator.send_prompts_async([query])

# Run the red-teaming scan
red_team_result = await red_team_agent.scan(target=simple_callback)

# Output the results
print(red_team_result)