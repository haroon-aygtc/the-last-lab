import React from "react";
import {
  X,
  Minus,
  MessageCircle,
  Info,
  Settings,
  Phone,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type UserStatus = "online" | "away" | "offline" | "busy";

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  status?: UserStatus;
  logoUrl?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onInfo?: () => void;
  onSettings?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  primaryColor?: string;
  showControls?: boolean;
  showCallOptions?: boolean;
  avatarUrl?: string;
}

const ChatHeader = ({
  title = "AI Assistant",
  subtitle,
  status = "online",
  logoUrl,
  onClose = () => {},
  onMinimize = () => {},
  onInfo,
  onSettings,
  onVoiceCall,
  onVideoCall,
  primaryColor,
  showControls = true,
  showCallOptions = false,
  avatarUrl,
}: ChatHeaderProps) => {
  // Map status to appropriate colors and text
  const statusConfig = {
    online: { color: "bg-green-400", text: "Online" },
    away: { color: "bg-yellow-400", text: "Away" },
    offline: { color: "bg-gray-400", text: "Offline" },
    busy: { color: "bg-red-400", text: "Busy" },
  };

  const { color, text } = statusConfig[status];

  return (
    <div
      className="flex items-center justify-between p-3 bg-primary text-primary-foreground rounded-t-lg"
      style={primaryColor ? { backgroundColor: primaryColor } : undefined}
    >
      <div className="flex items-center space-x-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-6 w-6 rounded-full" />
        ) : (
          <MessageCircle size={20} />
        )}
        <div className="flex flex-col">
          <h3 className="font-medium text-sm">{title}</h3>
          {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
        </div>
        <div className="flex items-center ml-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("w-2 h-2 rounded-full", color)} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{text}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs ml-1">{text}</span>
        </div>
      </div>
      {showControls && (
        <div className="flex items-center space-x-1">
          {showCallOptions && onVoiceCall && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={onVoiceCall}
                    aria-label="Voice call"
                  >
                    <Phone size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voice call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {showCallOptions && onVideoCall && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={onVideoCall}
                    aria-label="Video call"
                  >
                    <Video size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Video call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={onInfo}
                    aria-label="Chat information"
                  >
                    <Info size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat information</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onSettings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                    onClick={onSettings}
                    aria-label="Chat settings"
                  >
                    <Settings size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chat settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                  onClick={onMinimize}
                  aria-label="Minimize chat"
                >
                  <Minus size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Minimize</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary-foreground/20 text-primary-foreground"
                  onClick={onClose}
                  aria-label="Close chat"
                >
                  <X size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Close</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
