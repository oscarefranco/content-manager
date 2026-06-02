#!/usr/bin/env python3
"""Training Content Generator — CLI Entry Point.

Generates structured instructional design training content from source URLs
using an LLM. Outputs markdown files following Microsoft Learn module
conventions: Overview → Introduction → Area Units → Knowledge Check → Summary.

By default, each URL produces its own training module. Use --merge to combine
all URLs into a single module.

Usage:
    python generate_training.py                           # reads URLs from urls.txt
    python generate_training.py --urls-file my_urls.txt   # reads URLs from custom file
    python generate_training.py <url1> [url2] ...         # pass URLs directly
    python generate_training.py --merge <url1> [url2]     # merge URLs into one module
    python generate_training.py --merge --module-name "My Topic" <url1> [url2]
    python generate_training.py --output-dir ./output
    python generate_training.py --date "April_15_2026"
"""

import argparse
import sys
import os

from dotenv import load_dotenv

from url_fetcher import fetch_and_extract, merge_extracted_content
from prompts import STATIC_UNIT_PROMPTS, identify_areas_prompt, area_content_prompt
from openai_client import get_client, generate_content, parse_areas_response
from file_writer import get_date_folder_name, write_module


def load_urls_from_file(filepath: str) -> list[str]:
    """Read URLs from a text file, one per line. Ignores comments and blank lines."""
    if not os.path.exists(filepath):
        return []
    urls = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    return urls


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate instructional design training content from URLs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_training.py                             # uses urls.txt, one module per URL
  python generate_training.py --urls-file my_urls.txt     # custom file
  python generate_training.py https://example.com/topic   # inline URL
  python generate_training.py --merge url1 url2 url3      # merge into one module
  python generate_training.py --merge --module-name "My Topic" url1 url2

