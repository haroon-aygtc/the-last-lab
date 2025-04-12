import React from "react";
import { CheckCheck, Clock, AlertCircle } from "lucide-react";
import { MessageStatus as StatusType } from "@/types/chat";
import { cn } from "@/lib/utils";

interface MessageStatusProps {
  status: StatusType;
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

/**
 * MessageStatus Component
 *
 * A reusable component that displays the status of a message (sending, sent, delivered, read, error)
 * with appropriate icons and optional text labels.
 */
const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  className,
  size = "sm",
  showText = false,
}) => {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const getStatusContent = () => {
    switch (status) {
      case "sending":
        return {
          icon: <Clock className={cn(sizeClasses[size], "text-gray-400")} />,
          text: "Sending",
          className: "text-gray-400",
        };
      case "sent":
        return {
          icon: (
            <CheckCheck className={cn(sizeClasses[size], "text-gray-400")} />
          ),
          text: "Sent",
          className: "text-gray-400",
        };
      case "delivered":
        return {
          icon: (
            <CheckCheck className={cn(sizeClasses[size], "text-gray-400")} />
          ),
          text: "Delivered",
          className: "text-gray-400",
        };
      case "read":
        return {
          icon: (
            <CheckCheck className={cn(sizeClasses[size], "text-blue-500")} />
          ),
          text: "Read",
          className: "text-blue-500",
        };
      case "error":
        return {
          icon: (
            <AlertCircle className={cn(sizeClasses[size], "text-red-500")} />
          ),
          text: "Failed",
          className: "text-red-500",
        };
      default:
        return {
          icon: <Clock className={cn(sizeClasses[size], "text-gray-400")} />,
          text: "Pending",
          className: "text-gray-400",
        };
    }
  };

  const { icon, text, className: statusClassName } = getStatusContent();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {icon}
      {showText && (
        <span className={cn("text-xs", statusClassName)}>{text}</span>
      )}
    </div>
  );
};

export default MessageStatus;
