"""Output file writer module.

Creates the date-stamped folder structure and writes generated markdown
files for each training module unit.
"""

import os
from datetime import datetime


# Month names for the folder format
_MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def get_date_folder_name(date: datetime | None = None) -> str:
    """Generate a date folder name in Month_DD_YYYY format.

    Examples: April_12_2026, January_05_2025
    """
    if date is None:
        date = datetime.now()
    month = _MONTH_NAMES[date.month]
    return f"{month}_{date.day:02d}_{date.year}"


def create_module_directory(output_dir: str, date_folder: str, module_slug: str) -> str:
    """Create the module output directory and return its path.

    Structure: <output_dir>/<date_folder>/<module_slug>/
    """
    module_path = os.path.join(output_dir, date_folder, module_slug)
    os.makedirs(module_path, exist_ok=True)
    return module_path


def write_unit_file(module_path: str, unit_name: str, content: str) -> str:
    """Write a file for a training unit (markdown or YAML).

    Args:
        module_path: Path to the module directory
        unit_name: Name of the unit (e.g., "0-overview", "1-introduction")
                   If the name ends with .yml, uses that extension; otherwise .md.
        content: Content to write

    Returns:
        Full path to the written file
    """
    if unit_name.endswith(".yml"):
        filename = unit_name
    else:
        filename = f"{unit_name}.md"
    filepath = os.path.join(module_path, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        if not content.endswith("\n"):
            f.write("\n")
    return filepath


def write_module(
    output_dir: str,
    date_folder: str,
    module_slug: str,
    units: dict[str, str],
) -> list[str]:
    """Write all unit files for a training module.

    Args:
        output_dir: Base output directory (e.g., "trainingcontent")
        date_folder: Date folder name (e.g., "April_12_2026")
        module_slug: Module identifier (e.g., "boost-sales-performance")
        units: Dict mapping unit name to markdown content

    Returns:
        List of file paths written
    """
    module_path = create_module_directory(output_dir, date_folder, module_slug)
    written_files = []

    for unit_name, content in sorted(units.items()):
        filepath = write_unit_file(module_path, unit_name, content)
        written_files.append(filepath)

    return written_files
