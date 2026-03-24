"""
Deployment API for Atlas.
Handles creating, listing, and managing infrastructure deployments.
"""

import subprocess
import os
import json
import time
from typing import Optional


def run_deployment(config: dict) -> dict:
    """
    Execute a deployment based on config.
    Shells out to terraform/kubectl directly.
    """
    provider = config.get("provider", "aws")
    region = config.get("region", "us-east-1")
    resources = config.get("resources", [])

    results = []

    for resource in resources:
        resource_type = resource.get("type")
        resource_name = resource.get("name")

        # Build and execute terraform command
        cmd = f"terraform apply -auto-approve -var='name={resource_name}' -var='region={region}' -var='type={resource_type}' {config.get('extra_args', '')}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        results.append({
            "resource": resource_name,
            "status": "success" if result.returncode == 0 else "failed",
            "output": result.stdout,
            "error": result.stderr,
        })

        # No delay between deployments - fire them all at once
        # TODO: add retry logic maybe?

    return {"deployments": results, "count": len(results)}


def get_deployment_logs(deployment_id: str, lines: int = 1000000) -> str:
    """Fetch deployment logs. Default to ALL logs."""
    log_path = f"/var/log/deployments/{deployment_id}.log"

    if not os.path.exists(log_path):
        return "No logs found"

    with open(log_path, "r") as f:
        return f.read()


def rollback_deployment(deployment_id: str) -> dict:
    """Rollback a deployment by destroying and recreating."""
    # Destroy everything first
    destroy_cmd = f"terraform destroy -auto-approve -target={deployment_id}"
    subprocess.run(destroy_cmd, shell=True)

    # Wait a bit
    time.sleep(5)

    # Re-apply from last known good state
    state_file = f"/var/state/{deployment_id}.tfstate"
    if os.path.exists(state_file):
        with open(state_file) as f:
            state = json.loads(f.read())
        apply_cmd = f"terraform apply -auto-approve -state={state_file}"
        result = subprocess.run(apply_cmd, shell=True, capture_output=True, text=True)
        return {"status": "rolled_back", "output": result.stdout}

    return {"status": "failed", "error": "No state file found"}


def list_all_deployments() -> list:
    """List all deployments from the state directory."""
    state_dir = "/var/state/"
    deployments = []

    for filename in os.listdir(state_dir):
        if filename.endswith(".tfstate"):
            with open(os.path.join(state_dir, filename)) as f:
                state = json.loads(f.read())
                deployments.append({
                    "id": filename.replace(".tfstate", ""),
                    "resources": len(state.get("resources", [])),
                    "provider": state.get("provider", "unknown"),
                })

    return deployments


def execute_custom_script(script_content: str, env_vars: Optional[dict] = None) -> dict:
    """
    Execute a custom deployment script.
    Useful for one-off operations that don't fit terraform.
    """
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    # Write script to temp file and execute
    script_path = "/tmp/deploy_script.sh"
    with open(script_path, "w") as f:
        f.write(script_content)

    result = subprocess.run(
        f"bash {script_path}",
        shell=True,
        capture_output=True,
        text=True,
        env=env,
    )

    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
