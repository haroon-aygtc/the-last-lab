import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Info,
  Edit,
  Eye,
  Loader2,
  X,
  Database,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import contextRulesService from "@/services/contextRulesService";
import { ContextRule } from "@/services/contextRulesService";
import { ResponseFilter } from "@/types/contextRules";
import knowledgeBaseService, {
  KnowledgeBaseConfig,
} from "@/services/knowledgeBaseService";
import logger from "@/utils/logger";

// Define the schema for context rules
const contextRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  isActive: z.boolean().default(true),
  contextType: z.enum(["business", "general"]),
  keywords: z
    .array(z.string())
    .min(1, { message: "At least one keyword is required" }),
  excludedTopics: z.array(z.string()).optional(),
  promptTemplate: z
    .string()
    .min(10, { message: "Prompt template must be at least 10 characters" }),
  responseFilters: z
    .array(
      z.object({
        type: z.enum(["keyword", "regex", "semantic"]),
        value: z.string(),
        action: z.enum(["block", "flag", "modify"]),
      }),
    )
    .optional(),
  useKnowledgeBases: z.boolean().optional().default(false),
  knowledgeBaseIds: z.array(z.string()).optional().default([]),
  preferredModel: z.string().optional(),
});

type FormContextRule = z.infer<typeof contextRuleSchema>;

// Sample query for the example section
const sampleUserQuery = "Tell me about visa services in Dubai";

