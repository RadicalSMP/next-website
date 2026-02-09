"use client"

import { LogOut, User, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "@/lib/auth-client"

interface UserAvatarProps {
  className?: string
  size?: "default" | "sm" | "lg"
}

export function UserAvatar({ className, size = "default" }: UserAvatarProps) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/sign-in")
          },
        },
      })
    } catch (error) {
      console.error("退出登录失败:", error)
    }
  }

  const handleSignIn = () => {
    router.push("/sign-in")
  }

  // 如果正在加载，不显示任何内容
  if (isPending) {
    return null
  }

  // 如果未登录，显示登录按钮
  if (!session?.user) {
    return (
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleSignIn}
        className={className}
      >
        登录
      </Button>
    )
  }

  const user = session.user
  
  // 生成用户名首字母作为头像 fallback
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return "U"
  }

  const initials = getInitials(user.name, user.email)
  const displayName = user.name || user.email || "用户"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar size={size} className={className}>
            <AvatarImage 
              src={user.image || undefined} 
              alt={displayName}
            />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>个人资料</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          variant="destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}