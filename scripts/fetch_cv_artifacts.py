#!/usr/bin/env python3
"""Fetch the built CV PDFs from Gitea into the Astro public directory."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen


FILES = {
    "krystof-liskovec-cv-devops-en.pdf": Path("public/cv.pdf"),
    "krystof-liskovec-cv-backend-en.pdf": Path("public/cv-backend.pdf"),
}


def main() -> None:
    base_url = os.environ.get("GITEA_PACKAGE_BASE")
    if not base_url:
        host = os.environ["GITEA_PACKAGE_HOST"].rstrip("/")
        owner = os.environ["GITEA_PACKAGE_OWNER"]
        package_name = os.environ.get("GITEA_PACKAGE_NAME", "liskovec-cv")
        base_url = f"{host}/api/packages/{owner}/generic/{package_name}"
    base_url = base_url.rstrip("/")
    version_from_pipeline = os.environ.get("CV_ARTIFACT_VERSION", "").strip("/")
    version = version_from_pipeline or "latest"
    authorization = f'token {os.environ["GITEA_PACKAGE_TOKEN"]}'

    with TemporaryDirectory() as temporary_directory:
        temporary_root = Path(temporary_directory)
        try:
            for filename in FILES:
                request = Request(
                    f"{base_url}/{version}/{filename}",
                    headers={"Authorization": authorization},
                )
                with urlopen(request) as response:
                    (temporary_root / filename).write_bytes(response.read())
        except HTTPError:
            if version_from_pipeline or not all(path.exists() for path in FILES.values()):
                raise
            print(f"CV package {version} is not available; keeping the checked-in fallback.")
            return

        for filename, destination in FILES.items():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((temporary_root / filename).read_bytes())

    print(f"Fetched CV PDFs from {base_url}/{version}/")


if __name__ == "__main__":
    main()