const ContextRulesEditor = () => {
  const [activeTab, setActiveTab] = useState("rules-list");
  const [rules, setRules] = useState<ContextRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRule, setSelectedRule] = useState<ContextRule | null>(null);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [isAddingExcludedTopic, setIsAddingExcludedTopic] = useState(false);
  const [newExcludedTopic, setNewExcludedTopic] = useState("");
  const [isAddingFilter, setIsAddingFilter] = useState(false);
  const [newFilter, setNewFilter] = useState<ResponseFilter>({
    type: "keyword",
    value: "",
    action: "block",
  });
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<{
    result: string;
    matches: string[];
  } | null>(null);
  const [isTestingRule, setIsTestingRule] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseConfig[]>(
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormContextRule>({
    resolver: zodResolver(contextRuleSchema),
    defaultValues: {
      isActive: true,
      contextType: "business",
      keywords: [],
      excludedTopics: [],
      responseFilters: [],
      useKnowledgeBases: false,
      knowledgeBaseIds: [],
    },
  });

  // Fetch rules on component mount
  useEffect(() => {
    const fetchRules = async () => {
      try {
        setIsLoading(true);
        const response = await contextRulesService.getContextRules(
          100,
          0,
          true,
        );
        if (response && Array.isArray(response.rules)) {
          setRules(response.rules);
        } else {
          // Fallback to empty array if data is not in expected format
          logger.warn(
            "Unexpected data format from context rules service",
            response,
          );
          setRules([]);
        }
        setError(null);
      } catch (error) {
        logger.error(
          "Error fetching context rules",
          error instanceof Error ? error : new Error(String(error)),
        );
        setError("Failed to load context rules. Please try again.");
        setRules([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRules();
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const kbs = await knowledgeBaseService.getAllConfigs();
      setKnowledgeBases(kbs.filter((kb) => kb.isActive));
    } catch (error) {
      console.error("Error fetching knowledge bases:", error);
      setError("Failed to load knowledge bases. Please try again.");
    }
  };

  const handleCreateRule = async (data: FormContextRule) => {
    try {
      setIsSaving(true);
      // Convert form data to the format expected by the service
      const ruleData = {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        priority: 10, // Default priority
        conditions: [
          {
            type: "contextType",
            value: data.contextType,
            operator: "equals",
          },
          ...data.keywords.map((keyword) => ({
            type: "keyword",
            value: keyword,
            operator: "contains",
          })),
        ],
        actions:
          data.responseFilters?.map((filter) => ({
            type: filter.type,
            value: filter.value,
            parameters: { action: filter.action },
          })) || [],
      };

      const newRule = await contextRulesService.createContextRule(
        ruleData as Omit<ContextRule, "id" | "createdAt" | "updatedAt">,
      );
      setRules([...rules, newRule]);
      setActiveTab("rules-list");
      reset();
      setError(null);
    } catch (error) {
      logger.error(
        "Error creating context rule",
        error instanceof Error ? error : new Error(String(error)),
      );
      setError("Failed to create context rule. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRule = async (data: FormContextRule) => {
    if (!selectedRule?.id) return;

    try {
      setIsSaving(true);
      // Convert form data to the format expected by the service
      const ruleData = {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        conditions: [
          {
            type: "contextType",
            value: data.contextType,
            operator: "equals",
          },
          ...data.keywords.map((keyword) => ({
            type: "keyword",
            value: keyword,
            operator: "contains",
          })),
        ],
        actions:
          data.responseFilters?.map((filter) => ({
            type: filter.type,
            value: filter.value,
            parameters: { action: filter.action },
          })) || [],
      };

      const updatedRule = await contextRulesService.updateContextRule(
        selectedRule.id,
        ruleData as Partial<
          Omit<ContextRule, "id" | "createdAt" | "updatedAt">
        >,
      );
      setRules(
        rules.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)),
      );
      setSelectedRule(null);
      setActiveTab("rules-list");
      reset();
      setError(null);
    } catch (error) {
      logger.error(
        "Error updating context rule",
        error instanceof Error ? error : new Error(String(error)),
      );
      setError("Failed to update context rule. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this context rule?")) return;

    try {
      setIsLoading(true);
      await contextRulesService.deleteContextRule(id);
      setRules(rules.filter((rule) => rule.id !== id));
      setError(null);
    } catch (error) {
      logger.error(
        "Error deleting context rule",
        error instanceof Error ? error : new Error(String(error)),
      );
      setError("Failed to delete context rule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditRule = (rule: ContextRule) => {
    setSelectedRule(rule);

    // Extract keywords from conditions
    const keywords =
      rule.conditions
        ?.filter((c) => c.type === "keyword")
        ?.map((c) => c.value) || [];

    // Extract response filters from actions
    const responseFilters =
      rule.actions?.map((a) => ({
        type: a.type as "keyword" | "regex" | "semantic",
        value: a.value,
        action:
          (a.parameters?.action as "block" | "flag" | "modify") || "block",
      })) || [];

    // Extract context type from conditions
    const contextTypeCondition = rule.conditions?.find(
      (c) => c.type === "contextType",
    );
    const contextType =
      (contextTypeCondition?.value as "business" | "general") || "business";

    reset({
      ...rule,
      contextType,
      keywords,
      excludedTopics: [],
      responseFilters,
      useKnowledgeBases: false,
      knowledgeBaseIds: [],
    });
    setActiveTab("create-rule");
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const currentKeywords = watch("keywords") || [];
    setValue("keywords", [...currentKeywords, newKeyword.trim()]);
    setNewKeyword("");
    setIsAddingKeyword(false);
  };

  const handleRemoveKeyword = (keyword: string) => {
    const currentKeywords = watch("keywords") || [];
    setValue(
      "keywords",
      currentKeywords.filter((k) => k !== keyword),
    );
  };

  const handleAddExcludedTopic = () => {
    if (!newExcludedTopic.trim()) return;
    const currentTopics = watch("excludedTopics") || [];
    setValue("excludedTopics", [...currentTopics, newExcludedTopic.trim()]);
    setNewExcludedTopic("");
    setIsAddingExcludedTopic(false);
  };

  const handleRemoveExcludedTopic = (topic: string) => {
    const currentTopics = watch("excludedTopics") || [];
    setValue(
      "excludedTopics",
      currentTopics.filter((t) => t !== topic),
    );
  };

  const handleAddFilter = () => {
    if (!newFilter.value.trim()) return;
    const currentFilters = watch("responseFilters") || [];
    setValue("responseFilters", [...currentFilters, newFilter]);
    setNewFilter({ type: "keyword", value: "", action: "block" });
    setIsAddingFilter(false);
  };

  const handleRemoveFilter = (index: number) => {
    const currentFilters = watch("responseFilters") || [];
    setValue(
      "responseFilters",
      currentFilters.filter((_, i) => i !== index),
    );
  };

  const handleSwitchChange = (field: string, checked: boolean) => {
    setValue(field as any, checked);
  };

  const handleKnowledgeBaseChange = (kbId: string, checked: boolean) => {
    const currentIds = watch("knowledgeBaseIds") || [];
    const newIds = checked
      ? [...currentIds, kbId]
      : currentIds.filter((id) => id !== kbId);
    setValue("knowledgeBaseIds", newIds);
  };

  const handleTestRule = async () => {
    if (!selectedRule?.id || !testQuery.trim()) return;

    try {
      setIsTestingRule(true);
      setTestResult(null);
      setError(null);

      // Simple test implementation since we don't have a direct test endpoint
      // Extract keywords from the rule's conditions
      const keywords =
        selectedRule.conditions
          ?.filter((c) => c.type === "keyword")
          ?.map((c) => c.value) || [];

      // Check if any keywords match the test query
      const matches = keywords.filter((keyword) =>
        testQuery.toLowerCase().includes(keyword.toLowerCase()),
      );

      // Simulate a response
      const result = {
        matches,
        result:
          matches.length > 0
            ? `The query matches ${matches.length} keywords: ${matches.join(", ")}. This rule would be applied.`
            : "No keywords matched. This rule would not be applied.",
      };

      setTestResult(result);
      setIsTestDialogOpen(true);
    } catch (error) {
      logger.error(
        "Error testing context rule",
        error instanceof Error ? error : new Error(String(error)),
      );
      setError("Failed to test context rule. Please try again.");
    } finally {
      setIsTestingRule(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedRule(null);
    reset();
    setActiveTab("rules-list");
  };

  const formattedPromptTemplate = (template: string) => {
    return template.replace(
      "{{ userQuery }}",
      `<span class="text-blue-500 font-semibold">${sampleUserQuery}</span>`,
    );
  };

  return (
    <div className="p-6 bg-background">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Context Rules</h1>
          <p className="text-muted-foreground">
            Define and manage context rules to control AI responses
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedRule(null);
            reset();
            setActiveTab("create-rule");
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="rules-list">Rules List</TabsTrigger>
          <TabsTrigger value="create-rule">
            {selectedRule ? "Edit Rule" : "Create Rule"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules-list">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/20">
              <p className="text-muted-foreground mb-4">
                No context rules found. Create your first rule to get started.
              </p>
              <Button
                onClick={() => setActiveTab("create-rule")}
                variant="outline"
              >
                Create Rule
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rules.map((rule) => (
                <Card key={rule.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {rule.name}
                          {rule.isActive ? (
                            <Badge variant="default" className="ml-2">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">
                              Inactive
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{rule.description}</CardDescription>
                      </div>
                      <div className="flex space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedRule(rule);
                                  setIsPreviewDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedRule(rule);
                                  setTestQuery("");
                                  setTestResult(null);
                                  setIsTestDialogOpen(true);
                                }}
                              >
                                <div className="relative">
                                  <span className="absolute -top-1 -right-1 text-xs bg-primary text-primary-foreground rounded-full w-3 h-3 flex items-center justify-center">
                                    ?
                                  </span>
                                  <span className="sr-only">Test</span>
                                </div>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Test Rule</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRule(rule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Type</h4>
                        <Badge
                          variant="outline"
                          className="capitalize bg-primary/5"
                        >
                          {rule.contextType}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-1">Keywords</h4>
                        <div className="flex flex-wrap gap-1">
                          {rule.keywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {rule.excludedTopics &&
                        rule.excludedTopics.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1">
                              Excluded Topics
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {rule.excludedTopics.map((topic) => (
                                <Badge
                                  key={topic}
                                  variant="outline"
                                  className="bg-destructive/10 text-destructive"
                                >
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      {rule.useKnowledgeBases && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            Knowledge Bases
                          </h4>
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800"
                          >
                            Enabled
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t pt-3 text-xs text-muted-foreground">
                    <div className="w-full flex justify-between">
                      <span>
                        Created: {new Date(rule.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        Updated: {new Date(rule.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="create-rule">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedRule ? "Edit Context Rule" : "Create Context Rule"}
              </CardTitle>
              <CardDescription>
                {selectedRule
                  ? "Update the settings for this context rule"
                  : "Define a new context rule to control AI responses"}
              </CardDescription>
            </CardHeader>
            <form
              onSubmit={handleSubmit(
                selectedRule ? handleUpdateRule : handleCreateRule,
              )}
            >
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Rule Name</Label>
                      <Input
                        id="name"
                        placeholder="E.g., UAE Government Information"
                        {...register("name")}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe the purpose of this context rule"
                        {...register("description")}
                      />
                      {errors.description && (
                        <p className="text-sm text-destructive">
                          {errors.description.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contextType">Context Type</Label>
                      <Select
                        defaultValue={watch("contextType")}
                        onValueChange={(value) =>
                          setValue(
                            "contextType",
                            value as "business" | "general",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select context type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={watch("isActive")}
                        onCheckedChange={(checked) =>
                          handleSwitchChange("isActive", checked)
                        }
                      />
                      <Label htmlFor="isActive">Active</Label>
                    </div>

                    <div className="space-y-4 border rounded-md p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Database className="h-4 w-4" />
                          <Label
                            htmlFor="useKnowledgeBases"
                            className="font-medium"
                          >
                            Knowledge Base Integration
                          </Label>
                        </div>
                        <Switch
                          id="useKnowledgeBases"
                          checked={watch("useKnowledgeBases") || false}
                          onCheckedChange={(checked) =>
                            handleSwitchChange("useKnowledgeBases", checked)
                          }
                        />
                      </div>

                      {watch("useKnowledgeBases") && (
                        <div className="mt-2 space-y-2">
                          <Label>Select Knowledge Bases:</Label>
                          {knowledgeBases.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              No active knowledge bases available. Please create
                              one in the Knowledge Base Manager.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                              {knowledgeBases.map((kb) => (
                                <div
                                  key={kb.id}
                                  className="flex items-center space-x-2"
                                >
                                  <Switch
                                    id={`kb-${kb.id}`}
                                    checked={(
                                      watch("knowledgeBaseIds") || []
                                    ).includes(kb.id)}
                                    onCheckedChange={(checked) =>
                                      handleKnowledgeBaseChange(kb.id, checked)
                                    }
                                  />
                                  <Label
                                    htmlFor={`kb-${kb.id}`}
                                    className="flex items-center space-x-2"
                                  >
                                    <span>{kb.name}</span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {kb.type}
                                    </Badge>
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Keywords</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddingKeyword(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                      {isAddingKeyword ? (
                        <div className="flex space-x-2">
                          <Input
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="Enter keyword"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleAddKeyword}
                            size="sm"
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingKeyword(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1 min-h-[40px] p-2 border rounded-md">
                        {watch("keywords")?.map((keyword) => (
                          <Badge key={keyword} variant="secondary">
                            {keyword}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveKeyword(keyword)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Excluded Topics</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddingExcludedTopic(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                      {isAddingExcludedTopic ? (
                        <div className="flex space-x-2">
                          <Input
                            value={newExcludedTopic}
                            onChange={(e) =>
                              setNewExcludedTopic(e.target.value)
                            }
                            placeholder="Enter topic"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleAddExcludedTopic}
                            size="sm"
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingExcludedTopic(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1 min-h-[40px] p-2 border rounded-md">
                        {watch("excludedTopics")?.map((topic) => (
                          <Badge key={topic} variant="outline">
                            {topic}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveExcludedTopic(topic)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Response Filters</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddingFilter(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                      {isAddingFilter ? (
                        <div className="flex space-x-2">
                          <Select
                            value={newFilter.type}
                            onValueChange={(value) =>
                              setNewFilter({
                                ...newFilter,
                                type: value as "keyword" | "regex" | "semantic",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select filter type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="keyword">Keyword</SelectItem>
                              <SelectItem value="regex">Regex</SelectItem>
                              <SelectItem value="semantic">Semantic</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={newFilter.value}
                            onChange={(e) =>
                              setNewFilter({
                                ...newFilter,
                                value: e.target.value,
                              })
                            }
                            placeholder="Enter filter value"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleAddFilter}
                            size="sm"
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddingFilter(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1 min-h-[40px] p-2 border rounded-md">
                        {watch("responseFilters")?.map((filter, index) => (
                          <Badge key={index} variant="outline">
                            {filter.type === "keyword"
                              ? filter.value
                              : filter.type === "regex"
                                ? filter.value
                                : filter.value}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveFilter(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <CardFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </CardFooter>
              </CardContent>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Test Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Context Rule: {selectedRule?.name}</DialogTitle>
            <DialogDescription>
              Enter a query to test how this context rule would respond
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex space-x-2">
              <Input
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a test query..."
                className="flex-1"
              />
              <Button onClick={handleTestRule} disabled={isTestingRule}>
                {isTestingRule ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test"
                )}
              </Button>
            </div>

            {testResult && (
              <div className="space-y-4 border rounded-md p-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Matched Keywords:
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {testResult.matches.length > 0 ? (
                      testResult.matches.map((keyword) => (
                        <Badge key={keyword} variant="secondary">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No keywords matched
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-1">AI Response:</h4>
                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                    {testResult.result}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTestDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Context Rule Preview: {selectedRule?.name}
            </DialogTitle>
            <DialogDescription>
              Review the configuration of this context rule
            </DialogDescription>
          </DialogHeader>
          {selectedRule && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">Description:</h4>
                  <p className="text-sm">{selectedRule.description}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1">Status:</h4>
                  <Badge
                    variant={selectedRule.isActive ? "default" : "outline"}
                  >
                    {selectedRule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">Keywords:</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedRule.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedRule.excludedTopics &&
                selectedRule.excludedTopics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">
                      Excluded Topics:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedRule.excludedTopics.map((topic) => (
                        <Badge
                          key={topic}
                          variant="outline"
                          className="bg-destructive/10 text-destructive"
                        >
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {selectedRule.promptTemplate && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Prompt Template:
                  </h4>
                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                    {selectedRule.promptTemplate}
                  </div>
                </div>
              )}

              {selectedRule.responseFilters &&
                selectedRule.responseFilters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">
                      Response Filters:
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedRule.responseFilters.map((filter, index) => (
                        <Badge key={index} variant="outline">
                          {filter.type}: {filter.value} ({filter.action})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {selectedRule.useKnowledgeBases && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Knowledge Bases:
                  </h4>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800"
                  >
                    Enabled
                  </Badge>
                  {selectedRule.knowledgeBaseIds &&
                    selectedRule.knowledgeBaseIds.length > 0 && (
                      <div className="mt-2">
                        <h5 className="text-xs font-medium mb-1">
                          Linked Knowledge Bases:
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {selectedRule.knowledgeBaseIds.map((id) => {
                            const kb = knowledgeBases.find(
                              (kb) => kb.id === id,
                            );
                            return (
                              <Badge
                                key={id}
                                variant="outline"
                                className="text-xs"
                              >
                                {kb?.name || id}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {selectedRule.preferredModel && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">
                    Preferred Model:
                  </h4>
                  <Badge variant="outline">{selectedRule.preferredModel}</Badge>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreviewDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsPreviewDialogOpen(false);
                handleEditRule(selectedRule!);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContextRulesEditor;