Configuration is loaded from .env file automatically.
        """,
    )
    parser.add_argument(
        "urls",
        nargs="*",
        help="Optional: one or more source URLs (if omitted, reads from urls.txt).",
    )
    parser.add_argument(
        "--urls-file",
        default="urls.txt",
        help="Path to a text file with URLs, one per line (default: urls.txt).",
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="Base output directory (default: current directory).",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Date folder name override in Month_DD_YYYY format (default: today).",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        default=False,
        help="Merge all URLs into a single training module instead of one per URL.",
    )
    parser.add_argument(
        "--module-name",
        default=None,
        help="Module title when using --merge (default: first URL's page title).",
    )
    return parser.parse_args()


def process_module(
    extracted,
    client,
    deployment: str,
    output_dir: str,
    date_folder: str,
) -> list[str]:
    """Process a single ExtractedContent through the pipeline: identify areas → generate → write."""

    print(f"  📄 Title: {extracted.title}")
    print(f"  🔖 Slug: {extracted.slug}")
    print(f"  📝 Content: {len(extracted.raw_text)} characters")

    if len(extracted.raw_text) < 100:
        print("  ⚠ Warning: Very little content extracted. Output quality may be limited.")

    # Step 1: Identify logical areas from the source content
    print("  🔍 Identifying logical areas...")
    sys_prompt, user_prompt = identify_areas_prompt(
        extracted.title, extracted.description, extracted.raw_text,
    )
    try:
        areas_raw = generate_content(client, deployment, sys_prompt, user_prompt)
        areas = parse_areas_response(areas_raw)
        print(f"     ✅ Found {len(areas)} area(s): {', '.join(a['name'] for a in areas)}")
    except Exception as e:
        print(f"     ❌ Failed to identify areas: {e}", file=sys.stderr)
        return []

    # Step 2: Generate static units (overview, introduction) and area-based units
    units = {}

    # Generate pre-area static units
    for unit_key in ["overview", "introduction"]:
        prompt_fn = STATIC_UNIT_PROMPTS[unit_key]
        print(f"  🤖 Generating {unit_key}...")
        system_prompt, user_prompt = prompt_fn(
            extracted.title, extracted.description, extracted.raw_text,
        )
        try:
            content = generate_content(client, deployment, system_prompt, user_prompt)
            units[unit_key] = content
            print(f"     ✅ Generated ({len(content)} chars)")
        except Exception as e:
            print(f"     ❌ Failed: {e}", file=sys.stderr)
            units[unit_key] = f"# {unit_key}\n\n> Content generation failed: {e}\n"

    # Generate per-area content (concepts + procedures combined)
    area_units = []
    for area in areas:
        area_label = area["name"]
        print(f"  🤖 Generating area: {area_label}...")
        system_prompt, user_prompt = area_content_prompt(
            extracted.title,
            extracted.description,
            extracted.raw_text,
            area["name"],
            area["description"],
        )
        try:
            content = generate_content(client, deployment, system_prompt, user_prompt)
            area_units.append((area["slug"], content))
            print(f"     ✅ Generated ({len(content)} chars)")
        except Exception as e:
            print(f"     ❌ Failed: {e}", file=sys.stderr)
            area_units.append((area["slug"], f"# {area_label}\n\n> Content generation failed: {e}\n"))

    # Generate post-area static units
    for unit_key in ["knowledge-check", "summary"]:
        prompt_fn = STATIC_UNIT_PROMPTS[unit_key]
        print(f"  🤖 Generating {unit_key}...")
        system_prompt, user_prompt = prompt_fn(
            extracted.title, extracted.description, extracted.raw_text,
        )
        try:
            content = generate_content(client, deployment, system_prompt, user_prompt)
            units[unit_key] = content
            print(f"     ✅ Generated ({len(content)} chars)")
        except Exception as e:
            print(f"     ❌ Failed: {e}", file=sys.stderr)
            units[unit_key] = f"# {unit_key}\n\n> Content generation failed: {e}\n"

    # Step 3: Assemble numbered file map and write output
    numbered_units = {}
    idx = 0
    numbered_units[f"{idx}-overview"] = units["overview"]
    idx += 1
    numbered_units[f"{idx}-introduction"] = units["introduction"]
    idx += 1
    for area_slug, area_content in area_units:
        numbered_units[f"{idx}-{area_slug}"] = area_content
        idx += 1
    numbered_units[f"{idx}-knowledge-check"] = units["knowledge-check"]
    idx += 1
    numbered_units[f"{idx}-summary"] = units["summary"]

    print(f"  💾 Writing files to {output_dir}/{date_folder}/{extracted.slug}/")
    written_files = write_module(output_dir, date_folder, extracted.slug, numbered_units)

    return written_files


def process_url(
    url: str,
    client,
    deployment: str,
    output_dir: str,
    date_folder: str,
) -> list[str]:
    """Fetch a single URL and process it into a training module."""

    print(f"\n📥 Fetching content from: {url}")
    try:
        extracted = fetch_and_extract(url)
    except Exception as e:
        print(f"  ❌ Failed to fetch URL: {e}", file=sys.stderr)
        return []

    return process_module(extracted, client, deployment, output_dir, date_folder)


def main():
    # Load .env file for configuration
    load_dotenv()

    args = parse_args()

    # Resolve URLs: command-line args take priority, then urls.txt
    urls = args.urls
    if not urls:
        urls_file = os.path.join(os.path.dirname(__file__) or ".", args.urls_file)
        urls = load_urls_from_file(urls_file)
        if urls:
            print(f"📄 Loaded {len(urls)} URL(s) from {urls_file}")
        else:
            print(f"Error: No URLs provided and {urls_file} is empty or missing.", file=sys.stderr)
            print("  Add URLs to urls.txt (one per line) or pass them as arguments.", file=sys.stderr)
            sys.exit(1)

    # Determine date folder
    date_folder = args.date if args.date else get_date_folder_name()
    output_dir = os.path.abspath(args.output_dir)

    print("=" * 60)
    print("📚 Training Content Generator")
    print("=" * 60)
    print(f"  Output directory: {output_dir}")
    print(f"  Date folder:      {date_folder}")
    print(f"  URLs to process:  {len(urls)}")
    print(f"  Mode:             {'merge' if args.merge else 'per-URL'}")

    # Initialize LLM client (validates env vars)
    print("\n🔑 Initializing LLM client...")
    client, model, backend = get_client()
    print(f"  ✅ Connected via {backend} (model: {model})")

    if args.merge:
        # Merge mode: fetch all URLs, combine content, produce one module
        print(f"\n{'─' * 60}")
        print(f"📖 Fetching {len(urls)} URL(s) for merge...")
        print(f"{'─' * 60}")

        extracted_list = []
        for i, url in enumerate(urls, 1):
            print(f"\n📥 [{i}/{len(urls)}] Fetching: {url}")
            try:
                extracted = fetch_and_extract(url)
                extracted_list.append(extracted)
                print(f"  ✅ {extracted.title} ({len(extracted.raw_text)} chars)")
            except Exception as e:
                print(f"  ❌ Failed to fetch: {e}", file=sys.stderr)

        if not extracted_list:
            print("Error: No URLs could be fetched.", file=sys.stderr)
            sys.exit(1)

        print(f"\n🔗 Merging {len(extracted_list)} source(s) into one module...")
        merged = merge_extracted_content(extracted_list, args.module_name)

        print(f"\n{'─' * 60}")
        print("📖 Processing merged module")
        print(f"{'─' * 60}")
        all_files = process_module(merged, client, model, output_dir, date_folder)
        success_count = 1 if all_files else 0
        total_count = 1
    else:
        # Default mode: one module per URL
        all_files = []
        success_count = 0
        for i, url in enumerate(urls, 1):
            print(f"\n{'─' * 60}")
            print(f"📖 Processing URL {i}/{len(urls)}")
            print(f"{'─' * 60}")

            files = process_url(url, client, model, output_dir, date_folder)
            if files:
                all_files.extend(files)
                success_count += 1
        total_count = len(urls)

    # Summary
    print(f"\n{'=' * 60}")
    print("✅ Generation Complete!")
    print(f"{'=' * 60}")
    print(f"  Modules processed: {success_count}/{total_count}")
    print(f"  Files generated:   {len(all_files)}")
    if all_files:
        print(f"\n  📁 Output files:")
        for f in all_files:
            print(f"     • {f}")

    if success_count < total_count:
        print(f"\n  ⚠ {total_count - success_count} module(s) failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
