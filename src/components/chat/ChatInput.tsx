import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  MicIcon,
  ImageIcon,
  FileIcon,
  LinkIcon,
  StopCircleIcon,
  XIcon,
  VideoIcon,
  AlertCircle,
} from "lucide-react";
import { Attachment } from "@/types/chat";
import { useToast } from "@/components/ui/use-toast";
import logger from "@/utils/logger";

interface ChatInputProps {
  onSendMessage?: (message: string, attachments?: Attachment[]) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  allowAttachments?: boolean;
  allowVoice?: boolean;
  allowEmoji?: boolean;
  primaryColor?: string;
  maxAttachmentSize?: number; // in MB
  maxAttachments?: number;
  maxMessageLength?: number;
}

// Common emoji groups for quick selection
const EMOJI_GROUPS = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇"],
  },
  {
    name: "Gestures",
    emojis: ["👍", "👎", "👌", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✌️"],
  },
  {
    name: "Love",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "❣️", "💕", "💞"],
  },
  {
    name: "Common",
    emojis: ["👋", "👍", "👎", "👏", "🙏", "🔥", "❤️", "😊", "👀", "✅"],
  },
];

// Supported file types and their configurations
const FILE_TYPES = {
  image: {
    accept: "image/*",
    icon: <ImageIcon className="h-4 w-4 mr-2" />,
    label: "Image",
  },
  document: {
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
    icon: <FileIcon className="h-4 w-4 mr-2" />,
    label: "Document",
  },
  video: {
    accept: "video/*",
    icon: <VideoIcon className="h-4 w-4 mr-2" />,
    label: "Video",
  },
  audio: {
    accept: "audio/*",
    icon: <MicIcon className="h-4 w-4 mr-2" />,
    label: "Audio",
  },
};

/**
 * ChatInput Component
 *
 * A comprehensive input component for chat interfaces with support for:
 * - Text messages
 * - File attachments (images, documents, videos, audio)
 * - Voice recording
 * - Emoji selection
 * - Typing indicators
 */
