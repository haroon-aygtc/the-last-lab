import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code } from "lucide-react";

export default function APIStructureStoryboard() {
  return (
    <div className="bg-white p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Code size={24} className="text-primary" />
        Centralized API Structure
      </h1>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Feature APIs</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="middleware">Middleware</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Structure Overview</CardTitle>
              <CardDescription>
                The centralized API structure provides a consistent pattern for
                all service interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Directory Structure</h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`src/services/api/
├── core/           # Core API utilities (mysql, realtime, websocket)
├── endpoints/      # API endpoint definitions
├── features/       # Feature-specific API services
├── middleware/     # API middleware (auth, error handling)
├── utils/          # API utilities
└── index.ts        # Main export file`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Usage Pattern</h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`// Import the API service
import { followUpConfigApi } from '@/services/api';

// Use the API service
const configs = await followUpConfigApi.getFollowUpConfigs(userId);`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature-specific API Services</CardTitle>
              <CardDescription>
                Each feature has its own API service that provides methods for
                interacting with the API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">
                    Available Feature APIs
                  </h3>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>followUpConfigApi</li>
                    <li>followUpQuestionsApi</li>
                    <li>responseFormattingApi</li>
                    <li>scrapingApi</li>
                    <li>knowledgeBaseApi</li>
                    <li>authApi</li>
                    <li>userApi</li>
                    <li>chatApi</li>
                    <li>widgetApi</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium">
                    Example: Follow-up Config API
                  </h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`// src/services/api/features/followUpConfig.ts
import { api } from '../middleware/apiMiddleware';
import { FollowUpConfigData } from '@/services/followUpConfigService';

export const followUpConfigApi = {
  getFollowUpConfigs: async (userId: string): Promise<FollowUpConfigData[]> => {
    try {
      const response = await api.get(\`/follow-up-config/user/\${userId}\`);
      return response.data.data || [];
    } catch (error) {
      console.error(\`Error fetching follow-up configs for user \${userId}:\`, error);
      return [];
    }
  },
  // ... other methods
};`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>
                Centralized definitions of all API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Endpoint Definitions</h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`// src/services/api/endpoints/followUpConfigEndpoints.ts
export const followUpConfigEndpoints = {
  getAll: '/follow-up-config',
  getById: (id: string) => \`/follow-up-config/\${id}\`,
  getByUser: (userId: string) => \`/follow-up-config/user/\${userId}\`,
  getDefault: (userId: string) => \`/follow-up-config/user/\${userId}/default\`,
  create: '/follow-up-config',
  update: (id: string) => \`/follow-up-config/\${id}\`,
  delete: (id: string) => \`/follow-up-config/\${id}\`
};`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-medium">Usage in Feature APIs</h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`import { api } from '../middleware/apiMiddleware';
import { endpoints } from '../endpoints';

export const followUpConfigApi = {
  getFollowUpConfigs: async (userId: string) => {
    try {
      const response = await api.get(endpoints.followUpConfigEndpoints.getByUser(userId));
      return response.data.data || [];
    } catch (error) {
      console.error(\`Error fetching follow-up configs for user \${userId}:\`, error);
      return [];
    }
  },
  // ... other methods
};`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="middleware" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Middleware</CardTitle>
              <CardDescription>
                Middleware for handling API requests and responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">API Middleware</h3>
                  <pre className="bg-slate-100 p-4 rounded-md text-sm mt-2 overflow-x-auto">
                    {`// src/services/api/middleware/apiMiddleware.ts
import axios from 'axios';

// Create an axios instance with default config
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
