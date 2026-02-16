import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将 better-auth 返回的英文错误消息翻译为中文。
 * 若无匹配则原样返回。
 */
const ERROR_MESSAGES_ZH: Record<string, string> = {
  // 登录
  "Invalid email or password": "邮箱或密码错误",
  "Invalid email": "邮箱格式无效",
  "Invalid password": "密码无效",
  "Email not verified": "邮箱未验证",
  "Email and password is not enabled": "邮箱密码登录未启用",
  "Failed to create session": "创建会话失败，请重试",

  // 注册
  "User already exists.": "该用户已存在",
  "User already exists. Use another email.": "该邮箱已被注册，请使用其他邮箱",
  "Password too short": "密码过短",
  "Password too long": "密码过长",
  "Failed to create user": "创建用户失败，请重试",
  "Email and password sign up is not enabled": "邮箱密码注册未启用",

  // 密码重置
  "Invalid token": "链接无效或已过期",
  "Reset password isn't enabled": "重置密码功能未启用",

  // 通用
  "Too many requests. Please try again later.": "请求过于频繁，请稍后再试",
  "User not found": "用户不存在",
  "Session expired. Re-authenticate to perform this action.": "会话已过期，请重新登录",
  "Credential account not found": "未找到凭证账户",
  "Email can not be updated": "邮箱无法修改",
  "Email is already verified": "邮箱已验证",
  "Email mismatch": "邮箱不匹配",
  "Session is not fresh": "会话不是最新的，请重新登录",
  "Missing or null Origin": "请求来源缺失",
  "Invalid origin": "请求来源无效",

  // 管理员
  "You cannot ban yourself": "不能封禁自己",
  "You cannot remove yourself": "不能删除自己",
  "You have been banned from this application": "您已被封禁",
}

export function translateErrorMessage(message: string): string {
  return ERROR_MESSAGES_ZH[message] ?? message
}
