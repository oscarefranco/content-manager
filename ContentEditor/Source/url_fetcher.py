"""URL fetching and content extraction module.

Fetches HTML from a URL, extracts meaningful text content using BeautifulSoup,
and returns structured data (title, sections, raw text) for downstream processing.

Supports two kinds of URLs:
  1. Regular web URLs — fetched via HTTP and parsed as HTML.
  2. GitHub repository URLs — fetched via the GitHub Contents API using
     GITHUB_REPO_TOKEN (supports private repos).
"""

import base64
import os
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


@dataclass
class Section:
    heading: str
    level: int
    content: str


@dataclass
class ExtractedContent:
    url: str
    title: str
    description: str
    sections: list[Section] = field(default_factory=list)
    raw_text: str = ""
    slug: str = ""


def fetch_url(url: str, timeout: int = 30) -> str:
    """Fetch HTML content from a URL."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.text


def _clean_text(text: str) -> str:
    """Clean extracted text by normalizing whitespace."""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _derive_slug(url: str, title: str) -> str:
    """Derive a module slug from the URL path or title."""
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]
    if path_parts:
        slug = path_parts[-1]
    else:
        slug = title

    slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return slug or "untitled-module"


def _slug_from_title(title: str) -> str:
    """Derive a slug from a plain text title."""
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "untitled-module"


def merge_extracted_content(
    items: list[ExtractedContent],
    module_title: str | None = None,
) -> ExtractedContent:
    """Merge multiple ExtractedContent objects into one combined object.

    Args:
        items: List of extracted content from different URLs.
        module_title: Optional override title. If None, uses the first item's title.

    Returns:
        A single ExtractedContent with concatenated text, merged descriptions,
        and a slug derived from the title.
    """
    if not items:
        raise ValueError("Cannot merge an empty list of ExtractedContent.")

    title = module_title or items[0].title
    slug = _slug_from_title(title)

    # Merge descriptions (deduplicate, join with semicolons)
    descriptions = []
    seen = set()
    for item in items:
        if item.description and item.description not in seen:
            descriptions.append(item.description)
            seen.add(item.description)
    description = "; ".join(descriptions)

    # Concatenate raw text with source markers
    text_parts = []
    all_sections = []
    for item in items:
        text_parts.append(f"\n\n--- Source: {item.title} ({item.url}) ---\n\n")
        text_parts.append(item.raw_text)
        all_sections.extend(item.sections)

    raw_text = "".join(text_parts).strip()

    return ExtractedContent(
        url=items[0].url,
        title=title,
        description=description,
        sections=all_sections,
        raw_text=raw_text,
        slug=slug,
    )


def extract_content(html: str, url: str) -> ExtractedContent:
    """Extract structured content from HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove script, style, nav, footer, header elements
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Extract title
    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)

    # Extract meta description
    description = ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        description = meta_desc["content"]

    # Extract main content area (prefer <main> or <article>)
    main_content = soup.find("main") or soup.find("article") or soup.find("body")
    if not main_content:
        main_content = soup

    # Extract sections based on headings
    sections = []
    headings = main_content.find_all(re.compile(r"^h[1-6]$"))

    if headings:
        for i, heading in enumerate(headings):
            level = int(heading.name[1])
            heading_text = heading.get_text(strip=True)

            # Gather content until the next heading
            content_parts = []
            sibling = heading.find_next_sibling()
            while sibling and not re.match(r"^h[1-6]$", sibling.name or ""):
                text = sibling.get_text(separator="\n", strip=True)
                if text:
                    content_parts.append(text)
                sibling = sibling.find_next_sibling()

            sections.append(Section(
                heading=heading_text,
                level=level,
                content="\n\n".join(content_parts),
            ))

    # Extract raw text
    raw_text = _clean_text(main_content.get_text(separator="\n", strip=True))

    slug = _derive_slug(url, title)

    return ExtractedContent(
        url=url,
        title=title,
        description=description,
        sections=sections,
        raw_text=raw_text,
        slug=slug,
    )


