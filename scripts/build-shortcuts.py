#!/usr/bin/env python3
"""
build-shortcuts.py — Generate the "Save Web Page to Open Brain" iOS Shortcut.

Output: scripts/shortcuts/Save Web Page to Open Brain.shortcut (binary plist)

To install on iPhone:
  1. python3 scripts/build-shortcuts.py
  2. cd scripts/shortcuts && python3 -m http.server 8765
  3. On iPhone (same Wi-Fi): open Safari and go to
       shortcuts://import-shortcut?url=http%3A%2F%2F<mac-ip>%3A8765%2FSave%2520Web%2520Page%2520to%2520Open%2520Brain.shortcut&name=Save%20Web%20Page%20to%20Open%20Brain
  4. Tap "Add Shortcut"
"""

import plistlib
import pathlib

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def text_token(string: str, attachments: dict | None = None) -> dict:
    """Build a WFTextTokenString value dict."""
    return {
        "WFSerializationType": "WFTextTokenString",
        "Value": {
            "string": string,
            "attachmentsByRange": attachments or {},
        },
    }


def var_ref(var_name: str) -> dict:
    """Single-variable token (the lone object-replacement character ￼)."""
    return text_token(
        "\ufffc",
        {"{0, 1}": {"Type": "Variable", "VariableName": var_name}},
    )


def action(identifier: str, params: dict) -> dict:
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": params,
    }


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

actions = [
    # 1. Ask for Input → User Comment
    action("is.workflow.actions.ask", {
        "WFInputType": "Text",
        "WFAskActionPrompt": "Add a comment (optional)",
        "WFAskActionDefaultAnswer": "",
        "WFVariableOutputName": "User Comment",
    }),

    # 2. Get Text from Input (processes share sheet URL) → Page URL
    action("is.workflow.actions.gettext", {
        "WFInput": {
            "WFSerializationType": "WFTextTokenAttachment",
            "Value": {
                "Type": "ExtensionInput",
                "OutputUUID": "",
            },
        },
        "WFVariableOutputName": "Page URL",
    }),

    # 3. Get Article from Web Page (using Page URL) → Article
    action("is.workflow.actions.getarticlefromwebpage", {
        "WFInput": var_ref("Page URL"),
        "WFVariableOutputName": "Article",
    }),

    # 4. Get Details of Articles — Body Text → Article Body
    action("is.workflow.actions.properties.articles", {
        "WFContentItemPropertyName": "Body Text",
        "WFInput": var_ref("Article"),
        "WFVariableOutputName": "Article Body",
    }),

    # 5. Text — combine comment + URL + body → Full Content
    action("is.workflow.actions.text", {
        "WFTextActionText": text_token(
            "\ufffc\n\n\ufffc\n\n\ufffc",
            {
                "{0, 1}":  {"Type": "Variable", "VariableName": "User Comment"},
                "{3, 1}":  {"Type": "Variable", "VariableName": "Page URL"},
                "{6, 1}":  {"Type": "Variable", "VariableName": "Article Body"},
            },
        ),
        "WFVariableOutputName": "Full Content",
    }),

    # 6. Text — build Auth Header
    action("is.workflow.actions.text", {
        "WFTextActionText": text_token(
            "Bearer 577b8d8dd64f96c9d0bb986382c30139ea24ab901265dc1d383af3a738feb3b6",
        ),
        "WFVariableOutputName": "Auth Header",
    }),

    # 7. Get Contents of URL — POST Form to /capture
    action("is.workflow.actions.downloadurl", {
        "WFURL": "https://open-brain-cloud.fly.dev/capture",
        "WFHTTPMethod": "POST",
        "WFHTTPBodyType": "Form",
        "WFFormValues": {
            "WFSerializationType": "WFDictionaryFieldValue",
            "Value": {
                "WFDictionaryFieldValueItems": [
                    {
                        "WFItemType": 0,
                        "WFKey": text_token("content"),
                        "WFValue": var_ref("Full Content"),
                    },
                    {
                        "WFItemType": 0,
                        "WFKey": text_token("source"),
                        "WFValue": text_token("ios-shortcut-web"),
                    },
                ],
            },
        },
        "WFHTTPHeaders": {
            "WFSerializationType": "WFDictionaryFieldValue",
            "Value": {
                "WFDictionaryFieldValueItems": [
                    {
                        "WFItemType": 0,
                        "WFKey": text_token("Authorization"),
                        "WFValue": var_ref("Auth Header"),
                    },
                ],
            },
        },
    }),

    # 8. Show Notification
    action("is.workflow.actions.notification", {
        "WFNotificationActionTitle": "Open Brain",
        "WFNotificationActionBody": "Web page saved",
    }),
]

# ---------------------------------------------------------------------------
# Top-level shortcut plist
# ---------------------------------------------------------------------------

shortcut = {
    "WFWorkflowClientVersion": "1140.0.3",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {
        "WFWorkflowIconStartColor": 431817727,
        "WFWorkflowIconGlyphNumber": 59511,
    },
    "WFWorkflowInputContentItemClasses": [
        "WFURLContentItem",
        "WFWebPageContentItem",
    ],
    "WFWorkflowActions": actions,
    "WFWorkflowTypes": ["NCWidget", "WatchKit"],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowHasShortcutInputVariables": True,
}

# ---------------------------------------------------------------------------
# Write binary plist
# ---------------------------------------------------------------------------

out_dir = pathlib.Path(__file__).parent / "shortcuts"
out_dir.mkdir(parents=True, exist_ok=True)
out_path = out_dir / "Save Web Page to Open Brain.shortcut"

with open(out_path, "wb") as f:
    plistlib.dump(shortcut, f, fmt=plistlib.FMT_BINARY)

print(f"Written: {out_path}")
print()
print("--- Install instructions ---")
print("1. cd scripts/shortcuts && python3 -m http.server 8765")
print("2. Find your Mac IP: ipconfig getifaddr en0")
print("3. On iPhone Safari, open:")
print("   shortcuts://import-shortcut?url=http%3A%2F%2F<mac-ip>%3A8765%2FSave%2520Web%2520Page%2520to%2520Open%2520Brain.shortcut&name=Save%20Web%20Page%20to%20Open%20Brain")
print("4. Tap 'Add Shortcut'")
print()
print("--- Optional: sign with shortcuts CLI ---")
print('  shortcuts sign --input "scripts/shortcuts/Save Web Page to Open Brain.shortcut" \\')
print('                 --output "scripts/shortcuts/Save Web Page to Open Brain.shortcut" \\')
print('                 --mode anyone')
