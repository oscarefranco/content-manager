"""LLM API integration module.

Supports two backends:
  1. GitHub Models API (default) — uses a GitHub PAT token, no Azure subscription needed
  2. Azure OpenAI API — for users with Azure OpenAI deployments

Configuration is read from environment variables.
"""

import json
import os
import re
import sys
import time

from openai import AzureOpenAI, OpenAI


def _detect_backend() -> str:
    """Detect which backend to use based on available environment variables."""
    if os.environ.get("GITHUB_TOKEN"):
        return "github"
    if os.environ.get("AZURE_OPENAI_ENDPOINT") and os.environ.get("AZURE_OPENAI_API_KEY"):
        return "azure"
    return "github"  # default


def _get_github_config() -> dict:
    """Read GitHub Models API configuration from environment variables."""
    token = os.environ.get("GITHUB_TOKEN")
    model = os.environ.get("GITHUB_MODEL", "gpt-4o")

    if not token:
        print("Error: Missing GITHUB_TOKEN environment variable.", file=sys.stderr)
        print("\nTo use the GitHub Models API (recommended):", file=sys.stderr)
        print("  1. Create a GitHub PAT at https://github.com/settings/tokens", file=sys.stderr)
        print("  2. Set: $env:GITHUB_TOKEN = \"ghp_your_token_here\"", file=sys.stderr)
        print(f"  3. Optionally set: $env:GITHUB_MODEL = \"gpt-4o\" (default: {model})", file=sys.stderr)
        print("\nAlternatively, set Azure OpenAI variables:", file=sys.stderr)
        print("  AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT", file=sys.stderr)
        sys.exit(1)

    return {"token": token, "model": model}


def _get_azure_config() -> dict:
    """Read Azure OpenAI configuration from environment variables."""
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    missing = []
    if not endpoint:
        missing.append("AZURE_OPENAI_ENDPOINT")
    if not api_key:
        missing.append("AZURE_OPENAI_API_KEY")
    if not deployment:
        missing.append("AZURE_OPENAI_DEPLOYMENT")

    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        print("\nPlease set:", file=sys.stderr)
        print("  AZURE_OPENAI_ENDPOINT   — Your Azure OpenAI endpoint URL", file=sys.stderr)
        print("  AZURE_OPENAI_API_KEY    — Your Azure OpenAI API key", file=sys.stderr)
        print("  AZURE_OPENAI_DEPLOYMENT — Your deployment/model name", file=sys.stderr)
        sys.exit(1)

    return {
        "endpoint": endpoint,
        "api_key": api_key,
        "deployment": deployment,
        "api_version": api_version,
    }


def get_client() -> tuple[OpenAI | AzureOpenAI, str, str]:
    """Create and return an LLM client, model name, and backend name.

    Returns:
        (client, model_name, backend_name)
    """
    backend = _detect_backend()

    if backend == "github":
        config = _get_github_config()
        client = OpenAI(
            base_url="https://models.inference.ai.azure.com",
            api_key=config["token"],
        )
        return client, config["model"], "GitHub Models"

    else:
        config = _get_azure_config()
        client = AzureOpenAI(
            azure_endpoint=config["endpoint"],
            api_key=config["api_key"],
            api_version=config["api_version"],
        )
        return client, config["deployment"], "Azure OpenAI"


def generate_content(
    client: OpenAI | AzureOpenAI,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_retries: int = 3,
    temperature: float = 0.7,
) -> str:
    """Send a prompt to the LLM and return the generated markdown content.

    Includes retry logic with exponential backoff for transient errors.
    """
    for attempt in range(1, max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=16000,
            )
            content = response.choices[0].message.content
            return content.strip() if content else ""

        except Exception as e:
            error_msg = str(e)
            if attempt < max_retries and any(
                keyword in error_msg.lower()
                for keyword in ["rate limit", "429", "500", "502", "503", "timeout"]
            ):
                wait_time = 2 ** attempt
                print(f"  ⚠ Attempt {attempt}/{max_retries} failed: {error_msg[:100]}")
                print(f"    Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise RuntimeError(
                    f"API call failed after {attempt} attempt(s): {error_msg}"
                ) from e

    raise RuntimeError("API call failed: exhausted all retries")


def parse_areas_response(raw: str) -> list[dict]:
    """Parse the LLM's area-identification response into a list of area dicts.

    Expected format: [{"name": "...", "slug": "...", "description": "..."}, ...]
    Handles markdown code fences and minor formatting issues.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`")

    try:
        areas = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse areas JSON from LLM response: {e}\nRaw: {raw[:500]}") from e

    if not isinstance(areas, list) or len(areas) == 0:
        raise ValueError(f"Expected a non-empty JSON array of areas, got: {raw[:500]}")

    validated = []
    for i, area in enumerate(areas):
        name = area.get("name", "").strip()
        slug = area.get("slug", "").strip()
        desc = area.get("description", "").strip()
        if not name:
            raise ValueError(f"Area {i} is missing a 'name' field: {area}")
        if not slug:
            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        validated.append({"name": name, "slug": slug, "description": desc})

    return validated