def _parse_github_url(url: str) -> dict | None:
    """Parse a GitHub URL into owner/repo/path/ref components.

    Supports formats like:
        https://github.com/owner/repo/blob/branch/path/to/file.md
        https://github.com/owner/repo/tree/branch/path/to/dir
        https://github.com/owner/repo  (root of default branch)

    Returns None if the URL is not a recognized GitHub repo URL.
    """
    parsed = urlparse(url)
    if parsed.hostname not in ("github.com", "www.github.com"):
        return None

    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        return None

    owner, repo = parts[0], parts[1]
    ref = None
    path = ""

    if len(parts) >= 4 and parts[2] in ("blob", "tree"):
        ref = parts[3]
        path = "/".join(parts[4:])
    elif len(parts) > 2:
        path = "/".join(parts[2:])

    return {"owner": owner, "repo": repo, "ref": ref, "path": path}


def _fetch_github_content(owner: str, repo: str, path: str = "",
                          ref: str | None = None, timeout: int = 30) -> str:
    """Fetch file/directory content from the GitHub Contents API.

    Uses GITHUB_REPO_TOKEN for authentication (supports private repos).
    For files, returns the decoded text content.
    For directories, returns a listing with each file's content concatenated.
    """
    token = os.environ.get("GITHUB_REPO_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "GITHUB_REPO_TOKEN is not set. Add it to your .env file to access "
            "GitHub repo content. Create a PAT with 'repo' scope at "
            "https://github.com/settings/tokens"
        )

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "TrainingContentGenerator/1.0",
    }

    api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    if ref:
        api_url += f"?ref={ref}"

    resp = requests.get(api_url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()

    # Single file
    if isinstance(data, dict) and data.get("type") == "file":
        content_b64 = data.get("content", "")
        return base64.b64decode(content_b64).decode("utf-8", errors="replace")

    # Directory listing — fetch each file's content
    if isinstance(data, list):
        parts = []
        for item in data:
            if item["type"] == "file":
                file_resp = requests.get(
                    item["url"], headers=headers, timeout=timeout
                )
                file_resp.raise_for_status()
                file_data = file_resp.json()
                content_b64 = file_data.get("content", "")
                text = base64.b64decode(content_b64).decode("utf-8", errors="replace")
                parts.append(f"\n\n--- File: {item['path']} ---\n\n{text}")
        return "".join(parts).strip()

    return str(data)


def _extract_from_raw_text(raw_text: str, url: str, title: str = "") -> ExtractedContent:
    """Build an ExtractedContent from raw text (e.g. markdown from GitHub)."""
    if not title:
        # Try to extract title from first markdown heading
        for line in raw_text.split("\n"):
            line = line.strip()
            if line.startswith("# "):
                title = line.lstrip("# ").strip()
                break
        if not title:
            title = _derive_slug(url, "untitled")

    slug = _derive_slug(url, title)

    # Extract markdown sections (## headings)
    sections = []
    heading_pattern = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(raw_text))
    for i, match in enumerate(matches):
        level = len(match.group(1))
        heading_text = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
        content = raw_text[start:end].strip()
        sections.append(Section(heading=heading_text, level=level, content=content))

    description = raw_text[:200].replace("\n", " ").strip()

    return ExtractedContent(
        url=url,
        title=title,
        description=description,
        sections=sections,
        raw_text=_clean_text(raw_text),
        slug=slug,
    )


def fetch_and_extract(url: str) -> ExtractedContent:
    """Fetch a URL and extract structured content.

    Automatically detects GitHub repo URLs and uses the GitHub API
    (with GITHUB_REPO_TOKEN) for those. All other URLs are fetched as HTML.
    """
    github_info = _parse_github_url(url)
    if github_info:
        raw_text = _fetch_github_content(
            owner=github_info["owner"],
            repo=github_info["repo"],
            path=github_info["path"],
            ref=github_info["ref"],
        )
        return _extract_from_raw_text(raw_text, url)

    html = fetch_url(url)
    return extract_content(html, url)
