import React from "react";
import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  className?: string;
  variant?: "primary" | "secondary" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

/**
 * NotificationBadge Component
 *
 * A reusable notification badge component that displays a count with customizable appearance.
 * Used for showing unread message counts, notification counts, etc.
 */
const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  className,
  variant = "primary",
  size = "md",
  onClick,
}) => {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const variantClasses = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "bg-transparent border border-primary text-primary",
  };

  const sizeClasses = {
    sm: "h-4 min-w-4 text-[10px] px-1",
    md: "h-5 min-w-5 text-xs px-1",
    lg: "h-6 min-w-6 text-sm px-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium",
        variantClasses[variant],
        sizeClasses[size],
        onClick ? "cursor-pointer" : "",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {displayCount}
    </span>
  );
};

export default NotificationBadge;
