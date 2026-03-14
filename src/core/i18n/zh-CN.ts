const zhCN: Record<string, string> = {
  // Chat
  "chat.placeholder": "输入消息...",
  "chat.send": "发送",
  "chat.stop": "停止",
  "chat.new": "新对话",
  "chat.you": "你",
  "chat.assistant": "助手",
  "chat.system": "系统",
  "chat.empty": "开始一段对话...",

  // History
  "history.title": "历史记录",
  "history.empty": "还没有对话",
  "history.delete_confirm": "删除此对话？",
  "history.rename": "重命名",
  "history.delete": "删除",

  // Config
  "config.title": "设置",
  "config.saved": "设置已保存",
  "config.provider": "服务商",
  "config.api_key": "API 密钥",
  "config.base_url": "接口地址",
  "config.api_type": "API 类型",
  "config.active_provider": "当前服务商",
  "config.default_model": "默认模型",
  "config.system_prompt": "系统提示词",
  "config.locale": "语言",
  "config.add_provider": "添加服务商",
  "config.remove_provider": "删除服务商",
  "config.provider_name": "服务商名称",
  "config.form_mode": "表单",
  "config.json_mode": "JSON",
  "config.save": "保存",
  "config.cancel": "取消",
  "config.validation_error": "验证错误",
  "config.invalid_json": "无效的 JSON",

  // Tool
  "tool.running": "运行中",
  "tool.done": "完成",
  "tool.error": "错误",

  // Approval
  "approval.prompt": "命令需要批准：",
  "approval.allow": "允许",
  "approval.allow_once": "允许执行此命令",
  "approval.always": "始终允许",
  "approval.always_desc": "加入会话白名单",
  "approval.deny": "拒绝",
  "approval.denied": "命令已被用户拒绝",
  "approval.timeout": "审批超时",

  // Agent
  "agent.main": "主代理",
  "agent.sub": "子代理",
  "agent.spawn_sub_agent": "派生子代理来处理特定任务",
  "agent.sub_agent_result": "子代理已完成",

  // Commands
  "cmd.exit": "退出应用",
  "cmd.clear": "清空对话",
  "cmd.model": "查看或切换模型 (/model [名称])",
  "cmd.history": "浏览对话历史",
  "cmd.rename": "重命名当前会话 (/rename <标题>)",
  "cmd.rename_usage": "用法：/rename <新标题>",
  "cmd.renamed": "会话已重命名为",
  "cmd.rename_failed": "重命名失败",
  "cmd.locale": "切换语言",
  "cmd.locale_switched": "语言已切换为",
  "cmd.delete": "删除对话",
  "cmd.delete_current": "不能删除当前会话",
  "cmd.deleted": "已删除",
  "cmd.unknown": "未知命令",
  "cmd.unknown_model": "未知模型",
  "cmd.switched_to": "已切换到",
  "cmd.no_history": "没有对话历史",
  "cmd.session_loaded": "会话已加载",
  "cmd.login": "登录 OAuth 服务商",
  "cmd.logout": "登出 OAuth 服务商",
  "cmd.login_select": "正在登录",
  "cmd.login_success": "登录成功",
  "cmd.login_failed": "登录失败",
  "cmd.logout_select": "选择要登出的服务商",
  "cmd.logout_success": "已登出",
  "cmd.no_oauth_providers": "没有可用的 OAuth 服务商",
  "cmd.new": "归档记忆，开始新对话",
  "cmd.new_done": "开始新对话",
  "cmd.memory_archived": "记忆已归档",

  // Errors
  "error.prefix": "错误",
};

export default zhCN;
