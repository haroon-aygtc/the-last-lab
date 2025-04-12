/**
 * Type definitions for context rules
 * These types define the structure of context rules used throughout the application
 */

export interface ContextRule {
  id: string;
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ContextRuleMatch {
  ruleId: string;
  ruleName: string;
  matches: string[];
  score: number;
}

export interface ContextRuleTestResult {
  result: string;
  matches: string[];
  appliedRules: ContextRuleMatch[];
}

export interface ContextRuleFilter {
  id?: string;
  name?: string;
  isActive?: boolean;
  priority?: number;
}

export interface ContextRuleCreateInput {
  name: string;
  description?: string;
  content: string;
  isActive?: boolean;
  priority?: number;
}

export interface ContextRuleUpdateInput {
  name?: string;
  description?: string;
  content?: string;
  isActive?: boolean;
  priority?: number;
}
