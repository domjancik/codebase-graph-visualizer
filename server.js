#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import neo4j from 'neo4j-driver';

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
    this.app.get('/api/design-docs', this.getDesignDocs.bind(this));
    this.app.get('/api/design-docs/:codebase', this.getDesignDocsByCodebase.bind(this));
    this.app.get('/api/design-docs-flexible', this.getDesignDocsFlexible.bind(this));
    this.app.get('/api/design-docs-flexible/:codebase', this.getDesignDocsFlexibleByCodebase.bind(this));
    this.app.get('/api/tasks', this.getTasks.bind(this));
    this.app.get('/api/tasks/:id/connected-graph', this.getTaskConnectedGraph.bind(this));
    this.app.get('/api/overview/:codebase', this.getCodebaseOverview.bind(this));
    this.app.get('/api/dependency-tree/:componentId', this.getDependencyTree.bind(this));
    this.app.get('/api/node-types', this.getNodeTypes.bind(this));
    this.app.get('/api/relationship-types', this.getRelationshipTypes.bind(this));
    
    // Task management endpoints
    this.app.post('/api/tasks', this.createTask.bind(this));
    this.app.post('/api/tasks/execute', this.executeTask.bind(this));
    this.app.put('/api/tasks/:id/status', this.updateTaskStatus.bind(this));
    
    // Comment management endpoints
    this.app.get('/api/nodes/:id/comments', this.getNodeComments.bind(this));
    this.app.post('/api/nodes/:id/comments', this.createComment.bind(this));
    this.app.put('/api/comments/:id', this.updateComment.bind(this));
    this.app.delete('/api/comments/:id', this.deleteComment.bind(this));
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

      const tasks = tasksResult.records.map(record => {
        const taskProps = record.get('t').properties;
        return {
          ...taskProps,
          // Convert Neo4j datetime objects to ISO strings
          created: taskProps.created ? taskProps.created.toString() : null,
          updated: taskProps.updated ? taskProps.updated.toString() : null,
          createdAt: taskProps.created ? taskProps.created.toString() : null,
          updatedAt: taskProps.updated ? taskProps.updated.toString() : null,
          lastModified: taskProps.updated ? taskProps.updated.toString() : taskProps.created ? taskProps.created.toString() : null,
          relatedComponentIds: record.get('relatedComponentIds'),
          relatedComponents: record.get('relatedComponents').map(c => c.properties),
          type: 'task'
        };
      });

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
        MATCH ()-[r]-> () RETURN DISTINCT type(r) as type
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

  async getDesignDocs(req, res) {
    const session = this.driver.session();
    try {
      // Get design document components (SPECIFICATION, REQUIREMENT, FEATURE, USER_STORY, ACCEPTANCE_CRITERIA)
      const componentsResult = await session.run(`
        MATCH (c:Component)
        WHERE c.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA', 'SYSTEM', 'MODULE', 'CLASS']
        RETURN c
        ORDER BY c.codebase, c.name
      `);

      // Get all relationships between design document components
      const relationshipsResult = await session.run(`
        MATCH (source:Component)-[r]->(target:Component)
        WHERE source.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA', 'SYSTEM', 'MODULE', 'CLASS']
          AND target.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA', 'SYSTEM', 'MODULE', 'CLASS']
          AND type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `);

      const components = componentsResult.records.map((record, index) => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type,
          // Auto-generate grid positions if not set
          position: props.position || this.generateGridPosition(index, 3, 350, 250)
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
        statistics: {
          designDocCount: components.length,
          connectionCount: relationships.length,
          featureCount: components.filter(n => n.componentType === 'FEATURE').length,
          specificationCount: components.filter(n => n.componentType === 'SPECIFICATION').length,
          requirementCount: components.filter(n => n.componentType === 'REQUIREMENT').length,
          userStoryCount: components.filter(n => n.componentType === 'USER_STORY').length,
          acceptanceCriteriaCount: components.filter(n => n.componentType === 'ACCEPTANCE_CRITERIA').length
        }
      });
    } catch (error) {
      console.error('Error fetching design docs:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getDesignDocsByCodebase(req, res) {
    const { codebase } = req.params;
    const session = this.driver.session();
    
    try {
      // Get design document components for specific codebase
      const componentsResult = await session.run(`
        MATCH (c:Component {codebase: $codebase})
        WHERE c.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA']
        RETURN c
        ORDER BY c.name
      `, { codebase });

      // Get relationships between design document components in this codebase
      const relationshipsResult = await session.run(`
        MATCH (source:Component {codebase: $codebase})-[r]->(target:Component {codebase: $codebase})
        WHERE source.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA']
          AND target.type IN ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA']
          AND type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `, { codebase });

      const components = componentsResult.records.map((record, index) => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type,
          // Auto-generate grid positions if not set
          position: props.position || this.generateGridPosition(index, 3, 350, 250)
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
          designDocCount: components.length,
          connectionCount: relationships.length,
          featureCount: components.filter(n => n.componentType === 'FEATURE').length,
          specificationCount: components.filter(n => n.componentType === 'SPECIFICATION').length,
          requirementCount: components.filter(n => n.componentType === 'REQUIREMENT').length,
          userStoryCount: components.filter(n => n.componentType === 'USER_STORY').length,
          acceptanceCriteriaCount: components.filter(n => n.componentType === 'ACCEPTANCE_CRITERIA').length
        }
      });
    } catch (error) {
      console.error('Error fetching design docs for codebase:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getDesignDocsFlexible(req, res) {
    const session = this.driver.session();
    const { types } = req.query; // Expected as comma-separated string
    
    try {
      // Default to design document types if no types specified
      const componentTypes = types 
        ? types.split(',').map(t => t.trim())
        : ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA'];
      
      // Get components of specified types
      const componentsResult = await session.run(`
        MATCH (c:Component)
        WHERE c.type IN $componentTypes
        RETURN c
        ORDER BY c.codebase, c.type, c.name
      `, { componentTypes });

      // Get all relationships between components of specified types
      const relationshipsResult = await session.run(`
        MATCH (source:Component)-[r]->(target:Component)
        WHERE source.type IN $componentTypes
          AND target.type IN $componentTypes
          AND type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `, { componentTypes });

      const components = componentsResult.records.map((record, index) => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type,
          // Auto-generate grid positions if not set
          position: props.position || this.generateGridPosition(index, 4, 320, 220)
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

      // Calculate statistics for each component type
      const statistics = {
        totalCount: components.length,
        connectionCount: relationships.length,
        typeBreakdown: {}
      };
      
      componentTypes.forEach(type => {
        statistics.typeBreakdown[type] = components.filter(n => n.componentType === type).length;
      });

      res.json({
        nodes: components,
        links: relationships,
        availableTypes: componentTypes,
        statistics
      });
    } catch (error) {
      console.error('Error fetching flexible design docs:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async getDesignDocsFlexibleByCodebase(req, res) {
    const { codebase } = req.params;
    const { types } = req.query; // Expected as comma-separated string
    const session = this.driver.session();
    
    try {
      // Default to design document types if no types specified
      const componentTypes = types 
        ? types.split(',').map(t => t.trim())
        : ['SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'USER_STORY', 'ACCEPTANCE_CRITERIA'];
      
      // Get components of specified types for specific codebase
      const componentsResult = await session.run(`
        MATCH (c:Component {codebase: $codebase})
        WHERE c.type IN $componentTypes
        RETURN c
        ORDER BY c.type, c.name
      `, { codebase, componentTypes });

      // Get relationships between components of specified types in this codebase
      const relationshipsResult = await session.run(`
        MATCH (source:Component {codebase: $codebase})-[r]->(target:Component {codebase: $codebase})
        WHERE source.type IN $componentTypes
          AND target.type IN $componentTypes
          AND type(r) <> 'RELATES_TO'
        RETURN source.id as sourceId, target.id as targetId, 
               type(r) as type, r as relationship,
               source.name as sourceName, target.name as targetName
      `, { codebase, componentTypes });

      const components = componentsResult.records.map((record, index) => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type,
          // Auto-generate grid positions if not set
          position: props.position || this.generateGridPosition(index, 4, 320, 220)
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

      // Calculate statistics for each component type
      const statistics = {
        totalCount: components.length,
        connectionCount: relationships.length,
        typeBreakdown: {}
      };
      
      componentTypes.forEach(type => {
        statistics.typeBreakdown[type] = components.filter(n => n.componentType === type).length;
      });

      res.json({
        nodes: components,
        links: relationships,
        codebase,
        availableTypes: componentTypes,
        statistics
      });
    } catch (error) {
      console.error('Error fetching flexible design docs for codebase:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  // Helper method to generate grid positions
  generateGridPosition(index, cols, nodeWidth, nodeHeight) {
    const padding = 50; // Space between nodes
    const canvasPadding = 50; // Canvas padding is handled by CSS
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: col * (nodeWidth + padding), // No additional offset needed - CSS handles canvas padding
      y: row * (nodeHeight + padding)
    };
  }

  async getTaskConnectedGraph(req, res) {
    const { id } = req.params;
    const session = this.driver.session();
    
    try {
      // Get the task itself
      const taskResult = await session.run(`
        MATCH (t:Task {id: $id})
        RETURN t
      `, { id });
      
      if (taskResult.records.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const task = {
        ...taskResult.records[0].get('t').properties,
        type: 'task'
      };
      
      // Get all components directly related to the task
      const directComponentsResult = await session.run(`
        MATCH (t:Task {id: $id})-[:RELATES_TO]->(c:Component)
        RETURN c
      `, { id });
      
      const directComponents = directComponentsResult.records.map(record => {
        const props = record.get('c').properties;
        return {
          ...props,
          type: 'component',
          componentType: props.type
        };
      });
      
      // Get all components that have relationships with the direct components (1 level deep)
      const connectedComponentIds = directComponents.map(c => c.id);
      let connectedComponents = [];
      let allRelationships = [];
      
      if (connectedComponentIds.length > 0) {
        const connectedResult = await session.run(`
          MATCH (c1:Component)-[r]-(c2:Component)
          WHERE c1.id IN $componentIds OR c2.id IN $componentIds
          RETURN DISTINCT c1, c2, r, type(r) as relType
        `, { componentIds: connectedComponentIds });
        
        const componentMap = new Map();
        
        // Add direct components to map
        directComponents.forEach(c => componentMap.set(c.id, c));
        
        // Process all connected relationships
        connectedResult.records.forEach(record => {
          const c1Props = record.get('c1').properties;
          const c2Props = record.get('c2').properties;
          const relationship = record.get('r').properties;
          const relType = record.get('relType');
          
          // Add components to map if not already present
          if (!componentMap.has(c1Props.id)) {
            componentMap.set(c1Props.id, {
              ...c1Props,
              type: 'component',
              componentType: c1Props.type
            });
          }
          
          if (!componentMap.has(c2Props.id)) {
            componentMap.set(c2Props.id, {
              ...c2Props,
              type: 'component',
              componentType: c2Props.type
            });
          }
          
          // Add relationship
          allRelationships.push({
            source: c1Props.id,
            target: c2Props.id,
            type: relType,
            sourceName: c1Props.name,
            targetName: c2Props.name,
            ...relationship
          });
        });
        
        connectedComponents = Array.from(componentMap.values());
      }
      
      // Get other tasks that are related to the same components (sibling tasks)
      const siblingTasksResult = await session.run(`
        MATCH (t:Task)-[:RELATES_TO]->(c:Component)
        WHERE c.id IN $componentIds AND t.id <> $taskId
        RETURN DISTINCT t
      `, { componentIds: connectedComponentIds, taskId: id });
      
      const siblingTasks = siblingTasksResult.records.map(record => ({
        ...record.get('t').properties,
        type: 'task'
      }));
      
      // Combine all nodes
      const allNodes = [task, ...connectedComponents, ...siblingTasks];
      
      res.json({
        nodes: allNodes,
        links: allRelationships,
        focusTask: task,
        statistics: {
          taskCount: siblingTasks.length + 1,
          componentCount: connectedComponents.length,
          relationshipCount: allRelationships.length,
          directComponentCount: directComponents.length
        }
      });
    } catch (error) {
      console.error('Error fetching task connected graph:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // COMMENT MANAGEMENT METHODS
  // ============================================================================

  async getNodeComments(req, res) {
    const { id } = req.params;
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (n)-[:HAS_COMMENT]->(c:Comment)
        WHERE n.id = $id
        RETURN c
        ORDER BY c.timestamp DESC
      `, { id });
      
      const comments = result.records.map(record => record.get('c').properties);
      res.json(comments);
    } catch (error) {
      console.error('Error fetching node comments:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async createComment(req, res) {
    const { id: nodeId } = req.params;
    const { content, author = 'system' } = req.body;
    const session = this.driver.session();

    try {
      const commentId = `comment_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // Create comment and link to node
      const result = await session.run(`
        MATCH (n) WHERE n.id = $nodeId
        CREATE (c:Comment {
          id: $commentId,
          content: $content,
          author: $author,
          timestamp: $timestamp
        })
        CREATE (n)-[:HAS_COMMENT]->(c)
        RETURN c, n
      `, { nodeId, commentId, content, author, timestamp });
      
      if (result.records.length === 0) {
        return res.status(404).json({ error: 'Node not found' });
      }
      
      const comment = result.records[0].get('c').properties;
      const node = result.records[0].get('n').properties;
      
      res.status(201).json({ 
        comment,
        message: `Comment added to ${node.name || node.id}` 
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async updateComment(req, res) {
    const { id } = req.params;
    const { content } = req.body;
    const session = this.driver.session();

    try {
      const updatedTimestamp = new Date().toISOString();
      
      const result = await session.run(`
        MATCH (c:Comment {id: $id})
        SET c.content = $content, c.updatedAt = $updatedTimestamp
        RETURN c
      `, { id, content, updatedTimestamp });
      
      if (result.records.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      const comment = result.records[0].get('c').properties;
      res.json({ comment, message: 'Comment updated successfully' });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await session.close();
    }
  }

  async deleteComment(req, res) {
    const { id } = req.params;
    const session = this.driver.session();

    try {
      const result = await session.run(`
        MATCH (c:Comment {id: $id})
        DETACH DELETE c
        RETURN count(c) as deleted
      `, { id });
      
      const deleted = result.records[0].get('deleted').toNumber();
      
      if (deleted === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
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
