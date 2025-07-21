#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import neo4j from 'neo4j-driver';
import MCPServer from './mcp-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GraphVisualizerServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // Neo4j connection (should match the codebase-graph-mcp settings)
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
      )
    );

    this.setupMiddleware();
    this.setupRoutes();
    // Initialize MCP Server
    this.mcpServer = new MCPServer(this.driver);
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, 'public')));
  }

  setupRoutes() {
    // Serve the main visualization page
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, 'public', 'index.html'));
    });

    // API Routes
    this.app.get('/api/health', this.healthCheck.bind(this));
    this.app.get('/api/graph', this.getFullGraph.bind(this));
    this.app.get('/api/graph/:codebase', this.getCodebaseGraph.bind(this));
    this.app.get('/api/components', this.getComponents.bind(this));
    this.app.get('/api/components/:id/relationships', this.getComponentRelationships.bind(this));
    this.app.post('/api/mcp', this.handleMCPRequest.bind(this));
    this.app.get('/api/tasks', this.getTasks.bind(this));
    this.app.get('/api/overview/:codebase', this.getCodebaseOverview.bind(this));
    this.app.get('/api/dependency-tree/:componentId', this.getDependencyTree.bind(this));
    this.app.get('/api/node-types', this.getNodeTypes.bind(this));
    this.app.get('/api/relationship-types', this.getRelationshipTypes.bind(this));
    
    // Task management endpoints
    this.app.post('/api/tasks', this.createTask.bind(this));
    this.app.post('/api/tasks/execute', this.executeTask.bind(this));
    this.app.put('/api/tasks/:id/status', this.updateTaskStatus.bind(this));
  }

  async handleMCPRequest(req, res) {
    const { toolName, params } = req.body;
    try {
      const result = await this.mcpServer.handleRequest(toolName, params);
      res.json(result);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async healthCheck(req, res) {
    try {
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getFullGraph(req, res) {
    const session = this.driver.session();
    try {
      // Get all components
      const componentsResult = await session.run(`
        MATCH (c:Component)
        RETURN c
        ORDER BY c.name
      `);

      // Get all relationships between components
      const relationshipsResult = await session.run(`
        MATCH (source:Component)-[r]->(target:Component)
        WHERE type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `);

      // Get all tasks
      const tasksResult = await session.run(`
        MATCH (t:Task)
        OPTIONAL MATCH (t)-[:RELATES_TO]->(c:Component)
        RETURN t, collect(c.id) as relatedComponentIds, collect(c) as relatedComponents
      `);

      const components = componentsResult.records.map(record => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type  // Preserve the actual component type (FILE, CLASS, etc.)
        };
      });

      const relationships = relationshipsResult.records.map(record => ({
        source: record.get('sourceId'),
        target: record.get('targetId'),
        type: record.get('type'),
        sourceName: record.get('sourceName'),
        targetName: record.get('targetName'),
        ...record.get('relationship').properties
      }));

      const tasks = tasksResult.records.map(record => ({
        ...record.get('t').properties,
        relatedComponentIds: record.get('relatedComponentIds'),
        relatedComponents: record.get('relatedComponents').map(c => c.properties),
        type: 'task'
      }));

      res.json({
        nodes: [...components, ...tasks],
        links: relationships,
        statistics: {
          componentCount: components.length,
          taskCount: tasks.length,
          relationshipCount: relationships.length
        }
      });
    } catch (error) {
      console.error('Error fetching full graph:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getCodebaseGraph(req, res) {
    const { codebase } = req.params;
    const session = this.driver.session();
    
    try {
      // Get components for specific codebase
      const componentsResult = await session.run(`
        MATCH (c:Component {codebase: $codebase})
        RETURN c
        ORDER BY c.name
      `, { codebase });

      // Get relationships between components in this codebase
      const relationshipsResult = await session.run(`
        MATCH (source:Component {codebase: $codebase})-[r]->(target:Component {codebase: $codebase})
        WHERE type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `, { codebase });

      const components = componentsResult.records.map(record => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type  // Preserve the actual component type (FILE, CLASS, etc.)
        };
      });

      const relationships = relationshipsResult.records.map(record => ({
        source: record.get('sourceId'),
        target: record.get('targetId'),
        type: record.get('type'),
        sourceName: record.get('sourceName'),
        targetName: record.get('targetName'),
        ...record.get('relationship').properties
      }));

      res.json({
        nodes: components,
        links: relationships,
        codebase,
        statistics: {
          componentCount: components.length,
          relationshipCount: relationships.length
        }
      });
    } catch (error) {
      console.error('Error fetching codebase graph:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getComponents(req, res) {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (c:Component)
        RETURN c
        ORDER BY c.codebase, c.name
      `);

      const components = result.records.map(record => record.get('c').properties);
      res.json(components);
    } catch (error) {
      console.error('Error fetching components:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getComponentRelationships(req, res) {
    const { id } = req.params;
    const { direction = 'both' } = req.query;
    const session = this.driver.session();
    
    try {
      let query;
      if (direction === 'outgoing') {
        query = `
          MATCH (c:Component {id: $id})-[r]->(target:Component) 
          WHERE type(r) <> 'RELATES_TO'
          RETURN r, target, 'outgoing' as direction, type(r) as relType
        `;
      } else if (direction === 'incoming') {
        query = `
          MATCH (source:Component)-[r]->(c:Component {id: $id}) 
          WHERE type(r) <> 'RELATES_TO'
          RETURN r, source as target, 'incoming' as direction, type(r) as relType
        `;
      } else {
        query = `
          MATCH (c:Component {id: $id})-[r]->(target:Component) 
          WHERE type(r) <> 'RELATES_TO'
          RETURN r, target, 'outgoing' as direction, type(r) as relType
          UNION
          MATCH (source:Component)-[r]->(c:Component {id: $id}) 
          WHERE type(r) <> 'RELATES_TO'
          RETURN r, source as target, 'incoming' as direction, type(r) as relType
        `;
      }

      const result = await session.run(query, { id });
      const relationships = result.records.map(record => ({
        relationship: record.get('r').properties,
        target: record.get('target').properties,
        direction: record.get('direction'),
        type: record.get('relType')
      }));

      res.json(relationships);
    } catch (error) {
      console.error('Error fetching component relationships:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getTasks(req, res) {
    const { status } = req.query;
    const session = this.driver.session();
    
    try {
      let query = `
        MATCH (t:Task)
        OPTIONAL MATCH (t)-[:RELATES_TO]->(c:Component)
        ${status ? 'WHERE t.status = $status' : ''}
        RETURN t, collect(c) as relatedComponents
        ORDER BY t.name
      `;

      const params = status ? { status } : {};
      const result = await session.run(query, params);
      
      const tasks = result.records.map(record => ({
        ...record.get('t').properties,
        relatedComponents: record.get('relatedComponents').map(c => c.properties)
      }));

      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getCodebaseOverview(req, res) {
    const { codebase } = req.params;
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (c:Component {codebase: $codebase})
        RETURN c.type as type, count(*) as count
        ORDER BY count DESC
      `, { codebase });

      const overview = result.records.map(record => ({
        type: record.get('type'),
        count: record.get('count').toNumber()
      }));

      res.json(overview);
    } catch (error) {
      console.error('Error fetching codebase overview:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async createTask(req, res) {
    const { name, description, status, progress, command } = req.body;
    const session = this.driver.session();

    try {
      const taskId = `${Date.now()}`; // Simple task ID generation
      await session.run(`
        CREATE (t:Task {id: $taskId, name: $name, description: $description, status: $status, progress: $progress, command: $command})
      `, { taskId, name, description, status, progress, command });

      res.status(201).json({ id: taskId, name, description, status, progress, command });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async executeTask(req, res) {
    const { taskId, command } = req.body;
    // Placeholder for actual execution logic
    console.log(`Executing task ${taskId} with command: ${command}`);
    res.status(200).json({ message: `Task ${taskId} executed with command: ${command}` });
  }

  async updateTaskStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    const session = this.driver.session();

    try {
      await session.run(`
        MATCH (t:Task {id: $id})
        SET t.status = $status
      `, { id, status });
      res.status(200).json({ message: `Task ${id} status updated to ${status}.` });
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getDependencyTree(req, res) {
    const { componentId } = req.params;
    const { maxDepth = 3 } = req.query;
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH path = (c:Component {id: $componentId})-[:DEPENDS_ON*1..${maxDepth}]->(dep:Component)
        RETURN path
      `, { componentId });

      const dependencies = result.records.map(record => {
        const path = record.get('path');
        return {
          nodes: path.segments.map(segment => ({
            start: segment.start.properties,
            end: segment.end.properties,
            relationship: segment.relationship.properties
          }))
        };
      });

      res.json(dependencies);
    } catch (error) {
      console.error('Error fetching dependency tree:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getNodeTypes(req, res) {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (n) WHERE n:Component RETURN DISTINCT labels(n) as type
      `);
      const types = result.records.map(record => record.get('type'));
      res.json({ types });
    } catch (error) {
      console.error('Error fetching types:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getRelationshipTypes(req, res) {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH ()-[r]->() RETURN DISTINCT type(r) as type
      `);
      const types = result.records.map(record => record.get('type'));
      res.json({ types });
    } catch (error) {
      console.error('Error fetching relationship types:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async start() {
    try {
      // Test database connection
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      console.log('✓ Neo4j connection established');

      this.app.listen(this.port, () => {
        console.log(`🚀 Codebase Graph Visualizer running on http://localhost:${this.port}`);
        console.log(`📊 Dashboard available at http://localhost:${this.port}`);
        console.log(`🔗 API endpoints available at http://localhost:${this.port}/api/`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      console.error('Make sure Neo4j is running on bolt://localhost:7687');
      process.exit(1);
    }
  }

  async close() {
    await this.driver.close();
  }
}

// Start the server
const server = new GraphVisualizerServer();
await server.start();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down server...');
  await server.close();
  process.exit(0);
});
