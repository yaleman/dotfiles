#!/usr/bin/env python
# Hook to check if an llm is going to use "yaelman" in a path because it's stupid and keeps screwing this up
# https://github.com/anthropics/claude-code/issues/12878 etc

import json
import sys
from typing import Optional, Any, Dict, Literal
from pydantic import BaseModel, Field, field_validator


ALLOWED_HOOK_SPECIFIC_OUTPUT_EVENT_NAMES = {"PostToolUse", "UserPromptSubmit"}


class HookSpecificOutput(BaseModel):
    hook_event_name: str = Field(serialization_alias="hookEventName")
    additional_context: Optional[str] = Field(serialization_alias="additionalContext", default=None)

    @field_validator("hook_event_name")
    def validate_hook_event_name(cls, v: str) -> str:
        if v not in ALLOWED_HOOK_SPECIFIC_OUTPUT_EVENT_NAMES:
            raise ValueError(f"hookEventName must be one of {','.join(ALLOWED_HOOK_SPECIFIC_OUTPUT_EVENT_NAMES)}")
        return v


def test_hook_output_specific_output() -> None:
    import pytest

    hook_specific_output = HookSpecificOutput(hook_event_name="PostToolUse", additional_context="Test context")
    output_json = hook_specific_output.model_dump_json(by_alias=True)
    parsed_output = json.loads(output_json)
    assert parsed_output == {
        "hookEventName": "PostToolUse",
        "additionalContext": "Test context",
    }

    with pytest.raises(ValueError):
        HookSpecificOutput(hook_event_name="InvalidEvent", additional_context=None)


class HookDecision(BaseModel):
    behavior: Literal["allow", "block"]
    updated_input: Optional[Dict[str, str]] = None
    interrupt: Optional[bool] = None
    message: Optional[str] = None


class HookOutput(BaseModel):
    hook_specific_output: Dict[str, Any] = Field(serialization_alias="hookSpecificOutput", default_factory=dict)
    updated_input: Optional[Dict[str, str]] = Field(serialization_alias="updatedInput", default=None)
    system_message: Optional[str] = Field(serialization_alias="systemMessage", default=None)
    decision: Optional[HookDecision] = None

    def block(
        self, message: str, interrupt: Optional[bool] = None, updated_input: Optional[Dict[str, str]] = None
    ) -> None:
        self.decision = HookDecision(
            behavior="block", message=message, interrupt=interrupt, updated_input=updated_input
        )

    def add_system_message(self, message: str) -> None:
        self.system_message = message

    def as_json(self) -> str:
        """Serialize the HookOutput to a JSON string."""
        res = self.model_dump(by_alias=True, exclude_none=True)
        if res.get("hookSpecificOutput") == {}:
            del res["hookSpecificOutput"]
        if res.get("decision") == {}:
            del res["decision"]
        elif res.get("decision") is not None:
            for key, value in res["decision"].items():
                if value is None:
                    del res["decision"][key]
        return json.dumps(res)

    def update_inputs(self, updated_fields: Dict[str, str]) -> None:
        self.updated_input = updated_fields


def test_hook_output() -> None:
    hook_output = HookOutput()
    hook_output.block("Testing block reason")
    output_json = hook_output.as_json()
    print(output_json)
    parsed_output = json.loads(output_json)
    assert parsed_output == {"decision": {"behavior": "block", "message": "Testing block reason"}}


def try_parse_input(data: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(data)  # type: ignore[no-any-return]
    except json.JSONDecodeError:
        return None


def blind_check_input(data: str) -> None:
    for line in data.splitlines():
        if "yaelman" in line:
            print(
                f"Error: Detected usage of 'yaelman' in the path ({line}). NEVER use 'yaelman' in paths. You should use 'yaleman' instead: '{line.replace('yaelman', 'yaleman')}'",
                file=sys.stderr,
            )
            sys.exit(2)


def parse_json(inputdata: Dict[str, Any]) -> str:
    # we can do fancy JSON responses - https://code.claude.com/docs/en/hooks#advanced:-json-output
    update_fields = {}
    for field, value in inputdata.get("tool_input", {}).items():
        if isinstance(value, str) and "yaelman" in value:
            update_fields[field] = value.replace("yaelman", "yaleman")
    if update_fields:
        hook_output = HookOutput()
        if inputdata.get("hook_event_name") == "PreToolUse":
            hook_output.update_inputs(update_fields)
        hook_output.add_system_message("Corrected 'yaelman' to 'yaleman' in the tool input paths.")
    return hook_output.as_json()


def test_parse_json() -> None:
    inputdata = {
        "hook_event_name": "PreToolUse",
        "tool_input": {
            "path": "/usr/local/yaelman/bin",
            "other_field": "no change here",
        },
    }
    res = parse_json(inputdata)
    assert (
        res
        == HookOutput(
            updated_input={"path": "/usr/local/yaleman/bin"},
            system_message="Corrected 'yaelman' to 'yaleman' in the tool input paths.",
        ).as_json()
    )


if __name__ == "__main__":
    stdin = sys.stdin.read()
    inputdata = try_parse_input(stdin)
    if inputdata is None:
        blind_check_input(stdin)

    else:
        parse_json(inputdata)
