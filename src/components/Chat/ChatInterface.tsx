import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, X, PlusCircle, Key, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import ChatMessage, { ChatMessageProps } from "./ChatMessage";
import { 
  getAIResponse, 
  validateApiKey, 
  getApiKey, 
  isApiKeyValidated,
  fetchApiKeyFromFirestore 
} from "@/utils/openaiUtils";
import { toast } from "sonner";
import ChatHistory, { ChatConversation } from "./ChatHistory";
import ApiKeyDialog from "./ApiKeyDialog";
import { v4 as uuidv4 } from 'uuid';
import { isExtensionContext, saveToLocalStorage, getFromLocalStorage, listenForStateChanges } from "@/utils/chromeUtils";
import { checkOpenAIApiKeyInFirestore, getOpenAIApiKeyFromFirestore } from "@/utils/firebaseAdmin";

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "focusflow_chat_conversations";

const getInitialWelcomeMessage = (): ChatMessageProps => ({
  role: "assistant",
  content: "Hi there! I'm your AI assistant. How can I help you today?",
  timestamp: new Date(),
});

const getChatTitle = (content: string): string => {
  const maxLength = 30;
  const title = content.length > maxLength
    ? content.substring(0, maxLength) + "..."
    : content;
  return title;
};

let cachedApiKey: string | null = null;

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  isOpen, 
  onClose
}) => {
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [isUsingFirebaseKey, setIsUsingFirebaseKey] = useState(false);
  const [firebaseKeyAvailable, setFirebaseKeyAvailable] = useState(false);
  const [firebaseKeyLoading, setFirebaseKeyLoading] = useState(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [keyCheckAttempts, setKeyCheckAttempts] = useState(0);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeFirebaseKey = async () => {
      try {
        setFirebaseKeyLoading(true);
        setApiKeyError(null);
        
        const key = await getOpenAIApiKeyFromFirestore();
        
        if (key) {
          console.log("Successfully retrieved API key from Firebase");
          setFirebaseKeyAvailable(true);
          setIsUsingFirebaseKey(true);
          setApiKeyError(null);
          setKeyCheckAttempts(0);
          
          cachedApiKey = key;
        } else {
          const keyExists = await checkOpenAIApiKeyInFirestore();
          
          if (keyExists) {
            setApiKeyError("Firebase key exists but couldn't be retrieved. Check Firebase security rules.");
            console.error("Firebase key exists but couldn't be retrieved");
            setKeyCheckAttempts(prev => prev + 1);
          } else {
            setApiKeyError("No API key found in Firebase. Please set up your API key.");
            console.log("No API key found in Firebase");
          }
          
          setFirebaseKeyAvailable(false);
          setIsUsingFirebaseKey(false);
        }
      } catch (error) {
        console.error("Error checking Firebase API key:", error);
        setFirebaseKeyAvailable(false);
        setIsUsingFirebaseKey(false);
        setApiKeyError("Error checking Firebase API key: " + String(error));
        setKeyCheckAttempts(prev => prev + 1);
      } finally {
        setFirebaseKeyLoading(false);
      }
    };

    initializeFirebaseKey();
    
    const intervalId = setInterval(() => {
      if (keyCheckAttempts < 5) {
        initializeFirebaseKey();
      } else {
        if (Math.random() < 0.2) {
          initializeFirebaseKey();
        }
      }
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [keyCheckAttempts]);

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        await validateApiKey();
      } catch (error) {
        console.log("Error checking API status:", error);
      }
    };
    
    checkApiStatus();
  }, []);

  useEffect(() => {
    const loadStoredConversations = async () => {
      try {
        if (isExtensionContext()) {
          const storedConversations = await getFromLocalStorage<ChatConversation[]>(STORAGE_KEY);
          if (storedConversations && storedConversations.length > 0) {
            const parsedConversations = storedConversations.map((conv: any) => ({
              ...conv,
              createdAt: new Date(conv.createdAt),
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
            
            setConversations(parsedConversations);
            setActiveConversationId(parsedConversations[0].id);
            return;
          }
        }
        
        const storedConversations = localStorage.getItem(STORAGE_KEY);
        if (storedConversations) {
          try {
            const parsedConversations = JSON.parse(storedConversations);
            const conversations = parsedConversations.map((conv: any) => ({
              ...conv,
              createdAt: new Date(conv.createdAt),
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));
            
            setConversations(conversations);
            
            if (conversations.length > 0) {
              setActiveConversationId(conversations[0].id);
            }
          } catch (e) {
            console.error("Error parsing stored conversations:", e);
          }
        }
      } catch (error) {
        console.error("Error loading conversations:", error);
      }
    };
    
    loadStoredConversations();
  }, []);

  useEffect(() => {
    const unsubscribe = listenForStateChanges((key, value) => {
      if (key === STORAGE_KEY && value) {
        const syncedConversations = value.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        
        setConversations(syncedConversations);
        
        if (activeConversationId && !syncedConversations.find(c => c.id === activeConversationId)) {
          setActiveConversationId(syncedConversations.length > 0 ? syncedConversations[0].id : null);
        }
      }
    });
    
    return unsubscribe;
  }, [activeConversationId]);

  useEffect(() => {
    if (conversations.length > 0) {
      if (isExtensionContext()) {
        saveToLocalStorage(STORAGE_KEY, conversations);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      }
    }
  }, [conversations]);

  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  }, [conversations.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen, activeConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const createNewConversation = () => {
    const newId = uuidv4();
    const newConversation: ChatConversation = {
      id: newId,
      title: "New Conversation",
      messages: [getInitialWelcomeMessage()],
      createdAt: new Date()
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newId);
    setInput("");
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    
    if (id === activeConversationId) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        createNewConversation();
      }
    }
  };

  const updateConversationTitle = (id: string, content: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === id 
          ? { ...conv, title: getChatTitle(content) } 
          : conv
      )
    );
  };

  const updateConversationMessages = (id: string, newMessages: ChatMessageProps[]) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === id 
          ? { ...conv, messages: newMessages } 
          : conv
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!activeConversationId) {
      createNewConversation();
    }

    const userMessage: ChatMessageProps = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const currentMessages = activeConversation?.messages || [];
    if (currentMessages.length === 1 && currentMessages[0].role === "assistant") {
      updateConversationTitle(activeConversationId!, input.trim());
    }

    const updatedMessages = [...currentMessages, userMessage];
    updateConversationMessages(activeConversationId!, updatedMessages);
    
    setInput("");
    setIsLoading(true);

    try {
      if (!firebaseKeyAvailable) {
        const key = await getOpenAIApiKeyFromFirestore();
        if (key) {
          setFirebaseKeyAvailable(true);
          setIsUsingFirebaseKey(true);
          console.log("Found Firebase API key just before making request");
        }
      }
      
      const aiContent = await getAIResponse(userMessage.content);
      
      const newMessage: ChatMessageProps = {
        role: "assistant",
        content: aiContent,
        timestamp: new Date(),
      };
      
      const finalMessages = [...updatedMessages, newMessage];
      updateConversationMessages(activeConversationId!, finalMessages);
      
      if (errorCount > 0) {
        setErrorCount(0);
      }
    } catch (error) {
      console.error("Error in chat interface:", error);
      
      setErrorCount(prev => prev + 1);
      
      const errorMessage: ChatMessageProps = {
        role: "assistant",
        content: "I'm having trouble connecting. Let me try to answer with what I know.",
        timestamp: new Date(),
      };
      
      updateConversationMessages(activeConversationId!, [...updatedMessages, errorMessage]);
      
      if (errorCount >= 2) {
        toast.error("API connection error. Please check API key or try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 left-6 z-[10000] animate-scale-in">
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        onKeyStoredInFirebase={() => {
          setFirebaseKeyLoading(true);
          getOpenAIApiKeyFromFirestore().then(key => {
            if (key) {
              setFirebaseKeyAvailable(true);
              setIsUsingFirebaseKey(true);
              setApiKeyError(null);
              toast.success("Now using Firebase API key");
            }
            setFirebaseKeyLoading(false);
          });
        }}
      />
      
      <Card className="glass-panel w-[650px] h-[460px] shadow-xl flex flex-row overflow-hidden">
        <div className="w-[200px] border-r border-gray-200 dark:border-gray-700 bg-white bg-opacity-95">
          <ChatHistory
            conversations={conversations}
            activeConversation={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={createNewConversation}
            onDeleteConversation={handleDeleteConversation}
            className="h-full"
          />
        </div>
        
        <div className="flex flex-col flex-1 h-full">
          <div className="flex justify-between items-center px-[24px] py-[16px] border-b border-gray-200">
            <div className="flex items-center">
              <Bot className="text-focus-purple mr-2" size={20} />
              <h2 className="font-semibold">AI Assistant</h2>
              
              {firebaseKeyLoading ? (
                <div className="flex items-center ml-2">
                  <div className="w-3 h-3 rounded-full border-2 border-focus-purple border-t-transparent animate-spin mr-1"></div>
                  <span className="text-xs text-slate-500">Checking API...</span>
                </div>
              ) : firebaseKeyAvailable ? (
                <span className="text-xs text-green-500 ml-2 flex items-center">
                  <Check size={12} className="mr-1" />
                  Ready to chat
                </span>
              ) : getApiKey() ? (
                <span className="text-xs text-green-500 ml-2">Using custom API key</span>
              ) : (
                <span className="text-xs text-orange-500 ml-2">Using simulated responses</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setApiKeyDialogOpen(true)}
                className="h-8 w-8"
                aria-label="Configure API Key"
                title="Configure API Key"
              >
                <Key size={18} />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Close chat"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
          
          {activeConversationId ? (
            <div className="flex-1 flex flex-col px-[24px] py-[16px] overflow-hidden">
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto scrollbar-thin mb-4 bg-white bg-opacity-50 rounded-xl p-2 pr-1"
                style={{ maxHeight: "calc(100% - 80px)" }}
              >
                <div className="space-y-4 min-h-full">
                  {messages.map((msg, index) => (
                    <ChatMessage key={index} {...msg} />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start mb-4">
                      <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 rounded-full bg-focus-purple/50 animate-pulse"></div>
                          <div className="w-2 h-2 rounded-full bg-focus-purple/50 animate-pulse delay-150"></div>
                          <div className="w-2 h-2 rounded-full bg-focus-purple/50 animate-pulse delay-300"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="border-t pt-4 mt-auto">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1"
                    disabled={isLoading || firebaseKeyLoading}
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading || !input.trim() || firebaseKeyLoading}
                    className="bg-focus-purple hover:bg-focus-purple-dark"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center space-y-4">
              <Button
                onClick={createNewConversation}
                className="bg-focus-purple hover:bg-focus-purple-dark text-white"
                disabled={firebaseKeyLoading}
              >
                <PlusCircle size={16} className="mr-2" />
                Start New Chat
              </Button>
              
              {apiKeyError && !firebaseKeyAvailable && !getApiKey() && (
                <div className="max-w-sm text-sm text-muted-foreground">
                  <p className="mb-2 text-orange-500">
                    {apiKeyError}. Using simulated AI responses for now.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setApiKeyDialogOpen(true)}
                    className="mt-2"
                  >
                    <Key size={14} className="mr-2" />
                    Configure API Key
                  </Button>
                </div>
              )}
              
              {firebaseKeyLoading && (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 rounded-full border-2 border-focus-purple border-t-transparent animate-spin"></div>
                  <div className="text-sm text-muted-foreground">Loading AI capabilities...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;