const ChatInput = ({
  onSendMessage = () => {},
  onTypingStart = () => {},
  onTypingStop = () => {},
  placeholder = "Type your message here...",
  disabled = false,
  allowAttachments = true,
  allowVoice = true,
  allowEmoji = true,
  primaryColor,
  maxAttachmentSize = 10, // 10MB default
  maxAttachments = 5,
  maxMessageLength = 2000, // Reasonable limit for most chat systems
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>(
    "image/*,audio/*,video/*,application/*",
  );

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle typing indicator with debounce
  useEffect(() => {
    if (message.trim() && !typingTimeout) {
      onTypingStart();
      const timeout = setTimeout(() => {
        onTypingStop();
        setTypingTimeout(null);
      }, 3000);
      setTypingTimeout(timeout);
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [message, onTypingStart, onTypingStop]);

  // Handle recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current && !disabled && !isRecording) {
      inputRef.current.focus();
    }
  }, [disabled, isRecording]);

  // Handle message submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (
        (message.trim() || attachments.length > 0) &&
        !disabled &&
        !isUploading
      ) {
        try {
          onSendMessage(
            message,
            attachments.length > 0 ? attachments : undefined,
          );
          setMessage("");
          setAttachments([]);
          if (typingTimeout) {
            clearTimeout(typingTimeout);
            setTypingTimeout(null);
            onTypingStop();
          }
          // Focus the input after sending
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        } catch (error) {
          logger.error("Error sending message:", error);
          toast({
            title: "Error",
            description: "Failed to send message. Please try again.",
            variant: "destructive",
          });
        }
      }
    },
    [
      message,
      attachments,
      disabled,
      isUploading,
      onSendMessage,
      onTypingStop,
      toast,
      typingTimeout,
    ],
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Send message on Enter (without shift for new line)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit],
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Check if adding these files would exceed the max attachments limit
      if (attachments.length + files.length > maxAttachments) {
        toast({
          title: "Attachment limit exceeded",
          description: `You can only attach up to ${maxAttachments} files.`,
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      const newAttachments: Attachment[] = [];
      const filePromises: Promise<void>[] = [];

      Array.from(files).forEach((file) => {
        // Check file size
        if (file.size > maxAttachmentSize * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum size of ${maxAttachmentSize}MB.`,
            variant: "destructive",
          });
          return;
        }

        const filePromise = new Promise<void>((resolve) => {
          const fileType = file.type.split("/")[0];
          const newAttachment: Attachment = {
            id: `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type:
              fileType === "image"
                ? "image"
                : fileType === "audio"
                  ? "audio"
                  : fileType === "video"
                    ? "video"
                    : "file",
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
            mimeType: file.type,
          };

          newAttachments.push(newAttachment);
          resolve();
        });

        filePromises.push(filePromise);
      });

      Promise.all(filePromises)
        .then(() => {
          setAttachments((prev) => [...prev, ...newAttachments]);
          // Reset the input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        })
        .catch((error) => {
          logger.error("Error processing files:", error);
          toast({
            title: "Error",
            description: "Failed to process attachments. Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => {
          setIsUploading(false);
        });
    },
    [attachments.length, maxAttachments, maxAttachmentSize, toast],
  );

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      setMessage((prev) => {
        // Check if adding the emoji would exceed the max message length
        if (prev.length + emoji.length > maxMessageLength) {
          toast({
            title: "Message too long",
            description: `Message cannot exceed ${maxMessageLength} characters.`,
            variant: "destructive",
          });
          return prev;
        }
        return prev + emoji;
      });
      // Focus the input after selecting an emoji
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    },
    [maxMessageLength, toast],
  );

  // Handle message input change
  const handleMessageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxMessageLength) {
        setMessage(newValue);
      } else {
        setMessage(newValue.substring(0, maxMessageLength));
        toast({
          title: "Message too long",
          description: `Message cannot exceed ${maxMessageLength} characters.`,
          variant: "destructive",
        });
      }
    },
    [maxMessageLength, toast],
  );

  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio recording");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });

          // Check if recording is too short (less than 0.5 seconds)
          if (recordingTime < 0.5) {
            toast({
              title: "Recording too short",
              description: "Voice message is too short to send.",
              variant: "warning",
            });
            setIsRecording(false);
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          // Check if recording exceeds size limit
          if (audioBlob.size > maxAttachmentSize * 1024 * 1024) {
            toast({
              title: "Recording too large",
              description: `Voice message exceeds the maximum size of ${maxAttachmentSize}MB.`,
              variant: "destructive",
            });
            setIsRecording(false);
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          const audioUrl = URL.createObjectURL(audioBlob);
          const newAttachment: Attachment = {
            id: `voice-${Date.now()}`,
            type: "audio",
            url: audioUrl,
            name: `Voice message (${formatTime(recordingTime)})`,
            size: audioBlob.size,
            mimeType: "audio/wav",
          };

          setAttachments((prev) => [...prev, newAttachment]);
          setIsRecording(false);

          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());
        } catch (error) {
          logger.error("Error processing voice recording:", error);
          toast({
            title: "Recording failed",
            description: "Failed to process voice recording.",
            variant: "destructive",
          });
          setIsRecording(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      // Set data available event to fire every second
      mediaRecorder.start(1000);
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: "Your voice is being recorded. Click stop when finished.",
        duration: 3000,
      });
    } catch (error) {
      logger.error("Error accessing microphone:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice messages.",
        variant: "destructive",
      });
    }
  }, [maxAttachmentSize, recordingTime, toast]);

  // Stop voice recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        logger.error("Error stopping recording:", error);
        toast({
          title: "Error",
          description: "Failed to stop recording. Please try again.",
          variant: "destructive",
        });
        setIsRecording(false);
      }
    }
  }, [isRecording, toast]);

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment && attachment.url) {
        // Revoke object URL to prevent memory leaks
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter((attachment) => attachment.id !== id);
    });
  }, []);

  // Format recording time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Handle adding a link attachment
  const handleAddLink = useCallback(() => {
    try {
      const url = prompt("Enter link URL:");
      if (!url || !url.trim()) return;

      // Basic URL validation
      let validUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        validUrl = `https://${url}`;
      }

      try {
        // Check if URL is valid
        new URL(validUrl);
      } catch (e) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL.",
          variant: "destructive",
        });
        return;
      }

      const newAttachment: Attachment = {
        id: `link-${Date.now()}`,
        type: "link",
        url: validUrl,
        name: url,
      };

      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      logger.error("Error adding link:", error);
      toast({
        title: "Error",
        description: "Failed to add link. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Set file type filter for the file input
  const setFileType = useCallback((type: keyof typeof FILE_TYPES) => {
    setFileTypeFilter(FILE_TYPES[type].accept);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }, []);

  return (
    <div className="bg-white border-t border-gray-200 p-3 flex flex-col gap-2">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative group">
              {attachment.type === "image" ? (
                <div className="w-16 h-16 rounded overflow-hidden">
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : attachment.type === "audio" ? (
                <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded">
                  <audio src={attachment.url} controls className="w-14 h-10" />
                </div>
              ) : attachment.type === "video" ? (
                <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded">
                  <VideoIcon className="h-8 w-8 text-purple-500" />
                </div>
              ) : attachment.type === "link" ? (
                <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded">
                  <LinkIcon className="h-8 w-8 text-green-500" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded">
                  <FileIcon className="h-8 w-8 text-gray-500" />
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(attachment.id)}
              >
                <XIcon className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs truncate px-1">
                {attachment.name && attachment.name.length > 10
                  ? `${attachment.name.substring(0, 8)}...`
                  : attachment.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Voice recording UI */}
      {isRecording && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 rounded-md">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-sm">
            Recording... {formatTime(recordingTime)}
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="ml-auto"
            onClick={stopRecording}
          >
            <StopCircleIcon className="h-4 w-4 mr-1" />
            Stop
          </Button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
        {allowAttachments && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700"
                disabled={disabled || isRecording || isUploading}
                aria-label="Add attachment"
              >
                <PaperclipIcon className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept={fileTypeFilter}
                  aria-label="File upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex justify-start"
                  onClick={() => setFileType("image")}
                  disabled={isUploading}
                >
                  {FILE_TYPES.image.icon}
                  {FILE_TYPES.image.label}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex justify-start"
                  onClick={() => setFileType("document")}
                  disabled={isUploading}
                >
                  {FILE_TYPES.document.icon}
                  {FILE_TYPES.document.label}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex justify-start"
                  onClick={() => setFileType("video")}
                  disabled={isUploading}
                >
                  {FILE_TYPES.video.icon}
                  {FILE_TYPES.video.label}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex justify-start"
                  onClick={handleAddLink}
                  disabled={isUploading}
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Input
          type="text"
          placeholder={
            isRecording
              ? "Recording voice message..."
              : isUploading
                ? "Uploading..."
                : placeholder
          }
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-full"
          disabled={disabled || isRecording || isUploading}
          maxLength={maxMessageLength}
          ref={inputRef}
          aria-label="Message input"
        />

        {allowEmoji && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700"
                disabled={disabled || isRecording || isUploading}
                aria-label="Add emoji"
              >
                <SmileIcon className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="flex flex-col gap-2">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.name}>
                    <h4 className="text-xs font-medium mb-1">{group.name}</h4>
                    <div className="flex flex-wrap gap-1">
                      {group.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                          onClick={() => handleEmojiSelect(emoji)}
                          aria-label={`Emoji ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {allowVoice && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`${isRecording ? "text-red-500" : "text-gray-500 hover:text-gray-700"}`}
                  disabled={disabled || isUploading}
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={
                    isRecording ? "Stop recording" : "Start voice recording"
                  }
                >
                  <MicIcon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRecording ? "Stop recording" : "Voice message"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="primary"
                size="icon"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full"
                style={
                  primaryColor ? { backgroundColor: primaryColor } : undefined
                }
                disabled={
                  disabled ||
                  isRecording ||
                  isUploading ||
                  (!message.trim() && attachments.length === 0)
                }
                aria-label="Send message"
              >
                <SendIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Send message</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>

      {/* Character count indicator when approaching limit */}
      {message.length > maxMessageLength * 0.8 && (
        <div className="flex items-center justify-end text-xs">
          <span
            className={
              message.length > maxMessageLength * 0.9
                ? "text-red-500"
                : "text-gray-500"
            }
          >
            {message.length}/{maxMessageLength}
          </span>
        </div>
      )}

      {/* Upload status indicator */}
      {isUploading && (
        <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span>Uploading attachments...</span>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
