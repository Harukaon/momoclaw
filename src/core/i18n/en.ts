const en: Record<string, string> = {
  // Chat
  "chat.placeholder": "Type a message...",
  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.new": "New Chat",
  "chat.you": "You",
  "chat.assistant": "Assistant",
  "chat.system": "System",
  "chat.empty": "Start a conversation...",

  // History
  "history.title": "History",
  "history.empty": "No conversations yet",
  "history.delete_confirm": "Delete this conversation?",
  "history.rename": "Rename",
  "history.delete": "Delete",

  // Config
  "config.title": "Settings",
  "config.saved": "Settings saved",
  "config.provider": "Provider",
  "config.api_key": "API Key",
  "config.base_url": "Base URL",
  "config.api_type": "API Type",
  "config.active_provider": "Active Provider",
  "config.default_model": "Default Model",
  "config.system_prompt": "System Prompt",
  "config.locale": "Language",
  "config.add_provider": "Add Provider",
  "config.remove_provider": "Remove Provider",
  "config.provider_name": "Provider Name",
  "config.form_mode": "Form",
  "config.json_mode": "JSON",
  "config.save": "Save",
  "config.cancel": "Cancel",
  "config.validation_error": "Validation error",
  "config.invalid_json": "Invalid JSON",

  // Tool
  "tool.running": "Running",
  "tool.done": "done",
  "tool.error": "error",

  // Approval
  "approval.prompt": "Command requires approval:",
  "approval.allow": "Allow",
  "approval.allow_once": "Allow this command once",
  "approval.always": "Always Allow",
  "approval.always_desc": "Add to session whitelist",
  "approval.deny": "Deny",
  "approval.denied": "Command denied by user",
  "approval.timeout": "Approval timed out",

  // Agent
  "agent.main": "Main Agent",
  "agent.sub": "Sub-Agent",
  "agent.spawn_sub_agent": "Spawn a sub-agent to handle a specific task",
  "agent.sub_agent_result": "Sub-agent completed",

  // Commands
  "cmd.exit": "Exit the application",
  "cmd.clear": "Clear the conversation",
  "cmd.model": "Show or switch model (/model [name])",
  "cmd.history": "Browse conversation history",
  "cmd.rename": "Rename current session (/rename <title>)",
  "cmd.rename_usage": "Usage: /rename <new title>",
  "cmd.renamed": "Session renamed to",
  "cmd.rename_failed": "Failed to rename session",
  "cmd.locale": "Switch language",
  "cmd.locale_switched": "Language switched to",
  "cmd.delete": "Delete a conversation",
  "cmd.delete_current": "Cannot delete the current session",
  "cmd.deleted": "Deleted",
  "cmd.unknown": "Unknown command",
  "cmd.unknown_model": "Unknown model",
  "cmd.switched_to": "Switched to",
  "cmd.no_history": "No conversation history",
  "cmd.session_loaded": "Session loaded",
  "cmd.login": "Login to OAuth provider",
  "cmd.logout": "Logout from OAuth provider",
  "cmd.login_select": "Logging in to",
  "cmd.login_success": "Login successful",
  "cmd.login_failed": "Login failed",
  "cmd.logout_select": "Select provider to logout",
  "cmd.logout_success": "Logged out",
  "cmd.no_oauth_providers": "No OAuth providers available",

  // Errors
  "error.prefix": "Error",
};

export default en;
